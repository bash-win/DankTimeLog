import { computeLastDaysAverages, computeThisWeekAverages } from "./SessionMath.mjs";
import { findPresetById } from "./PresetCatalog.mjs";

export const kChartRangeToday = "today";
export const kChartRangeThisWeek = "thisWeek";
export const kChartRangeLastDays = "lastDays";
export const kChartRanges = [kChartRangeToday, kChartRangeThisWeek, kChartRangeLastDays];

export const kDefaultRequestedDayCount = 30;
export const kMaximumRequestedDayCount = 365;

export function clampRequestedDayCount(requestedDayCount) {
    if (!Number.isFinite(requestedDayCount))
        return kDefaultRequestedDayCount;
    return Math.min(kMaximumRequestedDayCount, Math.max(1, Math.floor(requestedDayCount)));
}

// Today is the one-day "last N days" range: an average over one day is that day's total.
export function computeAveragesForChartRange(sessions, chartRange, requestedDayCount, nowEpochMilliseconds) {
    if (chartRange === kChartRangeThisWeek)
        return computeThisWeekAverages(sessions, nowEpochMilliseconds);
    if (chartRange === kChartRangeLastDays)
        return computeLastDaysAverages(sessions, clampRequestedDayCount(requestedDayCount), nowEpochMilliseconds);
    return computeLastDaysAverages(sessions, 1, nowEpochMilliseconds);
}

// A preset removed from settings entirely still gets a row, named by its id, so its tracked time is not hidden.
export function buildAveragesChartRows(presetAverages, presets) {
    const longestAverageMillisecondsPerDay = presetAverages.length > 0 ? presetAverages[0].averageMillisecondsPerDay : 0;
    return presetAverages.map(presetAverage => {
        const preset = findPresetById(presets, presetAverage.presetId);
        return {
            presetId: presetAverage.presetId,
            displayName: preset === null ? presetAverage.presetId : preset.displayName,
            iconName: preset === null ? "" : preset.iconName,
            colorHex: preset === null ? "" : preset.colorHex,
            averageMillisecondsPerDay: presetAverage.averageMillisecondsPerDay,
            fractionOfLongest: longestAverageMillisecondsPerDay > 0 ? presetAverage.averageMillisecondsPerDay / longestAverageMillisecondsPerDay : 0
        };
    });
}
