# weekly-pace

A Claude Code plugin (weekly pace bars plus model/effort buttons above the prompt), distributed as a
marketplace from this repo and as a downloadable zip.

## Layout

- `.claude-plugin/marketplace.json`: repo root is the marketplace; it points at `./weekly-pace`.
- `weekly-pace/`: the plugin. Manifest in `.claude-plugin/plugin.json`, code in `hooks/register.tsx`
  (listed by `hooks/hooks.json`), tests in `tests/`, types in `types/`.
- `scripts/package.sh`: validates and builds `dist/weekly-pace-<version>.zip` from `HEAD`.
- `.gitattributes`: `export-ignore` decides what stays out of the zip.
- `.github/workflows/ci.yml`: validate and test on push/PR; a `v*` tag builds and publishes the zip.

## Commands

```bash
claude plugin validate .
claude plugin validate weekly-pace
claude plugin test weekly-pace
scripts/package.sh
```

## Rules

- Customizable constants (models, efforts, colors, cache TTL) live at the top of `hooks/register.tsx`;
  keep the README's Customize table in sync when they change.
- Bump a state atom's `shape` tag when the form of its stored value changes.
- Release: bump `version` in `weekly-pace/.claude-plugin/plugin.json`, add a `CHANGELOG.md` entry, push a
  matching `vX.Y.Z` tag. CI fails if the tag and version differ.
- Never commit `.DS_Store` or `dist/`.
