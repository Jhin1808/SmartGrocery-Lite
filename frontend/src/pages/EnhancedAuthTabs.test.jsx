import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import EnhancedAuthTabs from "./EnhancedAuthTabs";
import { useAuth } from "./AuthContext";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "" }),
  useNavigate: () => jest.fn(),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("./AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../api", () => ({
  apiLogin: jest.fn(), apiRegister: jest.fn(), googleLoginUrl: () => "/auth/google/login",
}));

beforeEach(() => useAuth.mockReturnValue({ refresh: jest.fn(), loginAsDemo: jest.fn() }));

test("password labels identify inputs and visibility controls remain keyboard accessible", () => {
  render(<EnhancedAuthTabs />);
  const password = screen.getByLabelText("Password", { selector: "input" });
  expect(password.type).toBe("password");
  const toggle = screen.getByRole("button", { name: "Show password" });
  expect(toggle.tabIndex).toBe(0);
  expect(toggle).toHaveAttribute("aria-controls", password.id);
  fireEvent.click(toggle);
  expect(password.type).toBe("text");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getByLabelText("Password", { selector: "input" })).toHaveAttribute("id", "reg-pwd");
  expect(screen.getByLabelText("Confirm password")).toHaveAttribute("id", "reg-confirm");
});

test("demo failure offers recovery instead of silently doing nothing", async () => {
  useAuth.mockReturnValue({ refresh: jest.fn(), loginAsDemo: jest.fn().mockRejectedValue(new Error("failed")) });
  render(<EnhancedAuthTabs />);
  fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
  expect(screen.getByRole("button", { name: "Try the demo" })).toBeEnabled();
  expect(screen.queryByText("Keep me signed in")).not.toBeInTheDocument();
  expect(screen.queryByText(/thousands of households/)).not.toBeInTheDocument();
});
