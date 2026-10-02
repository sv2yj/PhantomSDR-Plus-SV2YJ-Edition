#!/usr/bin/env python3
"""
fix_local_geo.py — One-time cleanup of PhantomSDR-Plus JSONL log files.

Finds every event where the IP is a local/private address and rewrites
the geo field to 'Local', removing the incorrect US geo that RFC-1918
ranges often resolve to in public geo databases.

Usage:
    python3 fix_local_geo.py              # dry-run — shows what would change
    python3 fix_local_geo.py --apply      # writes the corrected files

Reads logs from: <script_dir>/logs/users_YYYY-MM-DD.jsonl
A .bak backup is created for each file that is modified.
"""

import json
import sys
import os
import glob
import ipaddress
import shutil
from datetime import datetime, timezone

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def _find_log_dir():
    """Search upward from the script's location to find the logs/ directory."""
    cur = _SCRIPT_DIR
    for _ in range(6):   # at most 6 levels up
        candidate = os.path.join(cur, "logs")
        if os.path.isdir(candidate):
            return candidate
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    # Last resort: logs/ sibling of the script
    return os.path.join(_SCRIPT_DIR, "logs")

LOG_DIR = _find_log_dir()
DRY_RUN     = "--apply" not in sys.argv


def is_local_ip(ip):
    if not ip:
        return False
    raw = ip[7:] if ip.startswith("::ffff:") else ip
    try:
        addr = ipaddress.ip_address(raw)
        return addr.is_loopback or addr.is_private or addr.is_link_local
    except ValueError:
        return False


def fix_file(path):
    """Read a JSONL file, fix local-IP geo fields, return (lines_in, fixes, new_lines)."""
    original_lines = []
    fixed_lines    = []
    fixes          = 0

    with open(path, encoding="utf-8") as f:
        for lineno, raw in enumerate(f, 1):
            raw = raw.rstrip("\n")
            original_lines.append(raw)
            stripped = raw.strip()
            if not stripped:
                fixed_lines.append(raw)
                continue
            try:
                ev = json.loads(stripped)
            except json.JSONDecodeError:
                fixed_lines.append(raw)   # leave malformed lines untouched
                continue

            ip  = ev.get("ip",  "")
            geo = ev.get("geo", "")

            if is_local_ip(ip) and geo != "Local":
                ev["geo"] = "Local"
                fixed_lines.append(json.dumps(ev, ensure_ascii=False))
                fixes += 1
            else:
                fixed_lines.append(raw)

    return original_lines, fixes, fixed_lines


def main():
    files = sorted(glob.glob(os.path.join(LOG_DIR, "users_*.jsonl")))
    if not files:
        print(f"No log files found in {LOG_DIR}")
        sys.exit(1)

    mode = "DRY-RUN (no files written)" if DRY_RUN else "APPLY MODE — files will be rewritten"
    print(f"\n{'═'*60}")
    print(f"  fix_local_geo.py  ·  {mode}")
    print(f"  Log directory: {LOG_DIR}")
    print(f"{'═'*60}\n")

    total_files_changed = 0
    total_fixes         = 0

    for path in files:
        fname = os.path.basename(path)
        original_lines, fixes, fixed_lines = fix_file(path)

        if fixes == 0:
            print(f"  {fname}  —  no changes")
            continue

        total_fixes         += fixes
        total_files_changed += 1

        if DRY_RUN:
            print(f"  {fname}  —  {fixes} record(s) would be fixed")
        else:
            # Backup original
            bak = path + ".bak"
            shutil.copy2(path, bak)
            # Write corrected file
            with open(path, "w", encoding="utf-8") as f:
                f.write("\n".join(fixed_lines))
                if fixed_lines:
                    f.write("\n")
            print(f"  {fname}  —  {fixes} record(s) fixed  (backup: {os.path.basename(bak)})")

    print(f"\n{'─'*60}")
    print(f"  Files changed : {total_files_changed}")
    print(f"  Records fixed : {total_fixes}")
    if DRY_RUN and total_fixes > 0:
        print(f"\n  Run with --apply to write the changes.")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
