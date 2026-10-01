import QtQuick
import Quickshell.Io
import qs.Common
import qs.Modules.Plugins
import "PresetCatalog.mjs" as PresetCatalog
import "SessionLog.mjs" as SessionLog
import "SessionMath.mjs" as SessionMath

// Single owner of presets, sessions and the running timer. DMS creates a widget per bar per monitor; they all bind to this.
PluginComponent {
    id: root

    readonly property int kSessionsFormatVersion: 1
    readonly property int kMillisecondsPerSecond: 1000

    // Used until the user saves their own presets in settings. An empty colorHex means the theme accent.
    readonly property var kDefaultPresets: [
        {
            presetId: "work",
            displayName: I18n.trFor("dankTimeLog", "Work"),
            iconName: "work",
            colorHex: "",
            isArchived: false
        },
        {
            presetId: "study",
            displayName: I18n.trFor("dankTimeLog", "Study"),
            iconName: "school",
            colorHex: "",
            isArchived: false
        }
    ]

    readonly property var presets: pluginData.presets ?? kDefaultPresets
    property var sessions: []
    readonly property var runningSession: SessionLog.findRunningSession(sessions)
    readonly property var runningPreset: runningSession === null ? null : PresetCatalog.findPresetById(presets, runningSession.presetId)
    property real lastHeartbeatEpochMilliseconds: 0

    function startPreset(presetId) {
        if (!PresetCatalog.isPresetActive(presets, presetId))
            return false;
        const nowEpochMilliseconds = Date.now();
        commitSessions(SessionLog.startPresetSession(sessions, presetId, nowEpochMilliseconds));
        recordHeartbeat(nowEpochMilliseconds);
        return true;
    }

    function stopRunningSession() {
        commitSessions(SessionLog.closeRunningSessionAt(sessions, Date.now()));
    }

    function commitSessions(updatedSessions) {
        if (updatedSessions === sessions)
            return;
        sessions = updatedSessions;
        pluginService.savePluginState(pluginId, "formatVersion", kSessionsFormatVersion);
        pluginService.savePluginState(pluginId, "sessions", updatedSessions);
    }

    function recordHeartbeat(nowEpochMilliseconds) {
        lastHeartbeatEpochMilliseconds = nowEpochMilliseconds;
        const heartbeat = {
            lastHeartbeatEpochMilliseconds: nowEpochMilliseconds
        };
        heartbeatFile.setText(JSON.stringify(heartbeat));
    }

    function readLastHeartbeatEpochMilliseconds() {
        try {
            const heartbeat = JSON.parse(heartbeatFile.text());
            return Number.isFinite(heartbeat.lastHeartbeatEpochMilliseconds) ? heartbeat.lastHeartbeatEpochMilliseconds : null;
        } catch (parseError) {
            return null;
        }
    }

    function closeRunningSessionIfMachineWasOff() {
        const nowEpochMilliseconds = Date.now();
        commitSessions(SessionLog.closeRunningSessionAfterMachineOffGap(sessions, lastHeartbeatEpochMilliseconds, nowEpochMilliseconds));
        if (runningSession !== null)
            recordHeartbeat(nowEpochMilliseconds);
    }

    function stopRunningSessionIfPresetInactive() {
        if (runningSession !== null && !PresetCatalog.isPresetActive(presets, runningSession.presetId))
            stopRunningSession();
    }

    onPresetsChanged: stopRunningSessionIfPresetInactive()

    Component.onCompleted: {
        const loadedSessions = pluginService.loadPluginState(pluginId, "sessions", []);
        sessions = Array.isArray(loadedSessions) ? loadedSessions : [];
        if (runningSession === null)
            return;
        // No heartbeat file means the shell never got to write one; the session start is the last moment known to be tracked.
        lastHeartbeatEpochMilliseconds = readLastHeartbeatEpochMilliseconds() ?? runningSession.startEpochMilliseconds;
        closeRunningSessionIfMachineWasOff();
        stopRunningSessionIfPresetInactive();
    }

    // Kept out of savePluginState, which rewrites the whole session history on every save.
    FileView {
        id: heartbeatFile

        path: Paths.strip(Paths.state) + "/plugins/" + root.pluginId + "_heartbeat.json"
        blockLoading: true
        atomicWrites: true
        // A missing file is normal before the first session.
        printErrors: false
    }

    // Monotonic timers stop during suspend, so the first tick after wake sees the wall-clock gap.
    Timer {
        interval: SessionMath.kHeartbeatIntervalMilliseconds
        running: root.runningSession !== null
        repeat: true
        onTriggered: root.closeRunningSessionIfMachineWasOff()
    }

    IpcHandler {
        target: "dankTimeLog"

        function start(presetName: string): string {
            const preset = PresetCatalog.findActivePresetByName(root.presets, presetName);
            if (preset === null)
                return "no active preset named " + presetName;
            root.startPreset(preset.presetId);
            return "started " + preset.displayName;
        }

        function stop(): string {
            if (root.runningSession === null)
                return "not running";
            const stoppedPresetName = root.runningPreset?.displayName ?? root.runningSession.presetId;
            root.stopRunningSession();
            return "stopped " + stoppedPresetName;
        }

        function toggle(presetName: string): string {
            const preset = PresetCatalog.findActivePresetByName(root.presets, presetName);
            if (preset === null)
                return "no active preset named " + presetName;
            if (root.runningSession?.presetId === preset.presetId) {
                root.stopRunningSession();
                return "stopped " + preset.displayName;
            }
            root.startPreset(preset.presetId);
            return "started " + preset.displayName;
        }

        // Tab-separated so scripts can split it; empty when idle.
        function status(): string {
            if (root.runningSession === null)
                return "";
            const elapsedSeconds = Math.floor((Date.now() - root.runningSession.startEpochMilliseconds) / root.kMillisecondsPerSecond);
            return (root.runningPreset?.displayName ?? root.runningSession.presetId) + "\t" + elapsedSeconds;
        }
    }
}
