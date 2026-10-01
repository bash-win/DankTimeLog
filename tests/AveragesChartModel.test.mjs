process.env.TZ = "America/New_York";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { kChartRangeLastDays, kChartRangeThisWeek, kChartRangeToday, kDefaultRequestedDayCount, kMaximumRequestedDayCount, buildAveragesChartRows, clampRequestedDayCount, computeAveragesForChartRange } from "../AveragesChartModel.mjs";

const kMillisecondsPerHour = 60 * 60 * 1000;

function localEpochMilliseconds(year, oneBasedMonth, day, hour = 0) {
    return new Date(year, oneBasedMonth - 1, day, hour).getTime();
}

const kNowEpochMilliseconds = localEpochMilliseconds(2026, 9, 30, 12);
const kSessions = [
    { presetId: "work", startEpochMilliseconds: localEpochMilliseconds(2026, 9, 1, 9), endEpochMilliseconds: localEpochMilliseconds(2026, 9, 1, 10) },
    { presetId: "work", startEpochMilliseconds: localEpochMilliseconds(2026, 9, 28, 9), endEpochMilliseconds: localEpochMilliseconds(2026, 9, 28, 12) },
    { presetId: "study", startEpochMilliseconds: localEpochMilliseconds(2026, 9, 30, 9), endEpochMilliseconds: localEpochMilliseconds(2026, 9, 30, 11) }
];

describe("computeAveragesForChartRange", () => {
    it("treats today as a one-day range, so the average is today's total", () => {
        const todayAverages = computeAveragesForChartRange(kSessions, kChartRangeToday, 90, kNowEpochMilliseconds);
        assert.equal(todayAverages.dayCount, 1);
        assert.deepEqual(todayAverages.presetAverages, [{ presetId: "study", averageMillisecondsPerDay: 2 * kMillisecondsPerHour }]);
    });

    it("uses Monday through today for this week", () => {
        assert.equal(computeAveragesForChartRange(kSessions, kChartRangeThisWeek, 90, kNowEpochMilliseconds).dayCount, 3);
    });

    it("uses the requested count for last N days", () => {
        assert.equal(computeAveragesForChartRange(kSessions, kChartRangeLastDays, 7, kNowEpochMilliseconds).dayCount, 7);
    });

    it("clamps the requested count for last N days", () => {
        assert.equal(computeAveragesForChartRange(kSessions, kChartRangeLastDays, 0, kNowEpochMilliseconds).dayCount, 1);
    });
});

describe("clampRequestedDayCount", () => {
    for (const [requestedDayCount, expectedDayCount] of [[30, 30], [0, 1], [2.9, 2], [10000, kMaximumRequestedDayCount], [Number.NaN, kDefaultRequestedDayCount], [undefined, kDefaultRequestedDayCount]]) {
        it(`maps ${requestedDayCount} to ${expectedDayCount}`, () => {
            assert.equal(clampRequestedDayCount(requestedDayCount), expectedDayCount);
        });
    }
});

describe("buildAveragesChartRows", () => {
    const kPresets = [
        { presetId: "work", displayName: "Work", iconName: "work", colorHex: "#ff0000", isArchived: false },
        { presetId: "study", displayName: "Study", iconName: "school", colorHex: "", isArchived: true }
    ];

    it("scales bars to the longest preset and keeps archived presets", () => {
        const rows = buildAveragesChartRows([
            { presetId: "work", averageMillisecondsPerDay: 2 * kMillisecondsPerHour },
            { presetId: "study", averageMillisecondsPerDay: kMillisecondsPerHour }
        ], kPresets);
        assert.deepEqual(rows.map(row => [row.displayName, row.fractionOfLongest]), [["Work", 1], ["Study", 0.5]]);
    });

    it("names a preset missing from settings by its id", () => {
        const rows = buildAveragesChartRows([{ presetId: "deleted", averageMillisecondsPerDay: kMillisecondsPerHour }], kPresets);
        assert.deepEqual(rows[0], {
            presetId: "deleted",
            displayName: "deleted",
            iconName: "",
            colorHex: "",
            averageMillisecondsPerDay: kMillisecondsPerHour,
            fractionOfLongest: 1
        });
    });

    it("returns no rows for no averages", () => {
        assert.deepEqual(buildAveragesChartRows([], kPresets), []);
    });
});
