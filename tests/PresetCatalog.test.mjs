import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { findActivePresetByName, findPresetById, isPresetActive } from "../PresetCatalog.mjs";

const kWorkPreset = { presetId: "work", displayName: "Deep Work", iconName: "work", colorHex: "", isArchived: false };
const kStudyPreset = { presetId: "study", displayName: "Study", iconName: "school", colorHex: "", isArchived: false };
const kArchivedPreset = { presetId: "gaming", displayName: "Gaming", iconName: "sports_esports", colorHex: "", isArchived: true };
const kPresets = [kWorkPreset, kStudyPreset, kArchivedPreset];

describe("findPresetById", () => {
    it("finds archived presets too, so history still has names", () => {
        assert.equal(findPresetById(kPresets, "gaming"), kArchivedPreset);
    });

    it("returns null for an unknown id", () => {
        assert.equal(findPresetById(kPresets, "missing"), null);
    });
});

describe("isPresetActive", () => {
    it("is true for a preset that is not archived", () => {
        assert.equal(isPresetActive(kPresets, "work"), true);
    });

    it("is false for an archived preset", () => {
        assert.equal(isPresetActive(kPresets, "gaming"), false);
    });

    it("is false for an unknown id", () => {
        assert.equal(isPresetActive(kPresets, "missing"), false);
    });
});

describe("findActivePresetByName", () => {
    it("matches the display name case-insensitively", () => {
        assert.equal(findActivePresetByName(kPresets, "deep WORK"), kWorkPreset);
    });

    it("matches the id", () => {
        assert.equal(findActivePresetByName(kPresets, "work"), kWorkPreset);
    });

    it("ignores surrounding whitespace", () => {
        assert.equal(findActivePresetByName(kPresets, "  study "), kStudyPreset);
    });

    it("does not match archived presets", () => {
        assert.equal(findActivePresetByName(kPresets, "gaming"), null);
    });
});
