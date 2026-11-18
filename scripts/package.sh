#!/usr/bin/env bash
# Build dist/weekly-pace-<version>.zip: the repo as a ready-to-add marketplace
# (marketplace.json at the root, plugin in ./weekly-pace). Contents follow
# .gitattributes export-ignore, so only tracked, shipped files are included.
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' weekly-pace/.claude-plugin/plugin.json)
[ -n "$version" ] || { echo "no version in plugin.json" >&2; exit 1; }

claude plugin validate .
claude plugin validate weekly-pace

name="weekly-pace-$version"
mkdir -p dist
git archive --format=zip --prefix="$name/" -o "dist/$name.zip" HEAD
echo "dist/$name.zip"
