import QtQuick
import qs.Common
import qs.Widgets
import "DurationFormat.mjs" as DurationFormat
import "PresetCatalog.mjs" as PresetCatalog

StyledRect {
    id: root

    property var runningSession: null
    property var runningPreset: null
    property real nowEpochMilliseconds: 0

    signal stopRequested

    readonly property bool isRunning: runningSession !== null
    readonly property color presetColor: PresetCatalog.resolvePresetColor(runningPreset, Theme.primary)

    // Sized by the Stop button even when it is hidden, so the card does not jump when a timer starts.
    implicitHeight: stopButton.height + Theme.spacingM * 2
    radius: Theme.cornerRadius
    color: Theme.surfaceContainerHigh

    StyledRect {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: Theme.spacingXS
        radius: Theme.cornerRadius
        visible: root.isRunning
        color: root.presetColor
    }

    DankIcon {
        id: presetIcon

        anchors.left: parent.left
        anchors.leftMargin: Theme.spacingM
        anchors.verticalCenter: parent.verticalCenter
        name: root.isRunning ? (root.runningPreset?.iconName || "timer") : "timer_off"
        size: Theme.iconSize
        color: root.isRunning ? root.presetColor : Theme.surfaceVariantText
    }

    StyledText {
        anchors.left: presetIcon.right
        anchors.leftMargin: Theme.spacingS
        anchors.right: elapsedText.left
        anchors.rightMargin: Theme.spacingS
        anchors.verticalCenter: parent.verticalCenter
        wrapMode: Text.NoWrap
        elide: Text.ElideRight
        text: root.isRunning ? (root.runningPreset?.displayName ?? root.runningSession.presetId) : I18n.trFor("dankTimeLog", "Not tracking")
        font.pixelSize: Theme.fontSizeLarge
        color: root.isRunning ? Theme.surfaceText : Theme.surfaceVariantText
    }

    StyledText {
        id: elapsedText

        anchors.right: stopButton.left
        anchors.rightMargin: Theme.spacingM
        anchors.verticalCenter: parent.verticalCenter
        visible: root.isRunning
        text: root.isRunning ? DurationFormat.formatClockHoursMinutesSeconds(root.nowEpochMilliseconds - root.runningSession.startEpochMilliseconds) : ""
        font.pixelSize: Theme.fontSizeLarge
        color: Theme.surfaceText
    }

    DankButton {
        id: stopButton

        anchors.right: parent.right
        anchors.rightMargin: Theme.spacingM
        anchors.verticalCenter: parent.verticalCenter
        visible: root.isRunning
        text: I18n.trFor("dankTimeLog", "Stop")
        iconName: "stop"
        onClicked: root.stopRequested()
    }
}
