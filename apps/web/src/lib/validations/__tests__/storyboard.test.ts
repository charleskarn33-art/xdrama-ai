import { describe, expect, it } from "vitest";

import {
  addShotCharacterSchema,
  createSceneSchema,
  createShotSchema,
  updateSceneSchema,
} from "@/lib/validations/storyboard";

const projectId = "11111111-1111-4111-8111-111111111111";
const sceneId = "22222222-2222-4222-8222-222222222222";
const scriptId = "33333333-3333-4333-8333-333333333333";
const shotId = "44444444-4444-4444-8444-444444444444";
const characterId = "55555555-5555-4555-8555-555555555555";

describe("createSceneSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createSceneSchema.safeParse({
        projectId,
        title: "The Break-In",
        sceneOrder: 1,
      }).success,
    ).toBe(true);
  });

  it("accepts a payload linking a script and a location", () => {
    expect(
      createSceneSchema.safeParse({
        projectId,
        title: "The Break-In",
        sceneOrder: 1,
        scriptId,
        locationId: scriptId,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(
      createSceneSchema.safeParse({ projectId, title: "", sceneOrder: 1 })
        .success,
    ).toBe(false);
  });
});

describe("updateSceneSchema", () => {
  it("does not require projectId", () => {
    expect(
      updateSceneSchema.safeParse({ sceneId, title: "Renamed", sceneOrder: 2 })
        .success,
    ).toBe(true);
  });
});

describe("createShotSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createShotSchema.safeParse({
        sceneId,
        shotOrder: 1,
        description: "Nadia approaches the vault door.",
      }).success,
    ).toBe(true);
  });

  it("accepts a valid shot_type and duration", () => {
    expect(
      createShotSchema.safeParse({
        sceneId,
        shotOrder: 1,
        shotType: "wide",
        duration_seconds: 4.5,
        description: "Nadia approaches the vault door.",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty description", () => {
    expect(
      createShotSchema.safeParse({ sceneId, shotOrder: 1, description: "" })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown shot_type", () => {
    expect(
      createShotSchema.safeParse({
        sceneId,
        shotOrder: 1,
        shotType: "dutch-angle",
        description: "Nadia approaches the vault door.",
      }).success,
    ).toBe(false);
  });
});

describe("addShotCharacterSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      addShotCharacterSchema.safeParse({ shotId, characterId }).success,
    ).toBe(true);
  });
});
