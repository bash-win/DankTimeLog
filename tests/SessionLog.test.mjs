import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { closeRunningSessionAfterMachineOffGap, closeRunningSessionAt, findRunningSession, removePresetSessions, startPresetSession } from "../SessionLog.mjs";
import { kMachineOffGapThresholdMilliseconds } from "../SessionMath.mjs";

const kMillisecondsPerHour = 60 * 60 * 1000;
const kStartEpochMilliseconds = Date.UTC(2026, 8, 30, 9);

function closedSession(presetId, startEpochMilliseconds, endEpochMilliseconds) {
    return { presetId, startEpochMilliseconds, endEpochMilliseconds };
}

function openSession(presetId, startEpochMilliseconds) {
    return { presetId, startEpochMilliseconds, endEpochMilliseconds: null };
}

describe("findRunningSession", () => {
    it("returns the open last session", () => {
        const runningSession = openSession("work", kStartEpochMilliseconds + kMillisecondsPerHour);
        assert.equal(findRunningSession([closedSession("study", kStartEpochMilliseconds, kStartEpochMilliseconds + kMillisecondsPerHour), runningSession]), runningSession);
    });

    it("returns null when the last session is closed", () => {
        assert.equal(findRunningSession([closedSession("work", kStartEpochMilliseconds, kStartEpochMilliseconds + kMillisecondsPerHour)]), null);
    });

    it("returns null with no sessions", () => {
        assert.equal(findRunningSession([]), null);
    });
});

describe("closeRunningSessionAt", () => {
    it("closes the running session at the given time", () => {
        const sessions = [openSession("work", kStartEpochMilliseconds)];
        assert.deepEqual(closeRunningSessionAt(sessions, kStartEpochMilliseconds + kMillisecondsPerHour), [closedSession("work", kStartEpochMilliseconds, kStartEpochMilliseconds + kMillisecondsPerHour)]);
    });

    it("does not modify the input", () => {
        const sessions = [openSession("work", kStartEpochMilliseconds)];
        closeRunningSessionAt(sessions, kStartEpochMilliseconds + kMillisecondsPerHour);
        assert.equal(sessions[0].endEpochMilliseconds, null);
    });

    it("drops a session that would have no duration", () => {
        const earlierSession = closedSession("study", kStartEpochMilliseconds - kMillisecondsPerHour, kStartEpochMilliseconds);
        assert.deepEqual(closeRunningSessionAt([earlierSession, openSession("work", kStartEpochMilliseconds)], kStartEpochMilliseconds), [earlierSession]);
    });

    it("returns the same array when nothing is running", () => {
        const sessions = [closedSession("work", kStartEpochMilliseconds, kStartEpochMilliseconds + kMillisecondsPerHour)];
        assert.equal(closeRunningSessionAt(sessions, kStartEpochMilliseconds + 2 * kMillisecondsPerHour), sessions);
    });
});

describe("startPresetSession", () => {
    it("opens a session when nothing is running", () => {
        assert.deepEqual(startPresetSession([], "work", kStartEpochMilliseconds), [openSession("work", kStartEpochMilliseconds)]);
    });

    it("closes the running session at the same instant the new one opens", () => {
        const switchEpochMilliseconds = kStartEpochMilliseconds + kMillisecondsPerHour;
        assert.deepEqual(startPresetSession([openSession("work", kStartEpochMilliseconds)], "study", switchEpochMilliseconds), [
            closedSession("work", kStartEpochMilliseconds, switchEpochMilliseconds),
            openSession("study", switchEpochMilliseconds)
        ]);
    });

    it("returns the same array when that preset is already running", () => {
        const sessions = [openSession("work", kStartEpochMilliseconds)];
        assert.equal(startPresetSession(sessions, "work", kStartEpochMilliseconds + kMillisecondsPerHour), sessions);
    });
});

describe("closeRunningSessionAfterMachineOffGap", () => {
    it("closes at the last heartbeat after a gap", () => {
        const lastHeartbeatEpochMilliseconds = kStartEpochMilliseconds + kMillisecondsPerHour;
        const sessions = [openSession("work", kStartEpochMilliseconds)];
        assert.deepEqual(closeRunningSessionAfterMachineOffGap(sessions, lastHeartbeatEpochMilliseconds, lastHeartbeatEpochMilliseconds + 8 * kMillisecondsPerHour), [closedSession("work", kStartEpochMilliseconds, lastHeartbeatEpochMilliseconds)]);
    });

    it("keeps the session running within the threshold", () => {
        const lastHeartbeatEpochMilliseconds = kStartEpochMilliseconds + kMillisecondsPerHour;
        const sessions = [openSession("work", kStartEpochMilliseconds)];
        assert.equal(closeRunningSessionAfterMachineOffGap(sessions, lastHeartbeatEpochMilliseconds, lastHeartbeatEpochMilliseconds + kMachineOffGapThresholdMilliseconds), sessions);
    });
});

describe("removePresetSessions", () => {
    const kSessions = [closedSession("study", kStartEpochMilliseconds, kStartEpochMilliseconds + kMillisecondsPerHour), closedSession("gaming", kStartEpochMilliseconds + kMillisecondsPerHour, kStartEpochMilliseconds + 2 * kMillisecondsPerHour), openSession("work", kStartEpochMilliseconds + 2 * kMillisecondsPerHour)];

    it("removes every session of the preset and keeps the rest in order", () => {
        assert.deepEqual(removePresetSessions(kSessions, "gaming"), [kSessions[0], kSessions[2]]);
    });

    it("returns the same array when the preset has no sessions", () => {
        assert.equal(removePresetSessions(kSessions, "missing"), kSessions);
    });
});
