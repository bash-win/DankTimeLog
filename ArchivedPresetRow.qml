import QtQuick
import qs.Common
import qs.Widgets
import "DurationFormat.mjs" as DurationFormat
import "PresetCatalog.mjs" as PresetCatalog

Item {
    id: root

    property var preset: null
    property var presets: []
    property real trackedMilliseconds: 0

    signal restoreRequested
    signal deleteRequested

    // Theme has no color for text on a solid error fill, so the button is tinted and its label is the error color.
    readonly property real kDeleteTintOpacity: 0.2

    // Deleting also removes the preset's history, so it asks first.
    property bool isConfirmingDelete: false

    readonly property bool canRestore: PresetCatalog.isDisplayNameAvailable(presets, preset.displayName, preset.presetId)
    readonly property string trackedDurationText: DurationFormat.formatHoursMinutesWithTemplates(trackedMilliseconds, I18n.trFor("dankTimeLog", "%1h %2m"), I18n.trFor("dankTimeLog", "%1m"))

    function describePreset() {
        if (isConfirmingDelete)
            return I18n.trFor("dankTimeLog", "Delete %1 and its %2 of tracked time?").arg(preset.displayName).arg(trackedDurationText);
        if (!canRestore)
            return I18n.trFor("dankTimeLog", "%1 (rename the active preset with this name to restore)").arg(preset.displayName);
        return preset.displayName;
    }

    implicitHeight: Math.max(actionButtons.implicitHeight, confirmButtons.implicitHeight)

    DankIcon {
        id: presetIcon

        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        name: root.preset.iconName
        size: Theme.iconSizeSmall
        color: PresetCatalog.resolvePresetColor(root.preset, Theme.primary)
    }

    StyledText {
        anchors.left: presetIcon.right
        anchors.leftMargin: Theme.spacingS
        anchors.right: root.isConfirmingDelete ? confirmButtons.left : actionButtons.left
        anchors.rightMargin: Theme.spacingS
        anchors.verticalCenter: parent.verticalCenter
        wrapMode: Text.NoWrap
        elide: Text.ElideRight
        text: root.describePreset()
        font.pixelSize: Theme.fontSizeMedium
        color: root.isConfirmingDelete ? Theme.error : Theme.surfaceVariantText
    }

    Row {
        id: actionButtons

        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        visible: !root.isConfirmingDelete
        spacing: Theme.spacingXS

        DankActionButton {
            enabled: root.canRestore
            iconName: "unarchive"
            tooltipText: I18n.trFor("dankTimeLog", "Restore")
            onClicked: root.restoreRequested()
        }

        DankActionButton {
            iconName: "delete"
            iconColor: Theme.error
            tooltipText: I18n.trFor("dankTimeLog", "Delete with its history")
            onClicked: root.isConfirmingDelete = true
        }
    }

    Row {
        id: confirmButtons

        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        visible: root.isConfirmingDelete
        spacing: Theme.spacingS

        DankButton {
            text: I18n.trFor("dankTimeLog", "Cancel")
            backgroundColor: Theme.surfaceContainerHigh
            textColor: Theme.surfaceText
            onClicked: root.isConfirmingDelete = false
        }

        DankButton {
            text: I18n.trFor("dankTimeLog", "Delete")
            iconName: "delete"
            backgroundColor: Theme.withAlpha(Theme.error, root.kDeleteTintOpacity)
            textColor: Theme.error
            onClicked: root.deleteRequested()
        }
    }
}
