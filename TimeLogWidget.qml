pragma ComponentBehavior: Bound

import QtQuick
import qs.Common
import qs.Widgets
import qs.Modules.Plugins
import "AveragesChartModel.mjs" as AveragesChartModel
import "DurationFormat.mjs" as DurationFormat
import "PresetCatalog.mjs" as PresetCatalog

PluginComponent {
    id: root

    // Timers can fire a few milliseconds early; the slack keeps the minute display from lagging a whole minute.
    readonly property int kPillRefreshSlackMilliseconds: 50

    readonly property var timeLogDaemon: pluginService?.pluginDaemonInstances[pluginId] ?? null
    readonly property var runningSession: timeLogDaemon?.runningSession ?? null
    readonly property var runningPreset: timeLogDaemon?.runningPreset ?? null
    readonly property color runningPresetColor: PresetCatalog.resolvePresetColor(runningPreset, Theme.primary)
    readonly property string pillIconName: runningPreset?.iconName || "timer"

    property real pillNowEpochMilliseconds: Date.now()
    readonly property real runningElapsedMilliseconds: runningSession === null ? 0 : pillNowEpochMilliseconds - runningSession.startEpochMilliseconds
    readonly property var runningClockParts: DurationFormat.splitDurationIntoClockParts(runningElapsedMilliseconds)
    readonly property real pillTextSize: Theme.barTextSize(barThickness, barConfig?.fontScale, barConfig?.maximizeWidgetText)

    readonly property string chartRange: pluginData.chartRange ?? AveragesChartModel.kChartRangeThisWeek
    readonly property int requestedDayCount: AveragesChartModel.clampRequestedDayCount(pluginData.requestedDayCount ?? AveragesChartModel.kDefaultRequestedDayCount)

    onRunningSessionChanged: pillNowEpochMilliseconds = Date.now()

    // Fires on the session's minute boundaries rather than every second; changing the interval restarts the timer.
    Timer {
        interval: DurationFormat.millisecondsUntilNextWholeMinute(root.runningElapsedMilliseconds) + root.kPillRefreshSlackMilliseconds
        running: root.runningSession !== null
        repeat: true
        onTriggered: root.pillNowEpochMilliseconds = Date.now()
    }

    horizontalBarPill: Component {
        Row {
            spacing: Theme.spacingXS

            DankIcon {
                anchors.verticalCenter: parent.verticalCenter
                name: root.pillIconName
                size: root.iconSize
                color: root.runningSession === null ? Theme.surfaceText : root.runningPresetColor
            }

            StyledText {
                anchors.verticalCenter: parent.verticalCenter
                visible: root.runningSession !== null
                text: DurationFormat.formatClockHoursMinutes(root.runningElapsedMilliseconds)
                font.pixelSize: root.pillTextSize
                color: Theme.surfaceText
            }
        }
    }

    // A vertical bar is too narrow for "1:05", so hours and minutes stack.
    verticalBarPill: Component {
        Column {
            spacing: 0

            DankIcon {
                anchors.horizontalCenter: parent.horizontalCenter
                name: root.pillIconName
                size: root.iconSize
                color: root.runningSession === null ? Theme.surfaceText : root.runningPresetColor
            }

            StyledText {
                anchors.horizontalCenter: parent.horizontalCenter
                visible: root.runningSession !== null
                text: I18n.trFor("dankTimeLog", "%1h").arg(root.runningClockParts.hours)
                font.pixelSize: root.pillTextSize
                color: Theme.surfaceText
            }

            StyledText {
                anchors.horizontalCenter: parent.horizontalCenter
                visible: root.runningSession !== null
                text: I18n.trFor("dankTimeLog", "%1m").arg(DurationFormat.padToTwoDigits(root.runningClockParts.minutes))
                font.pixelSize: root.pillTextSize
                color: Theme.surfaceText
            }
        }
    }

    popoutWidth: 400
    popoutContent: Component {
        TimeLogPopout {
            timeLogDaemon: root.timeLogDaemon
            chartRange: root.chartRange
            requestedDayCount: root.requestedDayCount
            onChartRangeSelected: selectedChartRange => root.pluginService.savePluginData(root.pluginId, "chartRange", selectedChartRange)
            onRequestedDayCountSelected: selectedDayCount => root.pluginService.savePluginData(root.pluginId, "requestedDayCount", selectedDayCount)
        }
    }
}
