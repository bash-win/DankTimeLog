import QtQuick
import qs.Common
import qs.Services
import qs.Widgets
import "PresetCatalog.mjs" as PresetCatalog

Column {
    id: root

    property var preset: null
    property var presets: []

    signal presetsEdited(var updatedPresets)

    readonly property int kColorSwatchSizePixels: 28
    readonly property int kIconPickerWidthPixels: 150

    readonly property color presetColor: PresetCatalog.resolvePresetColor(preset, Theme.primary)
    readonly property bool isTypedNameAvailable: PresetCatalog.isDisplayNameAvailable(presets, nameField.text, preset.presetId)

    // A rejected rename reverts the field; an accepted one rebuilds this row from the saved presets.
    function commitTypedName() {
        const updatedPresets = PresetCatalog.renamePreset(presets, preset.presetId, nameField.text);
        if (updatedPresets === presets) {
            nameField.text = preset.displayName;
            return;
        }
        presetsEdited(updatedPresets);
    }

    function openColorPicker() {
        const colorPickerModal = PopoutService.colorPickerModal;
        if (!colorPickerModal)
            return;
        colorPickerModal.selectedColor = presetColor;
        colorPickerModal.pickerTitle = I18n.trFor("dankTimeLog", "%1 color").arg(preset.displayName);
        colorPickerModal.onColorSelectedCallback = selectedColor => presetsEdited(PresetCatalog.setPresetColorHex(presets, preset.presetId, selectedColor.toString()));
        colorPickerModal.show();
    }

    spacing: Theme.spacingXS

    Row {
        width: parent.width
        spacing: Theme.spacingS

        DankColorSwatch {
            anchors.verticalCenter: parent.verticalCenter
            width: root.kColorSwatchSizePixels
            height: root.kColorSwatchSizePixels
            swatchColor: root.presetColor

            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: root.openColorPicker()
            }
        }

        DankIconPicker {
            anchors.verticalCenter: parent.verticalCenter
            width: root.kIconPickerWidthPixels
            currentIcon: root.preset.iconName
            onIconSelected: (iconName, iconType) => root.presetsEdited(PresetCatalog.setPresetIconName(root.presets, root.preset.presetId, iconName))
        }

        DankTextField {
            id: nameField

            anchors.verticalCenter: parent.verticalCenter
            width: parent.width - x - resetColorButton.width - archiveButton.width - parent.spacing * 2
            text: root.preset.displayName
            placeholderText: I18n.trFor("dankTimeLog", "Name")
            onEditingFinished: root.commitTypedName()
        }

        DankActionButton {
            id: resetColorButton

            anchors.verticalCenter: parent.verticalCenter
            enabled: root.preset.colorHex !== ""
            opacity: enabled ? 1 : 0
            iconName: "format_color_reset"
            tooltipText: I18n.trFor("dankTimeLog", "Use theme accent")
            onClicked: root.presetsEdited(PresetCatalog.setPresetColorHex(root.presets, root.preset.presetId, ""))
        }

        DankActionButton {
            id: archiveButton

            anchors.verticalCenter: parent.verticalCenter
            iconName: "archive"
            tooltipText: I18n.trFor("dankTimeLog", "Archive")
            onClicked: root.presetsEdited(PresetCatalog.setPresetArchived(root.presets, root.preset.presetId, true))
        }
    }

    StyledText {
        visible: !root.isTypedNameAvailable
        text: I18n.trFor("dankTimeLog", "Names must be non-empty and differ from other active presets")
        font.pixelSize: Theme.fontSizeSmall
        color: Theme.error
    }
}
