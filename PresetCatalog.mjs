// Presets are { presetId, displayName, iconName, colorHex, isArchived }.

export function findPresetById(presets, presetId) {
    return presets.find(preset => preset.presetId === presetId) ?? null;
}

export function isPresetActive(presets, presetId) {
    return presets.some(preset => preset.presetId === presetId && !preset.isArchived);
}

// An empty colorHex means "use the theme accent", so presets follow theme changes.
export function resolvePresetColor(preset, themeAccentColor) {
    return preset !== null && preset.colorHex !== "" ? preset.colorHex : themeAccentColor;
}

// Matches the display name or the id, case-insensitively, so `start work` works from a keybinding.
export function findActivePresetByName(presets, presetName) {
    const wantedName = presetName.trim().toLowerCase();
    return presets.find(preset => !preset.isArchived && (preset.displayName.toLowerCase() === wantedName || preset.presetId.toLowerCase() === wantedName)) ?? null;
}

export const kDefaultPresetIconName = "label";

// Every edit returns the same array when it is rejected or changes nothing, so callers can skip saving.

// Checked against ids too, because `start <name>` over IPC matches either.
export function isDisplayNameAvailable(presets, displayName, exceptPresetId) {
    const trimmedDisplayName = displayName.trim();
    if (trimmedDisplayName === "")
        return false;
    const conflictingPreset = findActivePresetByName(presets, trimmedDisplayName);
    return conflictingPreset === null || conflictingPreset.presetId === exceptPresetId;
}

// Ids never change after creation, so renaming a preset keeps its history; a taken slug gets a numeric suffix.
export function createPresetId(presets, displayName) {
    const slug = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "preset";
    let candidatePresetId = slug;
    for (let suffix = 2; findPresetById(presets, candidatePresetId) !== null; suffix++)
        candidatePresetId = slug + "-" + suffix;
    return candidatePresetId;
}

export function addPreset(presets, displayName) {
    if (!isDisplayNameAvailable(presets, displayName, null))
        return presets;
    const trimmedDisplayName = displayName.trim();
    const newPreset = {
        presetId: createPresetId(presets, trimmedDisplayName),
        displayName: trimmedDisplayName,
        iconName: kDefaultPresetIconName,
        colorHex: "",
        isArchived: false
    };
    return [...presets, newPreset];
}

function replacePresetFields(presets, presetId, changedFields) {
    const existingPreset = findPresetById(presets, presetId);
    if (existingPreset === null)
        return presets;
    const changedPreset = {
        presetId: existingPreset.presetId,
        displayName: changedFields.displayName ?? existingPreset.displayName,
        iconName: changedFields.iconName ?? existingPreset.iconName,
        colorHex: changedFields.colorHex ?? existingPreset.colorHex,
        isArchived: changedFields.isArchived ?? existingPreset.isArchived
    };
    const isUnchanged = changedPreset.displayName === existingPreset.displayName && changedPreset.iconName === existingPreset.iconName && changedPreset.colorHex === existingPreset.colorHex && changedPreset.isArchived === existingPreset.isArchived;
    if (isUnchanged)
        return presets;
    return presets.map(preset => preset.presetId === presetId ? changedPreset : preset);
}

export function renamePreset(presets, presetId, displayName) {
    if (!isDisplayNameAvailable(presets, displayName, presetId))
        return presets;
    return replacePresetFields(presets, presetId, {
        displayName: displayName.trim()
    });
}

export function setPresetIconName(presets, presetId, iconName) {
    return replacePresetFields(presets, presetId, {
        iconName: iconName
    });
}

export function setPresetColorHex(presets, presetId, colorHex) {
    return replacePresetFields(presets, presetId, {
        colorHex: colorHex
    });
}

// Restoring is refused when an active preset has taken the name in the meantime.
export function setPresetArchived(presets, presetId, isArchived) {
    const existingPreset = findPresetById(presets, presetId);
    if (existingPreset !== null && !isArchived && !isDisplayNameAvailable(presets, existingPreset.displayName, presetId))
        return presets;
    return replacePresetFields(presets, presetId, {
        isArchived: isArchived
    });
}

// Only archived presets can be deleted, so a running timer never loses its preset.
export function removeArchivedPreset(presets, presetId) {
    const existingPreset = findPresetById(presets, presetId);
    if (existingPreset === null || !existingPreset.isArchived)
        return presets;
    return presets.filter(preset => preset.presetId !== presetId);
}
