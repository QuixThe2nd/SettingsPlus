#!/bin/bash
# Double-click this on the mounted DMG (or run from Terminal). Clears Gatekeeper
# quarantine on the unsigned app bundle, then opens it — same idea as many
# third-party macOS installers that aren't Apple-notarized.

set -euo pipefail

VOL="$(cd "$(dirname "$0")" && pwd)"
APP="$VOL/SettingsPlus.app"

if [[ ! -d "$APP" ]]; then
  osascript \
    -e 'display dialog "Could not find SettingsPlus.app next to this file. Re-mount the disk image from your download." buttons {"OK"} default button "OK" with title "SettingsPlus"' \
    2>/dev/null || true
  exit 1
fi

echo "Clearing quarantine on SettingsPlus (xattr)…"
xattr -cr "$APP"

for COPY in "$HOME/Applications/SettingsPlus.app" "/Applications/SettingsPlus.app"; do
  if [[ -d "$COPY" ]]; then
    echo "Clearing quarantine on: $COPY"
    xattr -cr "$COPY" || true
  fi
done

open "$APP"
