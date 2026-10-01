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

# Quickshell resolves `import qs.*` from the running shell's directory tree and only writes qmldir
# files for the config it is running, so lint gets its own qmldir tree over the installed DMS sources.
dmsShellDirectory=${DMS_SHELL_DIR:-/usr/share/quickshell/dms}
lintImportsDirectory=.lint-imports
lintImportsStampFile=$lintImportsDirectory/dms-version
dmsVersion="$dmsShellDirectory $(cat "$dmsShellDirectory/VERSION" 2>/dev/null)"

buildLintImports() {
    rm -rf "$lintImportsDirectory"
    while IFS= read -r dmsSourceDirectory; do
        relativeDirectory=${dmsSourceDirectory#"$dmsShellDirectory"}
        relativeDirectory=${relativeDirectory#/}
        stubDirectory=$lintImportsDirectory/qs/$relativeDirectory
        mkdir -p "$stubDirectory"
        {
            echo "module qs${relativeDirectory:+.${relativeDirectory//\//.}}"
            for dmsSourceFile in "$dmsSourceDirectory"/*; do
                [ -f "$dmsSourceFile" ] || continue
                ln -s "$dmsSourceFile" "$stubDirectory/"
                fileName=$(basename "$dmsSourceFile")
                case $fileName in
                [A-Z]*.qml)
                    if grep -q '^pragma Singleton' "$dmsSourceFile"; then
                        echo "singleton ${fileName%.qml} 1.0 $fileName"
                    else
                        echo "${fileName%.qml} 1.0 $fileName"
                    fi
                    ;;
                esac
            done
        } >"$stubDirectory/qmldir"
    done < <(find "$dmsShellDirectory" -type d -not -path '*/PLUGINS*' -not -path '*/.git*')
    echo "$dmsVersion" >"$lintImportsStampFile"
}
if [ "$(cat "$lintImportsStampFile" 2>/dev/null)" != "$dmsVersion" ]; then
    buildLintImports
fi

# On .mjs files qmllint only catches syntax errors.
"$qmllintBinary" --max-warnings 0 -I "$lintImportsDirectory" "${qmlFiles[@]}" "${moduleFiles[@]}"

node --test 'tests/*.test.mjs'
