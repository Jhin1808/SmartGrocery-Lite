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
  fireEvent.click(screen.getByRole("button", { name: "Try demo mode" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
  expect(screen.getByRole("button", { name: "Try demo mode" })).toBeEnabled();
  expect(screen.queryByText("Keep me signed in")).not.toBeInTheDocument();
  expect(screen.queryByText(/thousands of households/)).not.toBeInTheDocument();
});


test("the account-free demo entry appears before credentials on both account views", () => {
  render(<EnhancedAuthTabs />);
  const demo = screen.getByRole("button", { name: "Try demo mode" });
  expect(demo.compareDocumentPosition(screen.getByLabelText("Email")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText(/No sign-in or account needed/)).toBeInTheDocument();
  expect(screen.getByText("Demo lists reset when you refresh or leave.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getAllByRole("button", { name: "Try demo mode" })).toHaveLength(1);
  expect(demo.compareDocumentPosition(screen.getByLabelText("Email")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
