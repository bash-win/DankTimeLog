#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Fedora installs the Qt 6 tools with a -qt6 suffix.
qmlformatBinary=$(command -v qmlformat-qt6 || command -v qmlformat)
qmllintBinary=$(command -v qmllint-qt6 || command -v qmllint)

mapfile -t qmlFiles < <(git ls-files --cached --others --exclude-standard '*.qml')
mapfile -t moduleFiles < <(git ls-files --cached --others --exclude-standard '*.mjs')

# Only .qml: qmlformat 6.11 mangles indentation in some JS files and then reports the result as formatted.
unformattedFileCount=0
for qmlFile in "${qmlFiles[@]}"; do
    if ! "$qmlformatBinary" "$qmlFile" | diff -q "$qmlFile" - >/dev/null; then
        echo "needs formatting: $qmlFile"
        unformattedFileCount=$((unformattedFileCount + 1))
    fi
done
if [ "$unformattedFileCount" -ne 0 ]; then
    echo "run: $qmlformatBinary -i <file>"
    exit 1
fi

# On .mjs files qmllint only catches syntax errors.
"$qmllintBinary" "${qmlFiles[@]}" "${moduleFiles[@]}"

node --test 'tests/*.test.mjs'
