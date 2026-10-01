// A zone with DST, so the boundary tests hit real 23- and 25-hour days.
process.env.TZ = "America/New_York";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kMachineOffGapThresholdMilliseconds, computeLastDaysAverages, computeThisWeekAverages, countLocalCalendarDaysInclusive, isMachineOffGap, startOfLocalDayEpochMilliseconds, startOfLocalWeekEpochMilliseconds, sumDurationsByPresetWithinRange } from "../SessionMath.mjs";

const kMillisecondsPerMinute = 60 * 1000;
const kMillisecondsPerHour = 60 * kMillisecondsPerMinute;

function localEpochMilliseconds(year, oneBasedMonth, day, hour = 0, minute = 0) {
    return new Date(year, oneBasedMonth - 1, day, hour, minute).getTime();
}

function closedSession(presetId, startEpochMilliseconds, endEpochMilliseconds) {
    return { presetId, startEpochMilliseconds, endEpochMilliseconds };
}

function openSession(presetId, startEpochMilliseconds) {
    return { presetId, startEpochMilliseconds, endEpochMilliseconds: null };
}

describe("startOfLocalDayEpochMilliseconds", () => {
    it("snaps a mid-day instant to local midnight", () => {
        assert.equal(startOfLocalDayEpochMilliseconds(localEpochMilliseconds(2026, 9, 30, 15, 42)), localEpochMilliseconds(2026, 9, 30));
    });

    it("leaves local midnight unchanged", () => {
        assert.equal(startOfLocalDayEpochMilliseconds(localEpochMilliseconds(2026, 9, 30)), localEpochMilliseconds(2026, 9, 30));
    });
});

describe("startOfLocalWeekEpochMilliseconds", () => {
    it("maps a Wednesday to the preceding Monday", () => {
        assert.equal(startOfLocalWeekEpochMilliseconds(localEpochMilliseconds(2026, 9, 30, 12)), localEpochMilliseconds(2026, 9, 28));
    });

    it("maps a Monday to itself", () => {
        assert.equal(startOfLocalWeekEpochMilliseconds(localEpochMilliseconds(2026, 9, 28, 8)), localEpochMilliseconds(2026, 9, 28));
    });

    it("places Sunday at the end of the week, not the start", () => {
        assert.equal(startOfLocalWeekEpochMilliseconds(localEpochMilliseconds(2026, 10, 4, 23, 59)), localEpochMilliseconds(2026, 9, 28));
    });

    it("lands on local midnight across the November DST change", () => {
        // DST ends Sunday 2026-11-01 in New York.
        assert.equal(startOfLocalWeekEpochMilliseconds(localEpochMilliseconds(2026, 11, 1, 15)), localEpochMilliseconds(2026, 10, 26));
    });
});

describe("countLocalCalendarDaysInclusive", () => {
    it("counts one day for two instants on the same day", () => {
        assert.equal(countLocalCalendarDaysInclusive(localEpochMilliseconds(2026, 9, 30, 1), localEpochMilliseconds(2026, 9, 30, 23)), 1);
    });

    it("counts both ends", () => {
        assert.equal(countLocalCalendarDaysInclusive(localEpochMilliseconds(2026, 9, 28), localEpochMilliseconds(2026, 9, 30, 12)), 3);
    });

    it("is unaffected by the 25-hour day when DST ends", () => {
        assert.equal(countLocalCalendarDaysInclusive(localEpochMilliseconds(2026, 10, 31), localEpochMilliseconds(2026, 11, 2)), 3);
    });

    it("is unaffected by the 23-hour day when DST starts", () => {
        // DST starts Sunday 2026-03-08 in New York.
        assert.equal(countLocalCalendarDaysInclusive(localEpochMilliseconds(2026, 3, 7), localEpochMilliseconds(2026, 3, 9)), 3);
    });

    it("returns zero when the last day precedes the first", () => {
        assert.equal(countLocalCalendarDaysInclusive(localEpochMilliseconds(2026, 9, 30), localEpochMilliseconds(2026, 9, 29)), 0);
    });
});

describe("sumDurationsByPresetWithinRange", () => {
    const rangeStartEpochMilliseconds = localEpochMilliseconds(2026, 9, 30);
    const nowEpochMilliseconds = localEpochMilliseconds(2026, 9, 30, 18);

    it("sums sessions of the same preset", () => {
        const sessions = [
            closedSession("work", localEpochMilliseconds(2026, 9, 30, 9), localEpochMilliseconds(2026, 9, 30, 10)),
            closedSession("work", localEpochMilliseconds(2026, 9, 30, 11), localEpochMilliseconds(2026, 9, 30, 13)),
            closedSession("study", localEpochMilliseconds(2026, 9, 30, 14), localEpochMilliseconds(2026, 9, 30, 14, 30))
        ];
        assert.deepEqual(sumDurationsByPresetWithinRange(sessions, rangeStartEpochMilliseconds, nowEpochMilliseconds, nowEpochMilliseconds), {
            work: 3 * kMillisecondsPerHour,
            study: 30 * kMillisecondsPerMinute
        });
    });

    it("counts only the part of a session after midnight", () => {
        const sessions = [closedSession("work", localEpochMilliseconds(2026, 9, 29, 22), localEpochMilliseconds(2026, 9, 30, 1))];
        assert.deepEqual(sumDurationsByPresetWithinRange(sessions, rangeStartEpochMilliseconds, nowEpochMilliseconds, nowEpochMilliseconds), {
            work: kMillisecondsPerHour
        });
    });

    it("counts the running session up to now", () => {
        const sessions = [openSession("study", localEpochMilliseconds(2026, 9, 30, 16, 30))];
        assert.deepEqual(sumDurationsByPresetWithinRange(sessions, rangeStartEpochMilliseconds, nowEpochMilliseconds, nowEpochMilliseconds), {
            study: 90 * kMillisecondsPerMinute
        });
    });

    it("omits sessions entirely outside the range", () => {
        const sessions = [closedSession("waste", localEpochMilliseconds(2026, 9, 29, 9), localEpochMilliseconds(2026, 9, 29, 10))];
        assert.deepEqual(sumDurationsByPresetWithinRange(sessions, rangeStartEpochMilliseconds, nowEpochMilliseconds, nowEpochMilliseconds), {});
    });

    it("ignores a session whose end precedes its start", () => {
        const sessions = [closedSession("work", localEpochMilliseconds(2026, 9, 30, 10), localEpochMilliseconds(2026, 9, 30, 9))];
        assert.deepEqual(sumDurationsByPresetWithinRange(sessions, rangeStartEpochMilliseconds, nowEpochMilliseconds, nowEpochMilliseconds), {});
    });
});

describe("computeThisWeekAverages", () => {
    it("divides by the days from Monday through today and sorts longest first", () => {
        const nowEpochMilliseconds = localEpochMilliseconds(2026, 9, 30, 12);
        const sessions = [
            // Only the hour after Monday midnight belongs to this week.
            closedSession("work", localEpochMilliseconds(2026, 9, 27, 23), localEpochMilliseconds(2026, 9, 28, 1)),
            closedSession("work", localEpochMilliseconds(2026, 9, 28, 9), localEpochMilliseconds(2026, 9, 28, 11)),
            closedSession("study", localEpochMilliseconds(2026, 9, 29, 9), localEpochMilliseconds(2026, 9, 29, 12)),
            openSession("work", localEpochMilliseconds(2026, 9, 30, 9))
        ];

        const weekAverages = computeThisWeekAverages(sessions, nowEpochMilliseconds);

        assert.equal(weekAverages.firstDayStartEpochMilliseconds, localEpochMilliseconds(2026, 9, 28));
        assert.equal(weekAverages.dayCount, 3);
        assert.deepEqual(weekAverages.presetAverages, [
            { presetId: "work", averageMillisecondsPerDay: 2 * kMillisecondsPerHour },
            { presetId: "study", averageMillisecondsPerDay: kMillisecondsPerHour }
        ]);
        assert.equal(weekAverages.totalAverageMillisecondsPerDay, 3 * kMillisecondsPerHour);
    });

    it("equals today's total on a Monday", () => {
        const nowEpochMilliseconds = localEpochMilliseconds(2026, 9, 28, 10);
        const sessions = [closedSession("work", localEpochMilliseconds(2026, 9, 28, 8), localEpochMilliseconds(2026, 9, 28, 9))];

        const weekAverages = computeThisWeekAverages(sessions, nowEpochMilliseconds);

        assert.equal(weekAverages.dayCount, 1);
        assert.deepEqual(weekAverages.presetAverages, [{ presetId: "work", averageMillisecondsPerDay: kMillisecondsPerHour }]);
    });

    it("breaks ties by presetId", () => {
        const nowEpochMilliseconds = localEpochMilliseconds(2026, 9, 28, 20);
        const sessions = [
            closedSession("work", localEpochMilliseconds(2026, 9, 28, 8), localEpochMilliseconds(2026, 9, 28, 9)),
            closedSession("study", localEpochMilliseconds(2026, 9, 28, 10), localEpochMilliseconds(2026, 9, 28, 11))
        ];

        const presetIds = computeThisWeekAverages(sessions, nowEpochMilliseconds).presetAverages.map(presetAverage => presetAverage.presetId);

        assert.deepEqual(presetIds, ["study", "work"]);
    });
});

describe("computeLastDaysAverages", () => {
    const nowEpochMilliseconds = localEpochMilliseconds(2026, 9, 30, 12);

    it("counts days without tracked time as zero", () => {
        const sessions = [
            closedSession("work", localEpochMilliseconds(2026, 9, 1, 9), localEpochMilliseconds(2026, 9, 1, 10)),
            closedSession("work", localEpochMilliseconds(2026, 9, 25, 9), localEpochMilliseconds(2026, 9, 25, 16))
        ];

        const lastDaysAverages = computeLastDaysAverages(sessions, 7, nowEpochMilliseconds);

        assert.equal(lastDaysAverages.firstDayStartEpochMilliseconds, localEpochMilliseconds(2026, 9, 24));
        assert.equal(lastDaysAverages.dayCount, 7);
        assert.deepEqual(lastDaysAverages.presetAverages, [{ presetId: "work", averageMillisecondsPerDay: kMillisecondsPerHour }]);
    });

    it("starts no earlier than the day of the first recorded session", () => {
        const sessions = [closedSession("study", localEpochMilliseconds(2026, 9, 28, 20), localEpochMilliseconds(2026, 9, 28, 23))];

        const lastDaysAverages = computeLastDaysAverages(sessions, 30, nowEpochMilliseconds);

        assert.equal(lastDaysAverages.firstDayStartEpochMilliseconds, localEpochMilliseconds(2026, 9, 28));
        assert.equal(lastDaysAverages.dayCount, 3);
        assert.deepEqual(lastDaysAverages.presetAverages, [{ presetId: "study", averageMillisecondsPerDay: kMillisecondsPerHour }]);
    });

    it("keeps the requested day count when there is no history", () => {
        const lastDaysAverages = computeLastDaysAverages([], 14, nowEpochMilliseconds);

        assert.equal(lastDaysAverages.dayCount, 14);
        assert.deepEqual(lastDaysAverages.presetAverages, []);
        assert.equal(lastDaysAverages.totalAverageMillisecondsPerDay, 0);
    });

    it("does not start after today when a session is stamped in the future", () => {
        const sessions = [closedSession("work", localEpochMilliseconds(2026, 10, 5, 9), localEpochMilliseconds(2026, 10, 5, 10))];

        const lastDaysAverages = computeLastDaysAverages(sessions, 7, nowEpochMilliseconds);

        assert.equal(lastDaysAverages.firstDayStartEpochMilliseconds, localEpochMilliseconds(2026, 9, 30));
        assert.equal(lastDaysAverages.dayCount, 1);
    });

    for (const [requestedDayCount, expectedDayCount] of [[0, 1], [-5, 1], [Number.NaN, 1], [Infinity, 1], [2.7, 2]]) {
        it(`treats a requested count of ${requestedDayCount} as ${expectedDayCount}`, () => {
            assert.equal(computeLastDaysAverages([], requestedDayCount, nowEpochMilliseconds).dayCount, expectedDayCount);
        });
    }
});

describe("isMachineOffGap", () => {
    const lastHeartbeatEpochMilliseconds = localEpochMilliseconds(2026, 9, 30, 12);

    it("is not a gap within the threshold, as after a shell restart", () => {
        assert.equal(isMachineOffGap(lastHeartbeatEpochMilliseconds, lastHeartbeatEpochMilliseconds + kMachineOffGapThresholdMilliseconds), false);
    });

    it("is a gap beyond the threshold, as after suspend or power-off", () => {
        assert.equal(isMachineOffGap(lastHeartbeatEpochMilliseconds, lastHeartbeatEpochMilliseconds + kMachineOffGapThresholdMilliseconds + 1), true);
    });

    it("is not a gap when the clock moved backwards", () => {
        assert.equal(isMachineOffGap(lastHeartbeatEpochMilliseconds, lastHeartbeatEpochMilliseconds - kMillisecondsPerHour), false);
    });
});
