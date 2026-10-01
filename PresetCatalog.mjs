// Presets are { presetId, displayName, iconName, colorHex, isArchived }.

export function findPresetById(presets, presetId) {
    return presets.find(preset => preset.presetId === presetId) ?? null;
}

export function isPresetActive(presets, presetId) {
    return presets.some(preset => preset.presetId === presetId && !preset.isArchived);
}

// Matches the display name or the id, case-insensitively, so `start work` works from a keybinding.
export function findActivePresetByName(presets, presetName) {
    const wantedName = presetName.trim().toLowerCase();
    return presets.find(preset => !preset.isArchived && (preset.displayName.toLowerCase() === wantedName || preset.presetId.toLowerCase() === wantedName)) ?? null;
}
