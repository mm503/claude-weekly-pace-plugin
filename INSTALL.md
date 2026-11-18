# weekly-pace: install instructions for Claude

Do this when the user asks you to install this plugin from this folder.

## From GitHub (preferred, once the repository is published)

Run `claude plugin install weekly-pace --marketplace mm503/weekly-pace`, or in the desktop app tell the
user: **+** next to the prompt box → **Plugins** → **Add marketplace** `mm503/weekly-pace` → **Add plugin**.

## From the downloaded zip (no GitHub)

The release zip (`weekly-pace-<version>.zip`) holds the plugin itself, not a marketplace.

- Desktop app: **+** next to the prompt box → **Plugins** → upload the zip.
- Terminal, for one session: `claude --plugin-dir weekly-pace-<version>.zip`.

## From a clone of this repository

The repository root is a marketplace:

1. Run `claude plugin validate <clone>` and `claude plugin test <clone>/weekly-pace`.
2. Run `claude plugin marketplace add <clone> --scope user`.
3. Run `claude plugin install weekly-pace@weekly-pace --scope user`, then `/reload-plugins` in open conversations.

If an older install named `weekly-pace@local-mods` is present (`claude plugin list`), uninstall it first
with `claude plugin uninstall weekly-pace@local-mods --scope user` and remove that marketplace with
`claude plugin marketplace remove local-mods`, or the band draws twice.

See README.md for what it shows and how to customize it.
