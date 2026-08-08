import { describe, expect, it } from "vitest";

import {
  createOrganizationSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validations/auth";

describe("signUpSchema", () => {
  it("accepts a valid payload", () => {
    const result = signUpSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "supersecret",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = signUpSchema.safeParse({
      fullName: "Ada",
      email: "ada@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({
      fullName: "Ada",
      email: "not-an-email",
      password: "supersecret",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = signUpSchema.safeParse({
      fullName: "  ",
      email: "ada@example.com",
      password: "supersecret",
    });
    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      signInSchema.safeParse({ email: "ada@example.com", password: "x" })
        .success,
    ).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(
      signInSchema.safeParse({ email: "ada@example.com", password: "" })
        .success,
    ).toBe(false);
  });
});

describe("createOrganizationSchema", () => {
  it("accepts a valid slug", () => {
    expect(
      createOrganizationSchema.safeParse({
        name: "Acme Pictures",
        slug: "acme-pictures",
      }).success,
    ).toBe(true);
  });

  it.each(["Acme Pictures", "acme_pictures", "-acme", "acme-", "ac me"])(
    "rejects an invalid slug: %s",
    (slug) => {
      expect(
        createOrganizationSchema.safeParse({ name: "Acme", slug }).success,
      ).toBe(false);
    },
  );

  it("lowercases the slug before validating", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      slug: "ACME-pictures",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("acme-pictures");
    }
  });
});
