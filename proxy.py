#!/usr/bin/env python3
"""
PhantomSDR-Plus Reverse Proxy
==============================
Reads all configuration from admin_config.json (written by setup_admin.sh):

  proxy_port   → port this proxy listens on          (e.g. 8902)
  port         → admin panel internal port           (e.g. 3000)
  public_port  → spectrumserver port                 (e.g. 8900)
  sdr_host     → host used to reach spectrumserver   (127.0.0.1)

Routes:
  /admin*  → Admin panel     (localhost:{port})
  /*       → Spectrumserver  ({sdr_host}:{public_port})

Note on sdr_host
----------------
Older versions had to set this to the machine's LAN IP because spectrumserver
closed WebSockets arriving from 127.0.0.1.  That filter is gone, so the upstream
is plain loopback: no DHCP lease change or downed interface can break the proxy,
and setup no longer has to guess which of docker0 / vmnet* / a VPN is the "real"
interface.  Override sdr_host in admin_config.json only if spectrumserver runs
on a different machine.

Run:  python3 proxy.py            (foreground)
      bash manage_admin.sh start  (background with logging)
"""

import asyncio
import logging
import re
import sys
import json
from pathlib import Path

try:
    import aiohttp
    from aiohttp import web, ClientSession, ClientTimeout, WSMsgType
except ImportError:
    print("[ERROR] aiohttp is not installed. Run:", file=sys.stderr)
    print("        pip3 install aiohttp --break-system-packages", file=sys.stderr)
    sys.exit(1)

# ── Load configuration ─────────────────────────────────────────────────────────
_cfg_path = Path(__file__).parent / "admin_config.json"
try:
    with open(_cfg_path) as _f:
        _cfg = json.load(_f)
except FileNotFoundError:
    print(f"[ERROR] admin_config.json not found at {_cfg_path}", file=sys.stderr)
    print("        Run setup_admin.sh first.", file=sys.stderr)
    sys.exit(1)
except json.JSONDecodeError as _e:
    print(f"[ERROR] admin_config.json is invalid JSON: {_e}", file=sys.stderr)
    sys.exit(1)

for _key in ("port", "public_port", "proxy_port"):
    if _key not in _cfg:
        print(f"[ERROR] Missing '{_key}' in admin_config.json.", file=sys.stderr)
        print("        Re-run setup_admin.sh to reconfigure.", file=sys.stderr)
        sys.exit(1)


# sdr_host: loopback by default — spectrumserver serves local connections now
# (see src/websocket.cpp on_open). An explicit sdr_host in admin_config.json is
# still honoured for the unusual case of spectrumserver running on another host.
_sdr_host = _cfg.get("sdr_host") or "127.0.0.1"
_sdr_port = int(_cfg["public_port"])

LISTEN_HOST    = "0.0.0.0"
LISTEN_PORT    = int(_cfg["proxy_port"])
ADMIN_UPSTREAM = f"http://127.0.0.1:{int(_cfg['port'])}"
SDR_UPSTREAM   = f"http://{_sdr_host}:{_sdr_port}"

# ── Active WebSocket registry (powers the admin "kick") ─────────────────────────
# proxy.py owns every client WebSocket, so it can disconnect a user simply by
# closing the matching ws_client — no CAP_NET_ADMIN / 'ss -K' privilege needed.
# admin_server.py calls the localhost-only /__proxy_control/kick endpoint below.
ACTIVE_WS: "dict[str, set]" = {}

# Close code sent to a kicked listener. A plain 1000 is indistinguishable from
# an ordinary dropped connection, and audio.js reconnects after one of those —
# so the kicked browser came straight back with sound while its waterfall, which
# has no reconnect, stayed frozen. 4001 is in the private range and the frontend
# treats it as terminal (KICKED_CLOSE_CODE in frontend/src/refused.js).
KICK_CLOSE_CODE = 4001


def _norm_ip(ip: str) -> str:
    ip = (ip or "").strip()
    if ip.startswith("::ffff:"):
        ip = ip[7:]  # IPv4-mapped IPv6 → plain IPv4, so keys match ss/admin list
    return ip


def _register_ws(ip: str, ws) -> None:
    ACTIVE_WS.setdefault(ip, set()).add(ws)


def _unregister_ws(ip: str, ws) -> None:
    conns = ACTIVE_WS.get(ip)
    if conns is not None:
        conns.discard(ws)
        if not conns:
            ACTIVE_WS.pop(ip, None)


async def handle_kick(request: web.Request) -> web.Response:
    """Localhost-only control endpoint: close all WebSockets from a given IP.

    Called by admin_server.py's /admin/api/kick. Restricted to loopback so it
    can never be reached by an external client through the public proxy port.
    """
    if _norm_ip(request.remote) not in ("127.0.0.1", "::1"):
        return web.json_response({"ok": False, "msg": "forbidden"}, status=403)
    try:
        data = await request.json()
    except Exception:
        data = {}
    ip = _norm_ip(data.get("ip", ""))
    if not ip:
        return web.json_response({"ok": False, "msg": "no ip"}, status=400)

    closed = 0
    for ws in list(ACTIVE_WS.get(ip, ())):
        try:
            if not ws.closed:
                await ws.close(code=KICK_CLOSE_CODE,
                               message=b"disconnected by the sysop")
                closed += 1
        except Exception:
            pass
    return web.json_response({"ok": True, "count": closed})

# ─────────────────────────────────────────────────────────────────────────────

async def proxy_request(request: web.Request, upstream: str) -> web.StreamResponse:
    url = upstream + str(request.rel_url)
    headers = {k: v for k, v in request.headers.items()
               if k.lower() not in ("host", "content-length", "accept-encoding")}
    headers["Accept-Encoding"]   = "identity"
    headers["X-Forwarded-For"]   = request.remote or ""
    headers["X-Forwarded-Host"]  = request.headers.get("Host", "")
    headers["X-Forwarded-Proto"] = "http"
    headers["X-Forwarded-Port"]  = str(LISTEN_PORT)
    try:
        timeout = ClientTimeout(total=60)
        async with ClientSession(timeout=timeout) as session:
            body = await request.read()
            async with session.request(
                method=request.method,
                url=url,
                headers=headers,
                data=body,
                allow_redirects=False,
                ssl=False,
            ) as resp:
                response = web.StreamResponse(
                    status=resp.status,
                    headers={k: v for k, v in resp.headers.items()
                             if k.lower() not in ("transfer-encoding", "connection")},
                )
                await response.prepare(request)
                async for chunk in resp.content.iter_chunked(65536):
                    await response.write(chunk)
                await response.write_eof()
                return response
    except aiohttp.ClientConnectorError:
        target = "Admin panel" if upstream == ADMIN_UPSTREAM else "Spectrumserver"
        return web.Response(
            status=502,
            text=f"502 Bad Gateway — {target} is not running on {upstream}",
        )
    except Exception as e:
        return web.Response(status=500, text=f"Proxy error: {e}")


async def proxy_websocket(request: web.Request, upstream: str) -> web.WebSocketResponse:
    """Bidirectional WebSocket tunnel.

    Key fixes vs the original:
      • max_msg_size=0 on both sides — removes the 4 MB default cap that
        silently kills large FFT frames from the RX-888 at 60 MSPS.
      • heartbeat=30 — keeps long-lived connections alive through NAT.
      • Sec-WebSocket-Protocol forwarded — correct subprotocol negotiation.
      • X-Forwarded-* on WS upgrade — real client IP visible in server logs.
      • Close codes propagated — browser gets a meaningful disconnect reason.
    """
    raw_protocols = request.headers.get("Sec-WebSocket-Protocol", "")
    protocol_list = [p.strip() for p in raw_protocols.split(",") if p.strip()]

    ws_client = web.WebSocketResponse(
        max_msg_size=0,
        protocols=protocol_list,
        autoping=True,
        heartbeat=30.0,
    )
    await ws_client.prepare(request)

    # Register for the admin kick (see handle_kick). request.remote is the real
    # client IP because the browser connects to this proxy directly.
    client_ip = _norm_ip(request.remote)
    _register_ws(client_ip, ws_client)

    ws_url = upstream.replace("http://", "ws://") + str(request.rel_url)

    _skip = frozenset(("host", "upgrade", "connection",
                        "sec-websocket-key", "sec-websocket-version",
                        "sec-websocket-protocol", "sec-websocket-extensions"))
    fwd_headers = {k: v for k, v in request.headers.items()
                   if k.lower() not in _skip}
    fwd_headers["X-Forwarded-For"]   = request.remote or ""
    fwd_headers["X-Forwarded-Host"]  = request.headers.get("Host", "")
    fwd_headers["X-Forwarded-Proto"] = "ws"
    fwd_headers["X-Forwarded-Port"]  = str(LISTEN_PORT)

    try:
        async with ClientSession() as session:
            try:
                async with session.ws_connect(
                    ws_url,
                    headers=fwd_headers,
                    protocols=protocol_list,
                    max_msg_size=0,
                    heartbeat=30.0,
                    autoclose=True,
                    autoping=True,
                ) as ws_upstream:

                    async def forward_up():
                        """Browser → Spectrumserver"""
                        async for msg in ws_client:
                            if msg.type == WSMsgType.TEXT:
                                await ws_upstream.send_str(msg.data)
                            elif msg.type == WSMsgType.BINARY:
                                await ws_upstream.send_bytes(msg.data)
                            elif msg.type == WSMsgType.CLOSE:
                                await ws_upstream.close()
                                break
                            elif msg.type == WSMsgType.ERROR:
                                break

                    async def forward_down():
                        """Spectrumserver → Browser"""
                        async for msg in ws_upstream:
                            if msg.type == WSMsgType.TEXT:
                                await ws_client.send_str(msg.data)
                            elif msg.type == WSMsgType.BINARY:
                                await ws_client.send_bytes(msg.data)
                            elif msg.type == WSMsgType.CLOSE:
                                await ws_client.close(
                                    code=ws_upstream.close_code or 1000,
                                    message=b"upstream closed",
                                )
                                break
                            elif msg.type == WSMsgType.ERROR:
                                break

                    task_up   = asyncio.ensure_future(forward_up())
                    task_down = asyncio.ensure_future(forward_down())
                    done, pending = await asyncio.wait(
                        {task_up, task_down},
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for task in pending:
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass

            except aiohttp.ClientConnectorError:
                if not ws_client.closed:
                    await ws_client.close(code=1014, message=b"upstream unreachable")
            except aiohttp.WSServerHandshakeError:
                if not ws_client.closed:
                    await ws_client.close(code=1014, message=b"upstream handshake failed")
            except Exception:
                if not ws_client.closed:
                    await ws_client.close(code=1011, message=b"proxy error")

    except Exception:
        pass

    if not ws_client.closed:
        await ws_client.close()
    _unregister_ws(client_ip, ws_client)
    return ws_client


async def handle(request: web.Request) -> web.StreamResponse:
    if request.path == "/__proxy_control/kick":
        return await handle_kick(request)
    upstream = ADMIN_UPSTREAM if request.path.startswith("/admin") else SDR_UPSTREAM
    if request.headers.get("Upgrade", "").lower() == "websocket":
        return await proxy_websocket(request, upstream)
    return await proxy_request(request, upstream)


# ── Access-log noise filter ───────────────────────────────────────────────────
# The admin dashboard polls these paths every few seconds. Logging each poll
# buries the interesting traffic and inflates proxy.log roughly tenfold, so
# successful polls are dropped. Anything that is not a plain 200 still gets
# logged, so failures on these paths remain visible.
# /admin/api/logs/clear is quiet for a different reason: the admin panel
# truncates proxy.log while serving it, and this access line would be written
# afterwards — leaving one line behind and making the clear look like it failed.
#
# Keep this list identical to _QUIET_PATHS in admin_server.py. It drifted once:
# the panel silenced eight paths while the proxy silenced three, so admin.log
# stayed readable and proxy.log filled with the same polls the panel had already
# decided were noise — /admin/api/thermal alone was 72 of 78 lines, ~3 MB/day
# from a single open dashboard tab. These are the sysop's own polls; they say
# nothing about who used the receiver, which is the point of an access log.
_QUIET_PATHS = ("/admin/api/status", "/admin/api/thermal", "/admin/api/logs",
                "/admin/api/logs/clear",
                "/admin/api/autorun/status", "/admin/api/users",
                "/admin/api/graph-stats", "/admin/api/chat")
_ACCESS_RE = re.compile(r'"[A-Z]+ (?P<path>[^ ?"]+)[^"]*" (?P<status>\d{3})')


class QuietPollFilter(logging.Filter):
    def filter(self, record):
        m = _ACCESS_RE.search(record.getMessage())
        if not m or m.group("status") != "200":
            return True
        return m.group("path") not in _QUIET_PATHS


async def main():
    # AppRunner (unlike web.run_app) never calls basicConfig, so aiohttp's
    # access logger stays unconfigured and every request line is discarded.
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logging.getLogger("aiohttp.access").addFilter(QuietPollFilter())

    app = web.Application()
    app.router.add_route("*", "/{path_info:.*}", handle)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, LISTEN_HOST, LISTEN_PORT)
    await site.start()

    print(f"╔══════════════════════════════════════════════════════╗")
    print(f"║  PhantomSDR-Plus Reverse Proxy                       ║")
    print(f"║  Listening : http://0.0.0.0:{LISTEN_PORT:<5}                ║")
    print(f"║  /admin*   → Admin panel  (localhost:{int(_cfg['port']):<5})        ║")
    print(f"║  /*        → SDR server   ({_sdr_host}:{_sdr_port:<5})  ║")
    print(f"╚══════════════════════════════════════════════════════╝")

    await asyncio.Event().wait()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[stopped]")
