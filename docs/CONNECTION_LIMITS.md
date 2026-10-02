# Connection Limits — Sysop Manual

**Protecting a public receiver from connection floods.**

A WebSDR is a public service that hands anyone who asks a continuous stream of audio and spectrum. That is the point of it, and it is also the problem: nothing about a normal listener looks different, to the server, from someone opening sessions in a loop. On 16 September 2026 this receiver was hit by exactly that — one address opened 134 listener sessions inside a single minute and sat on 181 of them at once, while the station's genuine audience was around a dozen.

This manual is about the three layers that stop it, what each one can and cannot do, and how to tell whether yours are set sensibly.

> **In a hurry?** The example `config.toml` already ships with sensible values, so a fresh installation is protected without you doing anything. If your own `.toml` predates this and has no `[limits]` keys beyond `audio`/`waterfall`/`events`, the per-IP limits are simply **off** — copy the block from the example to switch them on. The one command worth knowing afterwards is `grep Refused spectrumserver.log`, which tells you whether anyone is being turned away.

---

## Contents

1. [What you are actually defending against](#1-what-you-are-actually-defending-against)
2. [The three layers](#2-the-three-layers)
3. [Per-IP limits — the listener policy](#3-per-ip-limits)
4. [Idle connections — the silent attack](#4-idle-connections)
5. [The kernel guard — `setup-firewall.sh`](#5-the-kernel-guard)
6. [Configuration reference](#6-configuration-reference)
7. [What a refused listener sees](#7-what-a-refused-listener-sees)
8. [Reading the logs and counters](#8-reading-the-logs-and-counters)
9. [Choosing your numbers](#9-choosing-your-numbers)
10. [Traps worth knowing about](#10-traps-worth-knowing-about)
11. [Turning it all off](#11-turning-it-all-off)

---

## 1. What you are actually defending against

It is worth being precise, because the word "DDoS" covers two very different things and only one of them can be solved on your own machine.

**Single-source flooding.** One host, or a small handful, opening connections as fast as it can. This is what happened here, and it is entirely fixable: the connections arrive from an address you can count, and counting is enough.

**A genuine distributed attack.** Thousands of hosts, often with forged source addresses, filling your uplink. By the time those packets reach your network card the bandwidth has already been spent. **Nothing described in this manual helps**, and nothing you install on the server can — the only answer is a service upstream of you, which is a different conversation involving a real domain and a provider such as Cloudflare in front of the receiver.

Everything below addresses the first case. That is not a limitation worth apologising for: the first case is what actually happens to amateur stations.

---

## 2. The three layers

```
   the internet
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  1. nftables          setup-firewall.sh                 │
   │     blunt, cheap, sheds volume before anything reads it │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. spectrumserver    [limits] in config.toml           │
   │     exact, per listener, knows who is who               │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. the browser       says why, and never retries       │
   └─────────────────────────────────────────────────────────┘
```

They are deliberately not redundant. The kernel layer is fast but stupid — it counts packets from an address and knows nothing about listeners. The server layer is precise but only sees a connection once it has been accepted and parsed, which costs something. The browser layer exists so that a refused listener is told what happened instead of staring at a page that never loads.

---

## 3. Per-IP limits

### What counts as one listener

A listener is **one `/audio` connection** — or, where `[kiwi_emulation]` is enabled, **one Kiwi sound connection**, which counts exactly the same. That is the same unit the user count, `users.json` and the labels on the waterfall already use, so a Kiwi client consumes a slot and appears in the user list just as a browser does.

This matters because a single desktop browser tab opens **four** sockets to your server:

| Socket | Purpose |
|---|---|
| `/audio` | the demodulated audio stream — **this is the listener** |
| `/waterfall` | the spectrum display |
| `/events` | user list, other listeners' frequencies |
| `/chat` | the chat panel |

A phone on `/mobile` opens two (`/audio` and `/chat`), because it has no waterfall. So a limit that counted raw sockets would refuse everybody: three tabs is twelve sockets.

### The three keys

```toml
[limits]
per_ip=3            # simultaneous listeners from one address
per_ip_sockets=0    # simultaneous sockets of any path; 0 derives per_ip * 4 + 4
per_ip_rate=40      # new sockets per minute from one address
per_ip_ban_s=600    # how long an address that breaks the rate is refused
```

**`per_ip`** is the headline number and the one you will think about. Three is a good starting point.

**`per_ip_sockets`** exists because `/audio` is not the only thing worth flooding. `/waterfall` is the heaviest stream your server produces, and a limit that counted only listeners could be sidestepped simply by opening waterfall sockets instead. Left at `0` it becomes `per_ip * 4 + 4`, which fits `per_ip` full desktop tabs with a little slack for sockets the kernel has not finished reaping after a page reload.

**`per_ip_rate`** is what actually ends a flood. A cap alone does not: refusing a connection is cheap but not free, and an attacker can keep reconnecting as fast as the refusals come back, burning your CPU on setup and teardown. The rate limit gives them a ban instead of an answer. Remember one tab costs four, so 40/minute is about ten page loads a minute from one address.

> **A deliberate ordering.** The rate is charged *before* the simultaneous cap is tested. This looks backwards until you consider an address already sitting at its cap and reconnecting in a loop: if the cheap "you are at the cap" refusal answered it every time, the rate violations would never accumulate and the ban that ends the loop would never trigger.

### Who is exempt

**Loopback is never limited.** The autorun spot-reporting tap, the admin panel and a browser opened on the server machine itself all arrive from `127.0.0.1`, and letting them consume slots would mean your own station locking out your listeners.

This also covers `proxy.py`: connections through the proxy reach `spectrumserver` from loopback, and the real client address arrives in the `X-Forwarded-For` header, which is what the limits are keyed on.

---

## 4. Idle connections

There is an attack that none of the above can see.

Open a TCP connection. Send nothing. Hold it.

Such a peer never completes a request, so it never reaches the code where the per-IP limits live — no listener exists, no client object exists, nothing has a name to count. Meanwhile it costs the attacker a few bytes and costs you a file descriptor and a slot for as long as it is held.

```toml
[limits]
idle_per_ip=8       # idle (pre-request) connections per address
idle_total=512      # ceiling across all addresses
```

The limit is on **how many**, not **how long**, and that distinction is the whole design. **There is no deadline on an idle connection, and deliberately so.** A deadline seems the obvious answer and is a trap (see [§10](#10-traps-worth-knowing-about)): there are legitimate peers that connect and then sit silent for a long time before speaking. What separates them from an attack is quantity — a legitimate peer holds one such connection, an attacker holds thousands.

An idle connection therefore lives until it makes a request or dies, and its slot is released either way.

`idle_total` bounds a flood spread across many source addresses. When the ceiling is reached, **new** idle connections are refused rather than established ones evicted, so a legitimate long-lived connection is never what gets dropped to make room.

Both are enforced at the moment the socket is accepted, using the peer address — there is no request yet, so there is no `X-Forwarded-For` to consult. That is fine: loopback is uncounted, which covers everything arriving through `proxy.py`, and a direct flood carries its own address.

---

## 5. The kernel guard

`setup-firewall.sh` installs an nftables table that sheds volume before `spectrumserver` ever reads a byte. It is deliberately blunt, and its numbers sit well above the ones in `config.toml`, so a normal listener can never be caught by both.

```bash
./setup-firewall.sh --show        # print the rules, change nothing
sudo ./setup-firewall.sh --check  # validate against your kernel
sudo ./setup-firewall.sh --apply  # load, with a 60-second auto-rollback
sudo ./setup-firewall.sh --persist # reload at boot
sudo ./setup-firewall.sh --status  # the per-rule packet counters
sudo ./setup-firewall.sh --remove  # undo all of it
```

It covers four things: a concurrent-connection ceiling per source address on your proxy and receiver ports, a new-connection rate per source, an SSH brute-force brake, and Windows file sharing closed to everything outside private address ranges — `smbd` listens on `0.0.0.0` on many machines, and whether that is reachable depends on a router the script cannot see.

Ports are read from `admin_config.json`, the same file `proxy.py` uses, so it follows your setup.

### Why it cannot lock you out

Two properties, both deliberate:

- The table's policy is **accept**, and it only ever drops specific named patterns. A rule that fails to match lets the packet through to whatever else you have configured. It cannot black-hole the machine.
- **Established connections are accepted in the very first rule.** The SSH session you are typing in is never affected by anything that follows.

On top of that, `--apply` arms an automatic rollback: load the rules, then confirm within 60 seconds or they are removed again. Say nothing, close the terminal, lose your connection — the ruleset disappears by itself.

Use that window properly. Check **from another device, off your own network** that the receiver still loads and that a *new* SSH session still opens. Testing with the session you already have proves nothing, because it was accepted by rule one.

---

## 6. Configuration reference

Every key below lives under `[limits]` in your `.toml` file. **All of them default to off or to generous values**, so a configuration that does not mention them behaves exactly as it always did.

| Key | Default | Meaning |
|---|---|---|
| `per_ip` | `0` (off) | Simultaneous listeners per address |
| `per_ip_sockets` | `0` → `per_ip * 4 + 4` | Simultaneous sockets of any path per address |
| `per_ip_rate` | `0` (off) | New sockets per minute per address |
| `per_ip_ban_s` | `600` | Seconds an address is refused after breaking the rate |
| `idle_per_ip` | `8` | Idle, pre-request connections per address |
| `idle_total` | `512` | Idle connections across all addresses |

Setting any key to `0` disables that particular check.

### The three that are not limits

`[limits]` also holds `audio`, `waterfall` and `events`, inherited from upstream PhantomSDR, and **none of the three is enforced.** `waterfall` and `events` are read by no code at all. `audio` is read in exactly one place: it is posted as `max_users` in the registration JSON sent to the directories in `[websdr] register_urls`, so it is the figure sdr-list.xyz and the others display, and it does nothing whatsoever when `register_online=false`. If you want a cap on listeners, `per_ip` above is the one that acts.

### One more, under `[server]`

```toml
[server]
min_client_version=0
```

Not a limit but a refusal, and it shares the same close code, so it belongs here. Pages announce the build they were loaded from as `/audio?v=N`, and anything below `min_client_version` is turned away with *"this page is out of date — please reload it"*.

It exists because the server cannot reach JavaScript that is already running in somebody's browser. A tab keeps the code it loaded until someone reloads it, so a change to the page only reaches listeners who happen to reload — and a station that has just changed how sessions behave may need the old pages gone now, not eventually.

Only `/audio` is checked, because that is the socket a session lives on, and loopback and the Kiwi paths are exempt so the autorun tap and Kiwi clients are untouched. `0` disables it and is the default. Leaving it on once the old pages have drained is fine: a current diversity client that is refused on a bare `/audio` retries with the marker, so what is still turned away is a diversity client on an older PhantomSDR-Plus build and any third-party tool that opens `/audio` without `?v=`. Set it back to `0` if another station reports that it can no longer use you as a diversity partner.

---

## 7. What a refused listener sees

### Nothing ever reconnects

Start here, because it governs everything else: **a dropped `/audio` socket ends the session.** There is no automatic reconnection, by design.

A reconnect is the right instinct for a chat application and the wrong one for a receiver. `/waterfall` and `/events` never came back with it, so a retried session was a live audio socket bolted to a frozen waterfall; and stopping the server no longer cleared it, because every listener was back a few seconds later, filling the user list with sessions nobody was really in. The page goes quiet and the listener loads it again — which is what this receiver did before a reconnect was ever added.

For the limits in this manual that also removes a trap: against a rate limit, an automatic retry would extend the very ban it was trying to get around.

### The two close codes

| Code | Meaning | Who sends it |
|---|---|---|
| **4003** | refused — over a per-IP limit, or the page is out of date | `spectrumserver` |
| **4001** | kicked by the sysop | `spectrumserver`, when the admin panel calls `/~~kick` |

Both are in the 4000–4999 private range, so neither can be confused with a protocol status, and both are treated as final by every page. The reason text travels in the close frame rather than as a message, because the first frame on `/audio` is reserved for the receiver's settings and anything sent ahead of it would break every normal connection.

### On the page

**Refused as the page loads** — the listener never gets going, so both pages explain themselves. The desktop shows a panel: *"This receiver refused the connection"*, the reason, and the note that everyone sharing an internet connection counts as one address. `/mobile` shows the same in its notice area.

**Refused or kicked mid-session** — the desktop page simply stops, deliberately without a message: the waterfall's draw loop halts and that is all. `/mobile` shows one line telling the listener to reload, except after a kick, where it too stays silent.

That silence after a kick is intentional. **Kicking is the sysop ending a session, not a punishment** — nothing is announced, and whoever wants back in loads the page again and is an ordinary listener one second later. The only thing the 4001 code buys is that the browser knows this was not a dropped connection, so the kick actually takes instead of undoing itself.

The kick is done by `spectrumserver` itself, not by `proxy.py`: listeners connect to the receiver's own port directly, so the proxy owns none of their sockets and its version of a kick reaches nobody. The panel calls `/~~kick?ip=&secs=`, which is loopback-only and checks the real TCP peer rather than `X-Forwarded-For`, that being client-supplied. `secs` defaults to zero — no ban — but it accepts a length if you do want the address kept out for a while, and that reuses the same ban machinery as `per_ip_rate` so the reconnect is refused at the door.

## 8. Reading the logs and counters

### The server

```bash
grep Refused spectrumserver.log
```

```
Refused /audio from 203.0.113.5: too many simultaneous connections
Refused /audio from 198.51.100.7: too many connection attempts
```

Nothing there means nobody is being turned away. Logging is throttled to at most one line per address every five seconds — without that, an attack would turn into unbounded disk writes, which is simply a slower way of taking the station down.

### The kernel

```bash
sudo ./setup-firewall.sh --status
```

Read the **`counter packets N`** on each rule; that is the number actually dropped. All zeros means nothing has been blocked and your thresholds are comfortably loose.

Do not be alarmed by the `elements = { ... }` lists in the sets above the rules. Those are your ordinary listeners being *tracked* against the limits — an entry appears on an address's first connection and ages out a couple of minutes later. Tracking is not blocking.

---

## 9. Choosing your numbers

Guessing is unnecessary; your own logs will tell you. This is the measurement that set `per_ip=3` here, run over a week of `logs/users_*.jsonl`:

| Concurrent sessions from one address | Number of addresses |
|---|---|
| 1 | 682 |
| 2 | 54 |
| 3 | 13 |
| more than 3 | **8** |

758 distinct addresses over seven days, and a limit of three would have touched eight of them. The flood sat at 181.

To repeat it on your own station, pair the session ids per address in `logs/users_*.jsonl` and take the maximum overlap. Note that the log records `tune` and `disconnect` events but has no `connect` event, so a session's start has to be inferred from its first `tune`.

**Remember NAT.** A club, a school, an office or a mobile carrier appears as a single address, and everyone behind it shares one allowance. This is inherent to any limit keyed on an address; the only mitigation is choosing a number you are comfortable with. If a listener ever reports being unable to connect, this is the first thing to suspect — check `grep Refused` before anything else.

---

## 10. Traps worth knowing about

### Never put a deadline on an idle connection

There is no `handshake_s` knob any more, and this is why. A 30-second deadline on idle connections looks like the obvious defence against a slowloris. It was built, switched on, and produced this within a minute:

```
Idle deadline: closed 1 connection(s) idle past 30s: 192.87.173.88
```

`192.87.173.88` is `etgd-websdr.ewi.utwente.nl` — **websdr.org's own callback host**. It connects back to your server and then sits idle, for well over 30 seconds, before sending its `GET /~~orgstatus`. The deadline cut it every time and registration stopped. The setting was removed rather than left as an option, because a footgun that breaks your directory listing is not worth the sixty lines that implement it.

**The same reasoning applies to websocketpp's `open_handshake_timeout`, which is still there.** The ten-minute value in `spectrumserver.cpp` looks absurd and is load-bearing: it is what allows the websdr.org callback to sit idle at all. There is a second reason too — the `/~~orgstatus` handler answers from a thread holding a `dup()` of the socket, and websocketpp ends a timed-out connection with `shutdown()`, a socket-level call that reaches through the duplicate and would break the callback even if the idle time were not an issue.

If you need to bound silent connections, bound their number, not their age. That is what `idle_per_ip` and `idle_total` are.

### An nftables file must be idempotent

`nft -f` **appends** to a table that already exists rather than replacing it. A ruleset file without a `delete table` prologue therefore doubles the entire chain every time it is reloaded — which is what a naive systemd unit does on every service restart. `setup-firewall.sh` generates the prologue for you; if you write your own rules, do the same.

```bash
sudo ./setup-firewall.sh --status | grep -c dport   # should be 8, not 16
```

---

## 11. Turning it all off

The server limits: set the keys to `0`, or delete them from your `.toml`, and restart the receiver. There is no other state; nothing persists across a restart.

The firewall:

```bash
sudo ./setup-firewall.sh --remove
```

That deletes the table, removes the saved ruleset and disables the boot service. Your machine returns to exactly the state it was in before — which, on most installations, means no firewall at all. That is worth thinking about before you remove it.
