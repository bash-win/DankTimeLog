pragma ComponentBehavior: Bound

import QtQuick
import qs.Common
import qs.Widgets
import "PresetCatalog.mjs" as PresetCatalog

Column {
    id: root

    property var presets: []
    property string runningPresetId: ""

    signal presetStartRequested(string presetId)
    signal presetAddRequested(string displayName)

    readonly property int kNewPresetNameFieldWidthPixels: 150
    readonly property int kMaximumVisibleButtonRowCount: 3
    // Half of the next row stays visible so the cut shows there are more presets to scroll to.
    readonly property real kPeekingRowFraction: 0.5

    readonly property var activePresets: presets.filter(preset => !preset.isArchived)
    readonly property real maximumPresetButtonsHeight: (kMaximumVisibleButtonRowCount + kPeekingRowFraction) * addPresetButton.height + kMaximumVisibleButtonRowCount * spacing

    property bool isAddingPreset: false
    readonly property bool isTypedNameAvailable: PresetCatalog.isDisplayNameAvailable(presets, newPresetNameField.text, null)

    function startAddingPreset() {
        isAddingPreset = true;
        newPresetNameField.forceActiveFocus();
    }

    function stopAddingPreset() {
        isAddingPreset = false;
        newPresetNameField.text = "";
    }

    function addTypedPreset() {
        if (!isTypedNameAvailable)
            return;
        presetAddRequested(newPresetNameField.text);
        stopAddingPreset();
    }

    spacing: Theme.spacingS

    DankFlickable {
        width: parent.width
        visible: root.activePresets.length > 0
        implicitHeight: Math.min(presetButtonsFlow.implicitHeight, root.maximumPresetButtonsHeight)
        contentHeight: presetButtonsFlow.implicitHeight
        clip: true

        Flow {
            id: presetButtonsFlow

            width: root.width
            spacing: root.spacing

            Repeater {
                model: root.activePresets

                delegate: PresetStartButton {
                    required property var modelData

                    preset: modelData
                    isRunningPreset: modelData.presetId === root.runningPresetId
                    maximumWidth: root.width
                    onClicked: root.presetStartRequested(modelData.presetId)
                }
            }
        }
    }

    // Outside the scrolling area so adding a preset is always one click away, however many there are.
    Row {
        spacing: root.spacing

        DankButton {
            id: addPresetButton

            visible: !root.isAddingPreset
            iconName: "add"
            backgroundColor: Theme.surfaceContainerHigh
            textColor: Theme.surfaceText
            onClicked: root.startAddingPreset()
        }

        DankTextField {
            id: newPresetNameField

            visible: root.isAddingPreset
            width: root.kNewPresetNameFieldWidthPixels
            placeholderText: I18n.trFor("dankTimeLog", "New preset")
            onAccepted: root.addTypedPreset()
            Keys.onEscapePressed: event => {
                root.stopAddingPreset();
                event.accepted = true;
            }
        }

        DankButton {
            visible: root.isAddingPreset
            enabled: root.isTypedNameAvailable
            iconName: "check"
            backgroundColor: Theme.surfaceContainerHigh
            textColor: Theme.surfaceText
            onClicked: root.addTypedPreset()
        }
    }
}
