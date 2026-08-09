import { describe, expect, it } from "vitest";

import {
  createMusicTrackSchema,
  createSubtitleSchema,
  createVoiceLineSchema,
} from "@/lib/validations/audio-studio";

const projectId = "11111111-1111-4111-8111-111111111111";
const characterId = "22222222-2222-4222-8222-222222222222";
const timelineId = "33333333-3333-4333-8333-333333333333";

describe("createVoiceLineSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createVoiceLineSchema.safeParse({
        projectId,
        lineOrder: 1,
        text: "The door's locked.",
      }).success,
    ).toBe(true);
  });

  it("accepts a payload linking a character", () => {
    expect(
      createVoiceLineSchema.safeParse({
        projectId,
        characterId,
        lineOrder: 1,
        text: "The door's locked.",
      }).success,
    ).toBe(true);
  });

  it("rejects empty text", () => {
    expect(
      createVoiceLineSchema.safeParse({ projectId, lineOrder: 1, text: "" })
        .success,
    ).toBe(false);
  });
});

describe("createMusicTrackSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createMusicTrackSchema.safeParse({ projectId, name: "Vault Tension" })
        .success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      createMusicTrackSchema.safeParse({ projectId, name: " " }).success,
    ).toBe(false);
  });
});

describe("createSubtitleSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createSubtitleSchema.safeParse({
        timelineId,
        startSeconds: 1.5,
        endSeconds: 4,
        text: "The door's locked.",
      }).success,
    ).toBe(true);
  });

  it("rejects endSeconds before startSeconds", () => {
    expect(
      createSubtitleSchema.safeParse({
        timelineId,
        startSeconds: 5,
        endSeconds: 2,
        text: "Backwards",
      }).success,
    ).toBe(false);
  });

  it("rejects empty text", () => {
    expect(
      createSubtitleSchema.safeParse({
        timelineId,
        startSeconds: 0,
        endSeconds: 1,
        text: "",
      }).success,
    ).toBe(false);
  });
});
