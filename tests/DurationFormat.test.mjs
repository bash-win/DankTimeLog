import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatClockHoursMinutes, formatClockHoursMinutesSeconds, formatHoursMinutesWithTemplates, millisecondsUntilNextWholeMinute, splitDurationIntoClockParts } from "../DurationFormat.mjs";

const kMillisecondsPerSecond = 1000;
const kMillisecondsPerMinute = 60 * kMillisecondsPerSecond;
const kMillisecondsPerHour = 60 * kMillisecondsPerMinute;

const kHoursMinutesTemplate = "%1h %2m";
const kMinutesOnlyTemplate = "%1m";

describe("splitDurationIntoClockParts", () => {
    it("splits into hours, minutes and seconds", () => {
        assert.deepEqual(splitDurationIntoClockParts(2 * kMillisecondsPerHour + 5 * kMillisecondsPerMinute + 9 * kMillisecondsPerSecond), { hours: 2, minutes: 5, seconds: 9 });
    });

    it("floors partial seconds", () => {
        assert.deepEqual(splitDurationIntoClockParts(kMillisecondsPerMinute - 1), { hours: 0, minutes: 0, seconds: 59 });
    });

    it("keeps hours past a day instead of wrapping", () => {
        assert.equal(splitDurationIntoClockParts(26 * kMillisecondsPerHour).hours, 26);
    });

    it("shows a negative duration as zero", () => {
        assert.deepEqual(splitDurationIntoClockParts(-5 * kMillisecondsPerMinute), { hours: 0, minutes: 0, seconds: 0 });
    });
});

describe("formatClockHoursMinutes", () => {
    it("pads minutes to two digits", () => {
        assert.equal(formatClockHoursMinutes(kMillisecondsPerHour + 5 * kMillisecondsPerMinute), "1:05");
    });

    it("shows zero hours under an hour", () => {
        assert.equal(formatClockHoursMinutes(45 * kMillisecondsPerMinute + 59 * kMillisecondsPerSecond), "0:45");
    });
});

describe("formatClockHoursMinutesSeconds", () => {
    it("pads minutes and seconds to two digits", () => {
        assert.equal(formatClockHoursMinutesSeconds(kMillisecondsPerHour + 5 * kMillisecondsPerMinute + 9 * kMillisecondsPerSecond), "1:05:09");
    });

    it("shows zero as 0:00:00", () => {
        assert.equal(formatClockHoursMinutesSeconds(0), "0:00:00");
    });
});

describe("formatHoursMinutesWithTemplates", () => {
    it("uses the hours template from one hour up", () => {
        assert.equal(formatHoursMinutesWithTemplates(kMillisecondsPerHour + 5 * kMillisecondsPerMinute, kHoursMinutesTemplate, kMinutesOnlyTemplate), "1h 05m");
    });

    it("uses the minutes template under an hour, without padding", () => {
        assert.equal(formatHoursMinutesWithTemplates(7 * kMillisecondsPerMinute, kHoursMinutesTemplate, kMinutesOnlyTemplate), "7m");
    });

    it("shows a fractional average as whole minutes", () => {
        assert.equal(formatHoursMinutesWithTemplates(kMillisecondsPerHour / 7, kHoursMinutesTemplate, kMinutesOnlyTemplate), "8m");
    });

    it("follows a translated template's word order", () => {
        assert.equal(formatHoursMinutesWithTemplates(3 * kMillisecondsPerHour, "%2 min, %1 h", kMinutesOnlyTemplate), "00 min, 3 h");
    });
});

describe("millisecondsUntilNextWholeMinute", () => {
    it("counts down to the next minute boundary", () => {
        assert.equal(millisecondsUntilNextWholeMinute(kMillisecondsPerHour + 45 * kMillisecondsPerSecond), 15 * kMillisecondsPerSecond);
    });

    it("waits a full minute when exactly on a boundary", () => {
        assert.equal(millisecondsUntilNextWholeMinute(2 * kMillisecondsPerMinute), kMillisecondsPerMinute);
    });

    it("handles a session that starts slightly in the future", () => {
        assert.equal(millisecondsUntilNextWholeMinute(-10 * kMillisecondsPerSecond), 10 * kMillisecondsPerSecond);
    });
});
