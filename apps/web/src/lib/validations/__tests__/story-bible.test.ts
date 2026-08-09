import { describe, expect, it } from "vitest";

import {
  createCharacterSchema,
  createLocationSchema,
  createNoteSchema,
  createPropSchema,
  createRelationshipSchema,
  createTimelineEventSchema,
  updateCharacterSchema,
} from "@/lib/validations/story-bible";

const projectId = "11111111-1111-4111-8111-111111111111";
const characterId = "22222222-2222-4222-8222-222222222222";
const relatedCharacterId = "33333333-3333-4333-8333-333333333333";

describe("createCharacterSchema", () => {
  it("accepts a minimal payload (name only)", () => {
    expect(
      createCharacterSchema.safeParse({ projectId, name: "Hero" }).success,
    ).toBe(true);
  });

  it("accepts a full payload", () => {
    expect(
      createCharacterSchema.safeParse({
        projectId,
        name: "Hero",
        description: "The protagonist",
        appearance: "Tall, scarred",
        personality: "Stoic",
        voiceDescription: "Deep and gravelly",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      createCharacterSchema.safeParse({ projectId, name: " " }).success,
    ).toBe(false);
  });
});

describe("updateCharacterSchema", () => {
  it("does not require projectId", () => {
    const result = updateCharacterSchema.safeParse({
      characterId,
      name: "Hero",
    });
    expect(result.success).toBe(true);
  });
});

describe("createRelationshipSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createRelationshipSchema.safeParse({
        characterId,
        relatedCharacterId,
        relationshipType: "rival",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty relationship type", () => {
    expect(
      createRelationshipSchema.safeParse({
        characterId,
        relatedCharacterId,
        relationshipType: "",
      }).success,
    ).toBe(false);
  });
});

describe("createLocationSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createLocationSchema.safeParse({ projectId, name: "The Old Mill" })
        .success,
    ).toBe(true);
  });
});

describe("createPropSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createPropSchema.safeParse({ projectId, name: "Rusted Lantern" }).success,
    ).toBe(true);
  });

  it("accepts a full payload", () => {
    expect(
      createPropSchema.safeParse({
        projectId,
        name: "Rusted Lantern",
        description: "Belonged to the lighthouse keeper",
        appearance: "Dented brass, cracked lens",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createPropSchema.safeParse({ projectId, name: " " }).success).toBe(
      false,
    );
  });
});

describe("createTimelineEventSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createTimelineEventSchema.safeParse({
        projectId,
        title: "Hero leaves home",
        inStoryDate: "Day 1",
        eventOrder: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-integer eventOrder", () => {
    expect(
      createTimelineEventSchema.safeParse({
        projectId,
        title: "Hero leaves home",
        eventOrder: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(
      createTimelineEventSchema.safeParse({
        projectId,
        title: "",
        eventOrder: 0,
      }).success,
    ).toBe(false);
  });
});

describe("createNoteSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createNoteSchema.safeParse({ projectId, title: "Magic system" }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(createNoteSchema.safeParse({ projectId, title: "" }).success).toBe(
      false,
    );
  });
});
