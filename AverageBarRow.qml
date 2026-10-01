import QtQuick
import qs.Common
import qs.Widgets
import "PresetCatalog.mjs" as PresetCatalog

Item {
    id: root

    property var chartRow: null
    property string valueText: ""

    // Fixed column widths so the bars line up across rows regardless of name and value lengths.
    readonly property real kNameColumnWidthFraction: 0.3
    readonly property real kValueColumnWidthFraction: 0.25

    readonly property color barColor: PresetCatalog.resolvePresetColor(chartRow, Theme.primary)

    implicitHeight: Math.max(nameText.implicitHeight, Theme.iconSizeSmall)

    DankIcon {
        id: presetIcon

        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        visible: root.chartRow.iconName !== ""
        name: root.chartRow.iconName
        size: Theme.iconSizeSmall
        color: root.barColor
    }

    StyledText {
        id: nameText

        anchors.left: presetIcon.visible ? presetIcon.right : parent.left
        anchors.leftMargin: presetIcon.visible ? Theme.spacingXS : 0
        anchors.verticalCenter: parent.verticalCenter
        width: root.width * root.kNameColumnWidthFraction - (presetIcon.visible ? presetIcon.width + Theme.spacingXS : 0)
        wrapMode: Text.NoWrap
        elide: Text.ElideRight
        text: root.chartRow.displayName
        font.pixelSize: Theme.fontSizeMedium
        color: Theme.surfaceText
    }

    StyledRect {
        id: barTrack

        anchors.left: parent.left
        anchors.leftMargin: root.width * root.kNameColumnWidthFraction + Theme.spacingS
        anchors.right: valueLabel.left
        anchors.rightMargin: Theme.spacingS
        anchors.verticalCenter: parent.verticalCenter
        height: Theme.spacingS
        radius: height / 2
        color: Theme.surfaceContainerHigh

        StyledRect {
            width: parent.width * root.chartRow.fractionOfLongest
            height: parent.height
            radius: parent.radius
            color: root.barColor
        }
    }

    StyledText {
        id: valueLabel

        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        width: root.width * root.kValueColumnWidthFraction
        horizontalAlignment: Text.AlignRight
        text: root.valueText
        font.pixelSize: Theme.fontSizeMedium
        color: Theme.surfaceText
    }
}
