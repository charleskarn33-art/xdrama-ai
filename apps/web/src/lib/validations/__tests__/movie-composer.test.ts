import { describe, expect, it } from "vitest";

import {
  addClipSchema,
  createTimelineSchema,
  updateClipSchema,
} from "@/lib/validations/movie-composer";

const projectId = "11111111-1111-4111-8111-111111111111";
const timelineId = "22222222-2222-4222-8222-222222222222";
const shotId = "33333333-3333-4333-8333-333333333333";
const clipId = "44444444-4444-4444-8444-444444444444";

describe("createTimelineSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      createTimelineSchema.safeParse({ projectId, name: "Rough Cut" }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      createTimelineSchema.safeParse({ projectId, name: " " }).success,
    ).toBe(false);
  });
});

describe("addClipSchema", () => {
  it("accepts a minimal payload", () => {
    expect(
      addClipSchema.safeParse({
        timelineId,
        shotId,
        clipOrder: 1,
        transitionIn: "cut",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing transitionIn", () => {
    expect(
      addClipSchema.safeParse({ timelineId, shotId, clipOrder: 1 }).success,
    ).toBe(false);
  });

  it("accepts valid trim points", () => {
    expect(
      addClipSchema.safeParse({
        timelineId,
        shotId,
        clipOrder: 1,
        transitionIn: "cut",
        trimStartSeconds: 1,
        trimEndSeconds: 4,
      }).success,
    ).toBe(true);
  });

  it("rejects trimEndSeconds before trimStartSeconds", () => {
    expect(
      addClipSchema.safeParse({
        timelineId,
        shotId,
        clipOrder: 1,
        transitionIn: "cut",
        trimStartSeconds: 5,
        trimEndSeconds: 2,
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown transition", () => {
    expect(
      addClipSchema.safeParse({
        timelineId,
        shotId,
        clipOrder: 1,
        transitionIn: "spin",
      }).success,
    ).toBe(false);
  });
});

describe("updateClipSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      updateClipSchema.safeParse({ clipId, clipOrder: 2, transitionIn: "fade" })
        .success,
    ).toBe(true);
  });

  it("rejects trimEndSeconds equal to trimStartSeconds", () => {
    expect(
      updateClipSchema.safeParse({
        clipId,
        clipOrder: 2,
        transitionIn: "cut",
        trimStartSeconds: 3,
        trimEndSeconds: 3,
      }).success,
    ).toBe(false);
  });
});
