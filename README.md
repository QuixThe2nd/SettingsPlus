# SettingsPlus

SettingsPlus is a small macOS desktop app (Electron + React) that lists curated **defaults**, **pmset**, **networksetup**, **scutil**, **systemsetup**, **mdutil**, and **softwareupdate** commands, previews the shell lines, and runs them on your machine. Some actions require an administrator password (via a standard macOS prompt).

**Requirements:** macOS. The app is not useful on other platforms; the main process exits on startup unless you set `SETTINGSPLUS_ALLOW_NON_DARWIN` (see below).

## About this repo

This project is **100% AI-generated**—one of those “someday I’ll build this” ideas that sat in the backlog until I had an assistant crank out a working version. Treat it as a scratchpad / experiment, not a statement of craftsmanship or a promise of maintenance.

## Disclaimer

This software can change system and user preferences, restart UI services, log you out, or reboot your Mac when you ask it to. You are responsible for what you run. There is no warranty; see [LICENSE](LICENSE).

## Development

```bash
npm ci
npm run dev
```

- **Typecheck:** `npm run typecheck`
- **Unit tests:** `npm run test`
- **Production bundle (no installer):** `npm run build`
- **Packaged app (unsigned OK for local use):** `npm run dist` writes `release/mac-<arch>/SettingsPlus.app` (see [electron-builder.yml](electron-builder.yml)). For sharing publicly, configure Apple **Developer ID** signing and **notarization** (see [Electron code signing](https://www.electron.build/code-signing)). DMG/zip targets can be re-enabled once a `python` shim is available for blockmap tooling, if you need auto-update metadata.

### Non-macOS guard

For limited UI work on another OS, you can bypass the platform check (commands will still not match a real macOS environment):

```bash
SETTINGSPLUS_ALLOW_NON_DARWIN=1 npm run dev
```

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
