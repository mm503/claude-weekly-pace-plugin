#!/usr/bin/env bash
# Build dist/weekly-pace-<version>.zip: the plugin itself (plugin.json at
# <name>/.claude-plugin/), the form the desktop app's zip upload and
# `claude --plugin-dir` expect. Built from HEAD's weekly-pace/ folder.
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' weekly-pace/.claude-plugin/plugin.json)
[ -n "$version" ] || { echo "no version in plugin.json" >&2; exit 1; }

claude plugin validate .
claude plugin validate weekly-pace

name="weekly-pace-$version"
mkdir -p dist
git archive --format=zip --prefix="$name/" -o "dist/$name.zip" HEAD:weekly-pace
echo "dist/$name.zip"
