import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { signIn } from "@/app/(auth)/actions";

vi.mock("@/app/(auth)/actions", () => ({
  signIn: vi.fn(),
}));

const signInMock = vi.mocked(signIn);

describe("LoginForm", () => {
  it("shows validation errors and never calls signIn for empty input", async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("calls signIn with the entered credentials", async () => {
    signInMock.mockResolvedValue({ error: null });

    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "supersecret",
      }),
    );
  });

  it("surfaces a server-returned error", async () => {
    signInMock.mockResolvedValue({ error: "Invalid login credentials" });

    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid login credentials"),
    ).toBeInTheDocument();
  });
});
