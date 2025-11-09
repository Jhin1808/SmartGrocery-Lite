import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/login");
  });

  it("renders the login tab by default", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /login/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign in with/i)).toBeInTheDocument();
  });
});
