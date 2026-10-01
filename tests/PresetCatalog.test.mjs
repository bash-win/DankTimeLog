import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { addPreset, createPresetId, findActivePresetByName, findPresetById, isDisplayNameAvailable, isPresetActive, kDefaultPresetIconName, removeArchivedPreset, renamePreset, resolvePresetColor, setPresetArchived, setPresetColorHex, setPresetIconName } from "../PresetCatalog.mjs";

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

describe("resolvePresetColor", () => {
    const kThemeAccentColor = "#7c4dff";

    it("uses the preset's own color", () => {
        const redPreset = { presetId: "red", displayName: "Red", iconName: "work", colorHex: "#ff0000", isArchived: false };
        assert.equal(resolvePresetColor(redPreset, kThemeAccentColor), "#ff0000");
    });

    it("falls back to the theme accent for an empty color", () => {
        assert.equal(resolvePresetColor(kWorkPreset, kThemeAccentColor), kThemeAccentColor);
    });

    it("falls back to the theme accent for a missing preset", () => {
        assert.equal(resolvePresetColor(null, kThemeAccentColor), kThemeAccentColor);
    });
});

describe("isDisplayNameAvailable", () => {
    it("rejects a blank name", () => {
        assert.equal(isDisplayNameAvailable(kPresets, "   ", null), false);
    });

    it("rejects another active preset's name, case-insensitively", () => {
        assert.equal(isDisplayNameAvailable(kPresets, "STUDY", null), false);
    });

    it("rejects another active preset's id, since IPC matches ids too", () => {
        assert.equal(isDisplayNameAvailable(kPresets, "work", null), false);
    });

    it("accepts the preset's own name", () => {
        assert.equal(isDisplayNameAvailable(kPresets, "deep work", "work"), true);
    });

    it("accepts an archived preset's name", () => {
        assert.equal(isDisplayNameAvailable(kPresets, "Gaming", null), true);
    });
});

describe("createPresetId", () => {
    it("slugs the display name", () => {
        assert.equal(createPresetId(kPresets, "  Side Project! "), "side-project");
    });

    it("suffixes a slug already taken, including by an archived preset", () => {
        assert.equal(createPresetId(kPresets, "Gaming"), "gaming-2");
    });

    it("falls back to a generic slug for a name with no ASCII letters or digits", () => {
        assert.equal(createPresetId(kPresets, "読書"), "preset");
    });
});

describe("addPreset", () => {
    it("appends an active preset with the default icon and the theme accent", () => {
        const updatedPresets = addPreset(kPresets, " Reading ");
        assert.deepEqual(updatedPresets.at(-1), { presetId: "reading", displayName: "Reading", iconName: kDefaultPresetIconName, colorHex: "", isArchived: false });
        assert.equal(updatedPresets.length, kPresets.length + 1);
    });

    it("returns the same array for a taken name", () => {
        assert.equal(addPreset(kPresets, "study"), kPresets);
    });
});

describe("renamePreset", () => {
    it("changes the display name and keeps the id", () => {
        const renamedPreset = findPresetById(renamePreset(kPresets, "study", "Revision"), "study");
        assert.equal(renamedPreset.displayName, "Revision");
    });

    it("returns the same array for a taken name", () => {
        assert.equal(renamePreset(kPresets, "study", "Deep Work"), kPresets);
    });

    it("returns the same array when the name is unchanged", () => {
        assert.equal(renamePreset(kPresets, "study", " Study "), kPresets);
    });

    it("returns the same array for an unknown id", () => {
        assert.equal(renamePreset(kPresets, "missing", "Anything"), kPresets);
    });
});

describe("setPresetIconName and setPresetColorHex", () => {
    it("change only the given field", () => {
        const updatedPresets = setPresetColorHex(setPresetIconName(kPresets, "work", "code"), "work", "#00ff00");
        assert.deepEqual(findPresetById(updatedPresets, "work"), { presetId: "work", displayName: "Deep Work", iconName: "code", colorHex: "#00ff00", isArchived: false });
        assert.equal(findPresetById(updatedPresets, "study"), kStudyPreset);
    });

    it("can reset the color to the theme accent", () => {
        const redPresets = setPresetColorHex(kPresets, "work", "#ff0000");
        assert.equal(findPresetById(setPresetColorHex(redPresets, "work", ""), "work").colorHex, "");
    });
});

describe("setPresetArchived", () => {
    it("archives an active preset", () => {
        assert.equal(isPresetActive(setPresetArchived(kPresets, "study", true), "study"), false);
    });

    it("restores an archived preset", () => {
        assert.equal(isPresetActive(setPresetArchived(kPresets, "gaming", false), "gaming"), true);
    });

    it("refuses to restore when an active preset has taken the name", () => {
        const presetsWithNewGaming = addPreset(kPresets, "gaming");
        assert.equal(setPresetArchived(presetsWithNewGaming, "gaming", false), presetsWithNewGaming);
    });

    it("returns the same array when already archived", () => {
        assert.equal(setPresetArchived(kPresets, "gaming", true), kPresets);
    });
});

describe("removeArchivedPreset", () => {
    it("removes an archived preset", () => {
        assert.deepEqual(removeArchivedPreset(kPresets, "gaming"), [kWorkPreset, kStudyPreset]);
    });

    it("returns the same array for an active preset", () => {
        assert.equal(removeArchivedPreset(kPresets, "work"), kPresets);
    });

    it("returns the same array for an unknown id", () => {
        assert.equal(removeArchivedPreset(kPresets, "missing"), kPresets);
    });
});
