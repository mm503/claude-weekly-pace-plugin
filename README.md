# weekly-pace

A Claude Code plugin that shows, above the prompt, whether you are spending your weekly usage faster
than the week is passing, and lets you switch model and effort in one click.

```
Week time   [■■■■■■·······························]   9%
Week usage  [■■■··································]   6%  on pace

 Fable  Opus  Sonnet  Haiku  │  low  medium  high  xhigh  max  │  warm 42m
```

- **Week time** (blue): how far you are through your weekly limit window.
- **Week usage** (orange): how much of the weekly all-models limit you have used, with a verdict:
  `+N over` (red, spending ahead of the week), `N under` (green) or `on pace` (within 5 points).
- **Model and effort buttons**: one click runs `/model` or `/effort`; the active ones are highlighted,
  including changes you type yourself.
- **warm Nm / cold**: whether the current model's prompt cache is likely still warm, and for how long.

It works in the Claude desktop app (Code tab), the terminal and the IDE extensions. Usage figures need
a Claude subscription (Pro or Max); without one, only the buttons show.

## Install

### Claude desktop app

1. Click **+** next to the prompt box, then **Plugins**.
2. Choose **Add marketplace** and enter `mm503/weekly-pace`.
3. Find **weekly-pace** in the list and choose **Add plugin**.

### Terminal

At the Claude Code prompt:

```
/plugin install weekly-pace --marketplace mm503/weekly-pace
```

Or from a shell:

```bash
claude plugin install weekly-pace --marketplace mm503/weekly-pace
```

New conversations load it by themselves; in one already open, run `/reload-plugins`.

### From a zip

Download `weekly-pace-<version>.zip` from the
[Releases](https://github.com/mm503/weekly-pace/releases) page, unpack it, then:

```bash
claude plugin marketplace add ./weekly-pace-<version> --scope user
claude plugin install weekly-pace@weekly-pace --scope user
```

### Uninstall

```bash
claude plugin uninstall weekly-pace@weekly-pace
```

## How it works

- Usage comes from the weekly (`seven_day`) rate-limit reading Claude Code receives with each response.
  The plugin saves the last reading, so a new conversation shows the bars straight away; the first
  response replaces them with live figures. After the weekly reset the bars start over at 0%.
- Week time is computed from the reset time: the window is the 7 days before it.
- Warm/cold is an estimate: the time of the last response on the current model against a 60-minute
  cache lifetime. Each model keeps its own cache, so switching models shows `cold` until it answers.
- The band redraws every 30 seconds, so the time bar and the countdown keep moving between turns.

## Customize

Everything is at the top of `weekly-pace/hooks/register.tsx`:

| Constant | What it sets |
| --- | --- |
| `CACHE_TTL_MS` | Prompt-cache lifetime (60 min). Use `5 * 60 * 1000` if your cache lasts 5 minutes. |
| `MODELS` | The model buttons: a label and the id passed to `/model`. Update when models change. |
| `EFFORTS` | The effort buttons. |
| `TRACK` | The empty part of the bars, `#454545`, matched to the desktop app's dark theme. Pick a lighter gray if you use a light theme. |
| `TIME_FILL`, `USAGE_FILL` | The fill colors, as theme keys so they follow light and dark themes. |

## Develop

```bash
claude plugin validate .
claude plugin test weekly-pace
scripts/package.sh   # builds dist/weekly-pace-<version>.zip
```

To release: bump `version` in `weekly-pace/.claude-plugin/plugin.json`, add a `CHANGELOG.md` entry, then
push a matching tag (`git tag v0.2.0 && git push --tags`). CI validates, builds the zip and attaches it
to a GitHub release.

## License

MIT
