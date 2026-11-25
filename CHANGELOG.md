# Changelog

## 0.4.0

- The week time and usage bars are one row: usage in orange, then the gap to the week's elapsed time
  in green (room to spare) or red (spending ahead), with `used% / time%` beside it. The band is a
  line shorter.
- `TIME_FILL` is gone; `HEADROOM_FILL` and `OVER_FILL` color the gap.
- On plans with a 5-hour window, a second `5h` row shows it the same way, while a window is open.
- Model buttons run weakest to strongest: Haiku, Sonnet, Opus, Fable.

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
