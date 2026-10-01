pragma ComponentBehavior: Bound

import QtQuick
import qs.Common
import qs.Widgets
import "AveragesChartModel.mjs" as AveragesChartModel
import "DurationFormat.mjs" as DurationFormat

Column {
    id: root

    property var sessions: []
    property var presets: []
    property string chartRange: ""
    property int requestedDayCount: 0
    property real nowEpochMilliseconds: 0

    signal chartRangeSelected(string selectedChartRange)
    signal requestedDayCountSelected(int selectedDayCount)

    readonly property var kQuickPickDayCounts: [7, 30, 90]
    readonly property int kMaximumVisibleChartRowCount: 8

    readonly property var averages: AveragesChartModel.computeAveragesForChartRange(sessions, chartRange, requestedDayCount, nowEpochMilliseconds)
    readonly property var chartRows: AveragesChartModel.buildAveragesChartRows(averages.presetAverages, presets)
    readonly property bool isToday: chartRange === AveragesChartModel.kChartRangeToday

    function formatAverage(averageMilliseconds) {
        const duration = DurationFormat.formatHoursMinutesWithTemplates(averageMilliseconds, I18n.trFor("dankTimeLog", "%1h %2m"), I18n.trFor("dankTimeLog", "%1m"));
        return isToday ? duration : I18n.trFor("dankTimeLog", "%1/day").arg(duration);
    }

    function describeRange() {
        if (isToday)
            return I18n.trFor("dankTimeLog", "Today so far");
        const firstDayLabel = new Date(averages.firstDayStartEpochMilliseconds).toLocaleDateString(Qt.locale(), "ddd d MMM");
        if (averages.dayCount === 1)
            return I18n.trFor("dankTimeLog", "Since %1 · averaged over 1 day").arg(firstDayLabel);
        return I18n.trFor("dankTimeLog", "Since %1 · averaged over %2 days").arg(firstDayLabel).arg(averages.dayCount);
    }

    spacing: Theme.spacingS

    DankButtonGroup {
        anchors.horizontalCenter: parent.horizontalCenter
        model: [I18n.trFor("dankTimeLog", "Today"), I18n.trFor("dankTimeLog", "This week"), I18n.trFor("dankTimeLog", "Last %1 days").arg(root.requestedDayCount)]
        currentIndex: AveragesChartModel.kChartRanges.indexOf(root.chartRange)
        onSelectionChanged: (index, selected) => {
            if (selected)
                root.chartRangeSelected(AveragesChartModel.kChartRanges[index]);
        }
    }

    Row {
        anchors.horizontalCenter: parent.horizontalCenter
        visible: root.chartRange === AveragesChartModel.kChartRangeLastDays
        spacing: Theme.spacingS

        StyledText {
            anchors.verticalCenter: parent.verticalCenter
            text: I18n.trFor("dankTimeLog", "Days")
            font.pixelSize: Theme.fontSizeMedium
            color: Theme.surfaceVariantText
        }

        DankNumberStepper {
            anchors.verticalCenter: parent.verticalCenter
            text: String(root.requestedDayCount)
            decrementEnabled: root.requestedDayCount > 1
            incrementEnabled: root.requestedDayCount < AveragesChartModel.kMaximumRequestedDayCount
            onIncrement: () => root.requestedDayCountSelected(AveragesChartModel.clampRequestedDayCount(root.requestedDayCount + 1))
            onDecrement: () => root.requestedDayCountSelected(AveragesChartModel.clampRequestedDayCount(root.requestedDayCount - 1))
        }

        DankButtonGroup {
            anchors.verticalCenter: parent.verticalCenter
            size: "small"
            checkEnabled: false
            model: root.kQuickPickDayCounts.map(dayCount => String(dayCount))
            currentIndex: root.kQuickPickDayCounts.indexOf(root.requestedDayCount)
            onSelectionChanged: (index, selected) => {
                if (selected)
                    root.requestedDayCountSelected(root.kQuickPickDayCounts[index]);
            }
        }
    }

    DankFlickable {
        id: chartRowsFlickable

        readonly property bool isScrollable: root.chartRows.length > root.kMaximumVisibleChartRowCount
        // Every row is the same height, so the visible rows are a fraction of the column.
        readonly property real chartRowHeight: root.chartRows.length > 0 ? (chartRowsColumn.implicitHeight - (root.chartRows.length - 1) * chartRowsColumn.spacing) / root.chartRows.length : 0

        width: parent.width
        visible: root.chartRows.length > 0
        implicitHeight: isScrollable ? root.kMaximumVisibleChartRowCount * chartRowHeight + (root.kMaximumVisibleChartRowCount - 1) * chartRowsColumn.spacing : chartRowsColumn.implicitHeight
        contentHeight: chartRowsColumn.implicitHeight
        clip: true

        Column {
            id: chartRowsColumn

            // Leaves room for the overlay scrollbar so it does not cover the values.
            width: chartRowsFlickable.width - (chartRowsFlickable.isScrollable ? chartRowsFlickable.verticalScrollBar.width : 0)
            spacing: root.spacing

            Repeater {
                model: root.chartRows

                delegate: AverageBarRow {
                    required property var modelData

                    width: chartRowsColumn.width
                    chartRow: modelData
                    valueText: root.formatAverage(modelData.averageMillisecondsPerDay)
                }
            }
        }
    }

    StyledText {
        width: parent.width
        visible: root.chartRows.length === 0
        horizontalAlignment: Text.AlignHCenter
        text: I18n.trFor("dankTimeLog", "Nothing tracked in this range")
        font.pixelSize: Theme.fontSizeMedium
        color: Theme.surfaceVariantText
    }

    StyledRect {
        width: parent.width
        height: 1
        visible: root.chartRows.length > 0
        color: Theme.outline
    }

    Item {
        width: parent.width
        implicitHeight: totalLabel.implicitHeight
        visible: root.chartRows.length > 0

        StyledText {
            id: totalLabel

            anchors.left: parent.left
            text: I18n.trFor("dankTimeLog", "Total")
            font.pixelSize: Theme.fontSizeMedium
            font.weight: Font.Bold
            color: Theme.surfaceText
        }

        StyledText {
            anchors.right: parent.right
            text: root.formatAverage(root.averages.totalAverageMillisecondsPerDay)
            font.pixelSize: Theme.fontSizeMedium
            font.weight: Font.Bold
            color: Theme.surfaceText
        }
    }

    StyledText {
        width: parent.width
        text: root.describeRange()
        font.pixelSize: Theme.fontSizeSmall
        color: Theme.surfaceVariantText
    }
}
