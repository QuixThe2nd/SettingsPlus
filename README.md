# SettingsPlus

SettingsPlus is a small macOS desktop app (Electron + React) that lists curated **defaults**, **pmset**, **networksetup**, **scutil**, **systemsetup**, **mdutil**, and **softwareupdate** commands, previews the shell lines, and runs them on your machine. Some actions require an administrator password (via a standard macOS prompt).

**Requirements:** macOS. The app is not useful on other platforms; the main process exits on startup unless you set `SETTINGSPLUS_ALLOW_NON_DARWIN` (see below).

## About this repo

This project is **100% AI-generated**—one of those “someday I’ll build this” ideas that sat in the backlog until I had an assistant crank out a working version. Treat it as a scratchpad / experiment, not a statement of craftsmanship or a promise of maintenance.

## Screenshots

Browse the catalog and empty inspector when nothing is selected:

![SettingsPlus main window — list and inspector](docs/screenshots/overview.png)

Inspector with preview, parameters, and toolbar batch apply:

![SettingsPlus — setting detail and Apply pending](docs/screenshots/detail.png)

*(Images are stylized README previews, not guaranteed pixel-perfect to your local build.)*

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
- **Packaged app (unsigned OK for local use):** `npm run dist` writes `release/mac-<arch>/SettingsPlus.app` (see [electron-builder.yml](electron-builder.yml)). For sharing publicly, configure Apple **Developer ID** signing and **notarization** (see [Electron code signing](https://www.electron.build/code-signing)).

### Where are the builds?

Two different places on GitHub—easy to mix up:

1. **Actions → workflow run → Artifacts** (zip download at the bottom of a run).  
   On every push to `main` / `master`, [`.github/workflows/macos-dmg.yml`](.github/workflows/macos-dmg.yml) builds three **unsigned** DMGs (Apple Silicon `arm64`, Intel `x64`, **universal**) and uploads them as **`SettingsPlus-dmgs-*`** artifacts. Nothing is posted to the **Releases** tab from this workflow.

2. **Releases** (what the in-app “newer version” check uses).  
   GitHub’s API only lists **published releases**. Those are created by [`.github/workflows/release-github.yml`](.github/workflows/release-github.yml) when you push a **version tag** whose name starts with `v`:

   ```bash
   # After bumping "version" in package.json and committing:
   git tag v0.1.1
   git push origin v0.1.1
   ```

   That run builds the same three DMGs and attaches them to a new release for that tag (via `softprops/action-gh-release`).

Packaging uses [electron-builder.workflow.yml](electron-builder.workflow.yml) in CI (DMG only). Local `npm run dist` still uses the `dir` target from [electron-builder.yml](electron-builder.yml).

### Non-macOS guard

For limited UI work on another OS, you can bypass the platform check (commands will still not match a real macOS environment):

```bash
SETTINGSPLUS_ALLOW_NON_DARWIN=1 npm run dev
```

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
