pragma ComponentBehavior: Bound

import QtQuick
import qs.Common
import qs.Widgets
import qs.Modules.Plugins
import "PresetCatalog.mjs" as PresetCatalog
import "SessionMath.mjs" as SessionMath

PluginSettings {
    id: root

    pluginId: "dankTimeLog"

    // The default presets live in the daemon; editing from an empty list without it would save over them.
    readonly property var timeLogDaemon: pluginService?.pluginDaemonInstances[pluginId] ?? null
    readonly property var presets: timeLogDaemon?.presets ?? []
    readonly property var activePresets: presets.filter(preset => !preset.isArchived)
    readonly property var archivedPresets: presets.filter(preset => preset.isArchived)
    // Archived presets cannot be running, so "now" only matters for active ones and the time of opening is enough.
    readonly property var trackedMillisecondsByPresetId: SessionMath.sumDurationsByPresetWithinRange(timeLogDaemon?.sessions ?? [], -Infinity, Infinity, Date.now())

    function savePresets(updatedPresets) {
        if (updatedPresets !== presets)
            saveValue("presets", updatedPresets);
    }

    function addTypedPreset() {
        const updatedPresets = PresetCatalog.addPreset(presets, newPresetNameField.text);
        if (updatedPresets === presets)
            return;
        newPresetNameField.text = "";
        savePresets(updatedPresets);
    }

    StyledText {
        width: parent.width
        text: I18n.trFor("dankTimeLog", "Presets")
        font.pixelSize: Theme.fontSizeLarge
        font.weight: Font.Bold
        color: Theme.surfaceText
    }

    StyledText {
        width: parent.width
        visible: root.timeLogDaemon === null
        text: I18n.trFor("dankTimeLog", "Enable the plugin to edit its presets.")
        font.pixelSize: Theme.fontSizeMedium
        color: Theme.surfaceVariantText
        wrapMode: Text.WordWrap
    }

    Column {
        width: parent.width
        visible: root.timeLogDaemon !== null
        spacing: Theme.spacingS

        Repeater {
            model: root.activePresets

            delegate: PresetEditorRow {
                required property var modelData

                width: parent.width
                preset: modelData
                presets: root.presets
                onPresetsEdited: updatedPresets => root.savePresets(updatedPresets)
            }
        }

        Row {
            width: parent.width
            spacing: Theme.spacingS

            DankTextField {
                id: newPresetNameField

                anchors.verticalCenter: parent.verticalCenter
                width: parent.width - addPresetButton.width - parent.spacing
                placeholderText: I18n.trFor("dankTimeLog", "New preset name")
                onAccepted: root.addTypedPreset()
            }

            DankButton {
                id: addPresetButton

                anchors.verticalCenter: parent.verticalCenter
                enabled: PresetCatalog.isDisplayNameAvailable(root.presets, newPresetNameField.text, null)
                text: I18n.trFor("dankTimeLog", "Add")
                iconName: "add"
                onClicked: root.addTypedPreset()
            }
        }
    }

    StyledText {
        width: parent.width
        visible: root.timeLogDaemon !== null && root.archivedPresets.length > 0
        text: I18n.trFor("dankTimeLog", "Archived")
        font.pixelSize: Theme.fontSizeMedium
        font.weight: Font.Medium
        color: Theme.surfaceText
    }

    StyledText {
        width: parent.width
        visible: root.timeLogDaemon !== null && root.archivedPresets.length > 0
        text: I18n.trFor("dankTimeLog", "Hidden from the start buttons; their history still shows in the chart.")
        font.pixelSize: Theme.fontSizeSmall
        color: Theme.surfaceVariantText
        wrapMode: Text.WordWrap
    }

    Column {
        width: parent.width
        visible: root.timeLogDaemon !== null
        spacing: Theme.spacingXS

        Repeater {
            model: root.archivedPresets

            delegate: ArchivedPresetRow {
                required property var modelData

                width: parent.width
                preset: modelData
                presets: root.presets
                trackedMilliseconds: root.trackedMillisecondsByPresetId[modelData.presetId] ?? 0
                onRestoreRequested: root.savePresets(PresetCatalog.setPresetArchived(root.presets, modelData.presetId, false))
                onDeleteRequested: root.timeLogDaemon.deleteArchivedPreset(modelData.presetId)
            }
        }
    }
}
