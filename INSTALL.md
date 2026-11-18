# weekly-pace: install instructions for Claude

Do this when the user asks you to install this plugin from this folder.

## From GitHub (preferred, once the repository is published)

Run `claude plugin install weekly-pace --marketplace mm503/weekly-pace`, or in the desktop app tell the
user: **+** next to the prompt box → **Plugins** → **Add marketplace** `mm503/weekly-pace` → **Add plugin**.

## From the downloaded zip or this folder (no GitHub)

The release zip (`weekly-pace-<version>.zip`) unpacks to a folder that is itself a marketplace.

1. Copy the unpacked folder to `~/.claude/local-marketplaces/weekly-pace-marketplace/` (replace an older copy there).
2. Run `claude plugin validate ~/.claude/local-marketplaces/weekly-pace-marketplace` and
   `claude plugin test ~/.claude/local-marketplaces/weekly-pace-marketplace/weekly-pace`. Both must pass;
   notices about a missing icon are optional.
3. Run `claude plugin marketplace add ~/.claude/local-marketplaces/weekly-pace-marketplace --scope user`.
4. Run `claude plugin install weekly-pace@weekly-pace --scope user`.
5. Tell the user to run `/reload-plugins` in open conversations; new ones load it by themselves.

The plugin is then read from that folder: after editing it, `/reload-plugins` picks the change up.

If an older install named `weekly-pace@local-mods` is present (`claude plugin list`), uninstall it first
with `claude plugin uninstall weekly-pace@local-mods --scope user` and remove that marketplace with
`claude plugin marketplace remove local-mods`, or the band draws twice.

See README.md for what it shows and how to customize it.
