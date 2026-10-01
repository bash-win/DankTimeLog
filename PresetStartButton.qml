import QtQuick
import qs.Common
import qs.Widgets
import "PresetCatalog.mjs" as PresetCatalog

// DankButton's own label cannot elide, so this draws its own and is capped at maximumWidth.
DankButton {
    id: root

    property var preset: null
    property bool isRunningPreset: false
    property real maximumWidth: 0

    // A tint rather than a solid fill keeps the label readable on any user-chosen preset color.
    readonly property real kRunningTintOpacity: 0.3

    readonly property real labelNaturalWidth: (presetIcon.visible ? presetIcon.width + Theme.spacingS : 0) + presetLabel.implicitWidth

    width: Math.min(labelNaturalWidth + horizontalPadding * 2, maximumWidth)
    backgroundColor: isRunningPreset ? Theme.withAlpha(PresetCatalog.resolvePresetColor(preset, Theme.primary), kRunningTintOpacity) : Theme.surfaceContainerHigh
    textColor: Theme.surfaceText

    DankIcon {
        id: presetIcon

        anchors.left: parent.left
        anchors.leftMargin: root.horizontalPadding
        anchors.verticalCenter: parent.verticalCenter
        visible: root.preset.iconName !== ""
        name: root.preset.iconName
        size: root.iconSize
        color: root.textColor
    }

    StyledText {
        id: presetLabel

        anchors.left: presetIcon.visible ? presetIcon.right : parent.left
        anchors.leftMargin: presetIcon.visible ? Theme.spacingS : root.horizontalPadding
        anchors.right: parent.right
        anchors.rightMargin: root.horizontalPadding
        anchors.verticalCenter: parent.verticalCenter
        wrapMode: Text.NoWrap
        text: root.preset.displayName
        font.pixelSize: Theme.fontSizeMedium
        font.weight: Font.Medium
        color: root.textColor
    }
}
