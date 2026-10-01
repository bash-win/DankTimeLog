import { isMachineOffGap } from "./SessionMath.mjs";

// Every function returns the same array when nothing changes, so callers can skip saving.

// Only the last session can be running: starting a session always closes the previous one first.
export function findRunningSession(sessions) {
    const lastSession = sessions[sessions.length - 1];
    return lastSession !== undefined && lastSession.endEpochMilliseconds === null ? lastSession : null;
}

// A session that would close with no duration is dropped instead of kept as an empty entry.
export function closeRunningSessionAt(sessions, endEpochMilliseconds) {
    const runningSession = findRunningSession(sessions);
    if (runningSession === null)
        return sessions;
    const earlierSessions = sessions.slice(0, -1);
    if (endEpochMilliseconds <= runningSession.startEpochMilliseconds)
        return earlierSessions;
    const closedSession = {
        presetId: runningSession.presetId,
        startEpochMilliseconds: runningSession.startEpochMilliseconds,
        endEpochMilliseconds: endEpochMilliseconds
    };
    return [...earlierSessions, closedSession];
}

export function startPresetSession(sessions, presetId, nowEpochMilliseconds) {
    const runningSession = findRunningSession(sessions);
    if (runningSession !== null && runningSession.presetId === presetId)
        return sessions;
    return [...closeRunningSessionAt(sessions, nowEpochMilliseconds), { presetId, startEpochMilliseconds: nowEpochMilliseconds, endEpochMilliseconds: null }];
}

export function closeRunningSessionAfterMachineOffGap(sessions, lastHeartbeatEpochMilliseconds, nowEpochMilliseconds) {
    if (!isMachineOffGap(lastHeartbeatEpochMilliseconds, nowEpochMilliseconds))
        return sessions;
    return closeRunningSessionAt(sessions, lastHeartbeatEpochMilliseconds);
}

export function removePresetSessions(sessions, presetId) {
    const remainingSessions = sessions.filter(session => session.presetId !== presetId);
    return remainingSessions.length === sessions.length ? sessions : remainingSessions;
}
