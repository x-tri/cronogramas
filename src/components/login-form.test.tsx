import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("LoginForm", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exibe erro controlado quando Google OAuth não está habilitado", async () => {
    vi.stubEnv("VITE_ENABLE_GOOGLE_AUTH", "false");

    const [{ LoginForm }, { GOOGLE_AUTH_DISABLED_MESSAGE }] = await Promise.all([
      import("./login-form"),
      import("../lib/auth"),
    ]);

    const onLoginSuccess = vi.fn();
    const user = userEvent.setup();

    render(<LoginForm onLoginSuccess={onLoginSuccess} />);

    await user.click(screen.getByRole("button", { name: /entrar com google/i }));

    expect(await screen.findByText(GOOGLE_AUTH_DISABLED_MESSAGE)).toBeInTheDocument();
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});
