import QtQuick
import qs.Common
import qs.Modules.Plugins

PopoutComponent {
    id: root

    property var timeLogDaemon: null
    property string chartRange: ""
    property int requestedDayCount: 0

    signal chartRangeSelected(string selectedChartRange)
    signal requestedDayCountSelected(int selectedDayCount)

    readonly property int kMillisecondsPerSecond: 1000
    readonly property int kChartRefreshIntervalMilliseconds: 60 * 1000

    readonly property bool isShown: parentPopout?.shouldBeVisible ?? false
    property real secondsNowEpochMilliseconds: Date.now()
    property real chartNowEpochMilliseconds: Date.now()

    function refreshNow() {
        secondsNowEpochMilliseconds = Date.now();
        chartNowEpochMilliseconds = secondsNowEpochMilliseconds;
    }

    headerText: I18n.trFor("dankTimeLog", "Time Log")

    onIsShownChanged: {
        if (isShown)
            refreshNow();
        else
            presetStartButtons.stopAddingPreset();
    }

    Connections {
        target: root.timeLogDaemon

        function onSessionsChanged() {
            root.refreshNow();
        }
    }

    Timer {
        interval: root.kMillisecondsPerSecond
        running: root.isShown && root.timeLogDaemon?.runningSession != null
        repeat: true
        onTriggered: root.secondsNowEpochMilliseconds = Date.now()
    }

    Timer {
        interval: root.kChartRefreshIntervalMilliseconds
        running: root.isShown
        repeat: true
        onTriggered: root.chartNowEpochMilliseconds = Date.now()
    }

    Column {
        width: parent.width
        spacing: Theme.spacingM

        RunningSessionCard {
            width: parent.width
            runningSession: root.timeLogDaemon?.runningSession ?? null
            runningPreset: root.timeLogDaemon?.runningPreset ?? null
            nowEpochMilliseconds: root.secondsNowEpochMilliseconds
            onStopRequested: root.timeLogDaemon.stopRunningSession()
        }

        PresetStartButtons {
            id: presetStartButtons

            width: parent.width
            presets: root.timeLogDaemon?.presets ?? []
            runningPresetId: root.timeLogDaemon?.runningSession?.presetId ?? ""
            onPresetStartRequested: presetId => root.timeLogDaemon.startPreset(presetId)
            onPresetAddRequested: displayName => root.timeLogDaemon.addPreset(displayName)
        }

        AveragesChart {
            width: parent.width
            sessions: root.timeLogDaemon?.sessions ?? []
            presets: root.timeLogDaemon?.presets ?? []
            chartRange: root.chartRange
            requestedDayCount: root.requestedDayCount
            nowEpochMilliseconds: root.chartNowEpochMilliseconds
            onChartRangeSelected: selectedChartRange => root.chartRangeSelected(selectedChartRange)
            onRequestedDayCountSelected: selectedDayCount => root.requestedDayCountSelected(selectedDayCount)
        }
    }
}
