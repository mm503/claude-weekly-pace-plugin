# Changelog

## 0.3.4

- README lists the slash commands the plugin runs and when.

## 0.3.3

- Fix install instructions: they named the wrong GitHub repository.
- Observer hooks on `/model` and `/effort` pass the event through if they fail.
- Remove `.gitattributes` export rules, which the plugin directory rejects.
- CI pins the Claude Code version and grants write access to the release job only.
- Tests call `/effort` with fully typed input instead of `as any`.

## 0.3.2

- Add the display name "Weekly Pace & Model Switcher".

## 0.3.1

- Fix the release zip: it now contains the plugin alone, so the desktop app's zip upload accepts it.

## 0.3.0 (withdrawn: its zip was a marketplace, which the desktop app's upload rejects)

- Add plugin icon and a desktop screenshot to the README.
- The repo root is the marketplace; a release workflow attaches a zip to GitHub releases.
- CI validates against the plugin directory's rules.
- Fix a test type error flagged by newer Claude Code validators.

## 0.2.0

- Initial public version: weekly pace bars and one-click model and effort switching.
