// Sessions are { presetId, startEpochMilliseconds, endEpochMilliseconds }; the running one has a null end.

// Bounds the tracked time lost on a hard power-off.
export const kHeartbeatIntervalMilliseconds = 30 * 1000;

// Three missed heartbeats, so a slow `dms restart` does not close the session.
export const kMachineOffGapThresholdMilliseconds = 3 * kHeartbeatIntervalMilliseconds;

export const kMinimumRequestedDayCount = 1;

// DST days are 23 or 25 hours; rounding the day count absorbs that.
const kNominalMillisecondsPerDay = 24 * 60 * 60 * 1000;

const kMondayDayOfWeekIndex = 1;

const kDaysPerWeek = 7;

export function startOfLocalDayEpochMilliseconds(epochMilliseconds) {
    const localDate = new Date(epochMilliseconds);
    localDate.setHours(0, 0, 0, 0);
    return localDate.getTime();
}

// Calendar arithmetic rather than multiples of 24 hours, so midnight stays midnight across DST.
export function shiftByLocalDaysEpochMilliseconds(epochMilliseconds, dayOffset) {
    const localDate = new Date(epochMilliseconds);
    localDate.setDate(localDate.getDate() + dayOffset);
    return localDate.getTime();
}

export function startOfLocalWeekEpochMilliseconds(epochMilliseconds) {
    const dayStartEpochMilliseconds = startOfLocalDayEpochMilliseconds(epochMilliseconds);
    const dayOfWeekIndex = new Date(dayStartEpochMilliseconds).getDay();
    const daysSinceMonday = (dayOfWeekIndex - kMondayDayOfWeekIndex + kDaysPerWeek) % kDaysPerWeek;
    // Re-snap for zones where DST starts at midnight and 00:00 does not exist.
    return startOfLocalDayEpochMilliseconds(shiftByLocalDaysEpochMilliseconds(dayStartEpochMilliseconds, -daysSinceMonday));
}

export function countLocalCalendarDaysInclusive(firstEpochMilliseconds, lastEpochMilliseconds) {
    const midnightDifferenceMilliseconds = startOfLocalDayEpochMilliseconds(lastEpochMilliseconds) - startOfLocalDayEpochMilliseconds(firstEpochMilliseconds);
    return Math.max(0, Math.round(midnightDifferenceMilliseconds / kNominalMillisecondsPerDay) + 1);
}

// Returns { [presetId]: milliseconds }. The running session counts up to now.
export function sumDurationsByPresetWithinRange(sessions, rangeStartEpochMilliseconds, rangeEndEpochMilliseconds, nowEpochMilliseconds) {
    const durationMillisecondsByPresetId = {};
    for (const session of sessions) {
        const sessionEndEpochMilliseconds = session.endEpochMilliseconds === null ? nowEpochMilliseconds : session.endEpochMilliseconds;
        const overlapStartEpochMilliseconds = Math.max(session.startEpochMilliseconds, rangeStartEpochMilliseconds);
        const overlapEndEpochMilliseconds = Math.min(sessionEndEpochMilliseconds, rangeEndEpochMilliseconds);
        if (overlapEndEpochMilliseconds <= overlapStartEpochMilliseconds)
            continue;
        const previousDurationMilliseconds = durationMillisecondsByPresetId[session.presetId] ?? 0;
        durationMillisecondsByPresetId[session.presetId] = previousDurationMilliseconds + overlapEndEpochMilliseconds - overlapStartEpochMilliseconds;
    }
    return durationMillisecondsByPresetId;
}

// Today counts as a whole day. Sorted longest first, ties by presetId, so the chart order is stable.
function computeAveragesFromLocalDayThroughNow(sessions, firstDayStartEpochMilliseconds, nowEpochMilliseconds) {
    const dayCount = Math.max(kMinimumRequestedDayCount, countLocalCalendarDaysInclusive(firstDayStartEpochMilliseconds, nowEpochMilliseconds));
    const durationMillisecondsByPresetId = sumDurationsByPresetWithinRange(sessions, firstDayStartEpochMilliseconds, nowEpochMilliseconds, nowEpochMilliseconds);

    const presetAverages = Object.keys(durationMillisecondsByPresetId).map(presetId => ({
        presetId: presetId,
        averageMillisecondsPerDay: durationMillisecondsByPresetId[presetId] / dayCount
    }));
    presetAverages.sort((left, right) => right.averageMillisecondsPerDay - left.averageMillisecondsPerDay || (left.presetId < right.presetId ? -1 : left.presetId > right.presetId ? 1 : 0));

    const totalAverageMillisecondsPerDay = presetAverages.reduce((runningTotal, presetAverage) => runningTotal + presetAverage.averageMillisecondsPerDay, 0);

    return {
        firstDayStartEpochMilliseconds: firstDayStartEpochMilliseconds,
        dayCount: dayCount,
        presetAverages: presetAverages,
        totalAverageMillisecondsPerDay: totalAverageMillisecondsPerDay
    };
}

export function computeThisWeekAverages(sessions, nowEpochMilliseconds) {
    return computeAveragesFromLocalDayThroughNow(sessions, startOfLocalWeekEpochMilliseconds(nowEpochMilliseconds), nowEpochMilliseconds);
}

// Starts no earlier than the first recorded session, so early use is not averaged over days before tracking began.
export function computeLastDaysAverages(sessions, requestedDayCount, nowEpochMilliseconds) {
    const wholeRequestedDayCount = Number.isFinite(requestedDayCount) ? Math.floor(requestedDayCount) : kMinimumRequestedDayCount;
    const clampedDayCount = Math.max(kMinimumRequestedDayCount, wholeRequestedDayCount);

    const todayStartEpochMilliseconds = startOfLocalDayEpochMilliseconds(nowEpochMilliseconds);
    const requestedFirstDayStartEpochMilliseconds = startOfLocalDayEpochMilliseconds(shiftByLocalDaysEpochMilliseconds(todayStartEpochMilliseconds, -(clampedDayCount - 1)));

    let firstDayStartEpochMilliseconds = requestedFirstDayStartEpochMilliseconds;
    if (sessions.length > 0) {
        // reduce rather than Math.min(...spread), which exceeds engine argument limits on long histories.
        const earliestSessionStartEpochMilliseconds = sessions.reduce((earliestSoFar, session) => Math.min(earliestSoFar, session.startEpochMilliseconds), Infinity);
        firstDayStartEpochMilliseconds = Math.max(requestedFirstDayStartEpochMilliseconds, startOfLocalDayEpochMilliseconds(earliestSessionStartEpochMilliseconds));
    }
    // A session stamped in the future, after the clock moved back, must not push the start past today.
    firstDayStartEpochMilliseconds = Math.min(firstDayStartEpochMilliseconds, todayStartEpochMilliseconds);

    return computeAveragesFromLocalDayThroughNow(sessions, firstDayStartEpochMilliseconds, nowEpochMilliseconds);
}

export function isMachineOffGap(lastHeartbeatEpochMilliseconds, nowEpochMilliseconds) {
    return nowEpochMilliseconds - lastHeartbeatEpochMilliseconds > kMachineOffGapThresholdMilliseconds;
}
