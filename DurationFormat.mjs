const kMillisecondsPerSecond = 1000;
const kSecondsPerMinute = 60;
const kMinutesPerHour = 60;
const kSecondsPerHour = kSecondsPerMinute * kMinutesPerHour;

// Floors rather than rounds, so a display never claims time that has not elapsed yet. Negative durations show as zero.
export function splitDurationIntoClockParts(durationMilliseconds) {
    const totalSeconds = Math.max(0, Math.floor(durationMilliseconds / kMillisecondsPerSecond));
    return {
        hours: Math.floor(totalSeconds / kSecondsPerHour),
        minutes: Math.floor(totalSeconds / kSecondsPerMinute) % kMinutesPerHour,
        seconds: totalSeconds % kSecondsPerMinute
    };
}

function padToTwoDigits(clockPart) {
    return String(clockPart).padStart(2, "0");
}

export function formatClockHoursMinutes(durationMilliseconds) {
    const clockParts = splitDurationIntoClockParts(durationMilliseconds);
    return `${clockParts.hours}:${padToTwoDigits(clockParts.minutes)}`;
}

export function formatClockHoursMinutesSeconds(durationMilliseconds) {
    const clockParts = splitDurationIntoClockParts(durationMilliseconds);
    return `${clockParts.hours}:${padToTwoDigits(clockParts.minutes)}:${padToTwoDigits(clockParts.seconds)}`;
}

// Templates come translated from QML: hoursMinutesTemplate like "%1h %2m", minutesOnlyTemplate like "%1m".
export function formatHoursMinutesWithTemplates(durationMilliseconds, hoursMinutesTemplate, minutesOnlyTemplate) {
    const clockParts = splitDurationIntoClockParts(durationMilliseconds);
    if (clockParts.hours === 0)
        return minutesOnlyTemplate.replace("%1", String(clockParts.minutes));
    return hoursMinutesTemplate.replace("%1", String(clockParts.hours)).replace("%2", padToTwoDigits(clockParts.minutes));
}
