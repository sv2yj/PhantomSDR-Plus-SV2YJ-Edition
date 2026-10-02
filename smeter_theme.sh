#!/bin/bash
# ---------------------------------------------------------------------------
# smeter_theme.sh - set the default analog S-meter face for ALL end users.
#
# The face theme lives in frontend/src/lib/SMeterAnalog.svelte and is persisted
# per browser in localStorage.smeterTheme. Changing the default alone only
# affects brand-new visitors, so this script also bumps SMETER_PREF_VERSION,
# which makes every existing browser forget its saved choice exactly once and
# adopt the new default. After that one wipe, clicking the meter persists
# normally again.
#
# After a successful edit it offers the same frontend-only path recompile.sh's
# "[2] Frontend only" gives: the default variant selection (smeter/layout, i.e.
# frontend/variant.json) followed by the build script choice ([1] build-all /
# [2] build-default / [3] build-mobile / [0] skip). The change reaches the
# served GUI only after that build. No backend build. Both steps can be
# skipped; the variant is left untouched unless you pick one.
#
#   ./smeter_theme.sh                 # report the current default, then pick one
#   ./smeter_theme.sh vintage         # set the default, then ask about rebuilding
#   ./smeter_theme.sh dark --build    # run build-all.sh without asking
#   ./smeter_theme.sh dark --no-build # skip the rebuild and the question
#   ./smeter_theme.sh amber --no-reset  # new visitors only, leave users alone
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT/frontend/src/lib/SMeterAnalog.svelte"

USAGE="usage: ./smeter_theme.sh [dark|amber|vintage] [--build|--no-build] [--no-reset]"

THEME=""
DO_BUILD=ask          # ask | yes | no
DO_RESET=1

for arg in "$@"; do
  case "$arg" in
    dark|amber|vintage) THEME="$arg" ;;
    --build|-b)         DO_BUILD=yes ;;
    --no-build)         DO_BUILD=no ;;
    --no-reset)         DO_RESET=0 ;;
    -h|--help)
      sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "smeter_theme.sh: unknown argument '$arg'" >&2
      echo "$USAGE" >&2
      exit 2 ;;
  esac
done

[ -f "$SRC" ] || { echo "smeter_theme.sh: not found: $SRC" >&2; exit 1; }

current_theme() { grep -oP "^let smeterTheme = '\K[a-z]+" "$SRC"; }
current_ver()   { grep -oP "^const SMETER_PREF_VERSION = \K[0-9]+" "$SRC"; }

CUR_THEME="$(current_theme || true)"
CUR_VER="$(current_ver || true)"

if [ -z "$CUR_THEME" ] || [ -z "$CUR_VER" ]; then
  echo "smeter_theme.sh: could not locate the theme default or the pref version" >&2
  echo "  in $SRC - the file layout may have changed." >&2
  exit 1
fi

# Human-readable names for the three faces, in click-cycle order.
THEMES=(dark amber vintage)
blurb() {
  case "$1" in
    dark)    echo "original dark brushed metal" ;;
    amber)   echo "light, pale grey face" ;;
    vintage) echo "warm aged-amber face" ;;
    *)       echo "unknown face" ;;
  esac
}
describe() { printf '%-7s - %s' "$1" "$(blurb "$1")"; }

# Always report where things stand before changing anything.
echo "Analog S-meter default face : $CUR_THEME  ($(blurb "$CUR_THEME"))"
echo "Reset version (localStorage): $CUR_VER"
echo

# No theme on the command line: offer the menu, or just report if there is no
# terminal to ask on.
if [ -z "$THEME" ]; then
  if [ ! -t 0 ]; then
    echo "$USAGE"
    exit 0
  fi

  echo "Select the default face for ALL end users:"
  echo
  i=1
  for t in "${THEMES[@]}"; do
    mark="  "
    [ "$t" = "$CUR_THEME" ] && mark=" *"
    echo "  [$i]$mark $(describe "$t")"
    i=$((i + 1))
  done
  echo "  [0]    keep the current default and exit"
  echo
  echo "  (* = current default)"
  echo

  read -r -p "Select an option [0-3]: " choice || choice=0
  case "$choice" in
    1) THEME="${THEMES[0]}" ;;
    2) THEME="${THEMES[1]}" ;;
    3) THEME="${THEMES[2]}" ;;
    0|'') echo "Unchanged. Nothing written."; exit 0 ;;
    *) echo "Invalid option. Nothing written." >&2; exit 2 ;;
  esac
  echo
fi

if [ "$THEME" = "$CUR_THEME" ] && [ "$DO_RESET" -eq 0 ]; then
  echo "Default is already '$THEME' and --no-reset was given; nothing to do."
  exit 0
fi

NEW_VER="$CUR_VER"
[ "$DO_RESET" -eq 1 ] && NEW_VER=$((CUR_VER + 1))

cp -p "$SRC" "$SRC.bak"

perl -0777 -pi -e "
  # 1. the default face for browsers with no saved choice
  s/^let smeterTheme = '[a-z]+';/let smeterTheme = '$THEME';/m;

  # 2. the one-time reset counter (only ever goes up)
  s/^const SMETER_PREF_VERSION = [0-9]+;/const SMETER_PREF_VERSION = $NEW_VER;/m;

  # 3. the original reset only cleared a saved *amber* choice; generalise it
  #    once so any saved value is dropped when the version advances.
  s/\Qif (localStorage.getItem('smeterTheme') === 'amber') {\E\s*\QlocalStorage.removeItem('smeterTheme');\E\s*\}/localStorage.removeItem('smeterTheme');/;

  # 4. keep the comment above the counter truthful (it used to describe the
  #    amber-only reset). Rewritten every run so it names the current default.
  s{^// One-time reset:.*?\n(?=const SMETER_PREF_VERSION)}
   {// One-time reset: bump SMETER_PREF_VERSION (via ./smeter_theme.sh) to make\n// every browser forget its saved face ONCE, so the '$THEME' default above takes\n// over. The reset runs only while the stored version is behind; afterwards the\n// click-toggle persists normally again. Managed by smeter_theme.sh.\n}sm;
" "$SRC"

# Verify the edits actually landed before declaring success.
AFT_THEME="$(current_theme || true)"
AFT_VER="$(current_ver || true)"
if [ "$AFT_THEME" != "$THEME" ] || [ "$AFT_VER" != "$NEW_VER" ]; then
  echo "smeter_theme.sh: edit failed to apply - restoring $SRC from backup" >&2
  mv -f "$SRC.bak" "$SRC"
  exit 1
fi
rm -f "$SRC.bak"

echo "Analog S-meter default face : $CUR_THEME -> $AFT_THEME"
if [ "$DO_RESET" -eq 1 ]; then
  echo "Reset version               : $CUR_VER -> $AFT_VER  (all browsers adopt it once)"
else
  echo "Reset version               : $AFT_VER (unchanged; new visitors only)"
fi
echo "Edited                      : $SRC"

# --- rebuild --------------------------------------------------------------
# The edit is source-only; it reaches the served frontend only after a rebuild.
# This is a frontend-only change, so the steps below reproduce recompile.sh's
# "[2] Frontend only" path - variant selection, then the build script menu -
# without going through ./recompile.sh itself (no backend, no directory
# prompt). Unlike recompile.sh, the variant step here can be skipped, so the
# S-meter face can be changed without disturbing frontend/variant.json.
VARIANT_JSON="$ROOT/frontend/variant.json"

# recompile.sh's select_default_app, with a [0] that leaves variant.json alone.
select_variant() {
  local cur_smeter="" cur_layout="" cur_desc="not set"
  if [ -f "$VARIANT_JSON" ]; then
    cur_smeter="$(grep -oP '"smeter"\s*:\s*"\K[a-z0-9]+' "$VARIANT_JSON" || true)"
    cur_layout="$(grep -oP '"layout"\s*:\s*"\K[a-z0-9]+' "$VARIANT_JSON" || true)"
    [ -n "$cur_smeter" ] && cur_desc="smeter=$cur_smeter, layout=$cur_layout"
  fi

  echo "=========================================="
  echo "Select Default Variant"
  echo "=========================================="
  echo
  echo "Which version should a first-time visitor see?"
  echo "Current: $cur_desc"
  echo
  echo "  [1] Analog S-Meter      (smeter=analog,  layout=v1)"
  echo "  [2] Digital S-Meter     (smeter=digital, layout=v1)"
  echo "  [3] V2 Analog S-Meter   (smeter=analog,  layout=v2)"
  echo "  [4] V2 Digital S-Meter  (smeter=digital, layout=v2)"
  echo "  [0] Keep the current variant (leave variant.json untouched)"
  echo
  echo "  Note: the variant is the S-meter TYPE and page layout - a different"
  echo "        setting from the analog meter FACE this script just changed."
  echo "        The three faces only exist on the analog S-meter."
  echo

  local vc smeter layout name
  read -r -p "Select default variant [0-4]: " vc || vc=0
  case "$vc" in
    1) name="Analog S-Meter";     smeter="analog";  layout="v1" ;;
    2) name="Digital S-Meter";    smeter="digital"; layout="v1" ;;
    3) name="V2 Analog S-Meter";  smeter="analog";  layout="v2" ;;
    4) name="V2 Digital S-Meter"; smeter="digital"; layout="v2" ;;
    0|'') echo "Variant unchanged."; return 0 ;;
    *) echo "Invalid option. Variant unchanged."; return 0 ;;
  esac

  cat > "$VARIANT_JSON" << EOF
{
  "smeter": "$smeter",
  "layout": "$layout"
}
EOF
  echo "✅ Default variant set to $name (smeter=$smeter, layout=$layout)"
  echo "   This is the STARTING variant: what a first-time visitor gets."
  echo "   The ⚙️ menu lets each visitor switch, and their choice is kept"
  echo "   in that browser (localStorage 'phantom.variant') from then on."
}

BUILDER=""            # build script to run, relative to frontend/

echo

if [ "$DO_BUILD" = ask ]; then
  if [ -t 0 ]; then
    select_variant
    echo
    echo "=========================================="
    echo "Frontend Build Options"
    echo "=========================================="
    echo
    echo "Rebuild the frontend now?  (select which build script to run)"
    echo
    echo "  [1] build-all.sh     - desktop page + /mobile   (recommended)"
    echo "  [2] build-default.sh - desktop page only"
    echo "  [3] build-mobile.sh  - /mobile only"
    echo "  [0] Skip the rebuild"
    echo
    echo "  Note: [2] lets vite empty dist/, which removes dist/mobile until the"
    echo "        next [1] or [3].  The analog S-meter lives on the desktop page,"
    echo "        so [3] alone will NOT pick up this change."
    echo
    read -r -p "Select an option [0-3]: " build_option || build_option=0
    case "$build_option" in
      1) BUILDER="build-all.sh" ;;
      2) BUILDER="build-default.sh" ;;
      3) BUILDER="build-mobile.sh" ;;
      0|'') BUILDER="" ;;
      *) echo "Invalid option. Skipping the rebuild."; BUILDER="" ;;
    esac
    [ -n "$BUILDER" ] && DO_BUILD=yes || DO_BUILD=no
  else
    # No terminal to ask on (cron, pipe, CI) - never build unasked.
    DO_BUILD=no
  fi
elif [ "$DO_BUILD" = yes ]; then
  # --build is non-interactive: always the recommended full frontend build.
  BUILDER="build-all.sh"
fi

if [ "$DO_BUILD" = yes ]; then
  if [ ! -x "$ROOT/frontend/$BUILDER" ]; then
    echo "smeter_theme.sh: frontend/$BUILDER not found or not executable" >&2
    echo "The source edit is done; rebuild by hand (./recompile.sh)." >&2
    exit 1
  fi
  cd "$ROOT/frontend"
  echo
  echo "Updating npm dependencies..."
  npm install || echo "⚠️  npm install had issues, but continuing..."
  echo
  echo "=========================================="
  echo "Running $BUILDER"
  echo "=========================================="
  exec "./$BUILDER"
else
  echo "Not rebuilt. The change reaches the GUI only after a frontend build:"
  echo "  cd frontend && ./build-all.sh      (or ./recompile.sh -> [2] Frontend only)"
fi
