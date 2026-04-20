#!/bin/bash
# Double-click on the mounted DMG: copies SettingsPlus into /Applications, strips
# quarantine (xattr), then launches the installed copy.

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
SRC="$SCRIPT_DIR/SettingsPlus.app"
DEST="/Applications/SettingsPlus.app"

if [[ ! -d "$SRC" ]]; then
  osascript \
    -e 'display dialog "Could not find SettingsPlus.app on this disk image. Re-mount the DMG from your download." buttons {"OK"} default button "OK" with title "SettingsPlus"' \
    2>/dev/null || true
  exit 1
fi

# Escape single quotes for embedding inside AppleScript / sh single-quoted segments
sh_quote() {
  printf "%s" "$1" | sed "s/'/'\\\\''/g"
}

run_install() {
  rm -rf "$DEST"
  ditto "$SRC" "$DEST"
  xattr -cr "$DEST"
}

if run_install 2>/dev/null; then
  :
else
  SQ_SRC=$(sh_quote "$SRC")
  SQ_DEST=$(sh_quote "$DEST")
  if ! osascript -e "do shell script \"rm -rf '${SQ_DEST}' && ditto '${SQ_SRC}' '${SQ_DEST}' && xattr -cr '${SQ_DEST}'\" with administrator privileges" 2>/dev/null; then
    osascript \
      -e 'display dialog "Could not copy to /Applications. Drag SettingsPlus.app into Applications yourself, then in Terminal run: xattr -cr /Applications/SettingsPlus.app" buttons {"OK"} default button "OK" with title "SettingsPlus"' \
      2>/dev/null || true
    exit 1
  fi
fi

open "$DEST"
