# Security policy

## Supported versions

Only the latest release on the default branch is actively reviewed for security issues. Use current `main` or the newest tagged release.

## Reporting a vulnerability

Please report security-sensitive issues privately so we can fix them before they are widely known.

- If this repository is hosted on GitHub: use [Security advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) for the project, or contact the maintainers through a private channel they publish in the README.

Include:

- A short description of the issue and its impact
- Steps to reproduce (commands, UI flow, affected setting id)
- Your environment (macOS version, app version or commit)

## Scope notes

SettingsPlus runs shell commands on your Mac, including with administrator privileges when required. Treat it like a powerful local admin tool: only install builds you trust, and keep your system and Electron runtime up to date.
