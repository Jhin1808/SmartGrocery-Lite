import React from "react";
import { render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { apiMe } from "../api";

jest.mock("../api", () => ({
  apiMe: jest.fn(), apiLogout: jest.fn(), AUTH_FALLBACK_STORAGE_KEY: "token",
}));
jest.mock("../demo", () => ({
  isDemo: () => false, demoGetUser: jest.fn(), enterDemo: jest.fn(), exitDemo: jest.fn(),
}));

function AuthState() {
  const { user, loading } = useAuth();
  return <div>{loading ? "Checking session" : user ? "Signed in" : "Signed out"}</div>;
}

test("a direct visit to /login checks the existing session", async () => {
  window.history.replaceState({}, "", "/login");
  apiMe.mockResolvedValueOnce({ id: 1, email: "test@example.com" });
  render(<AuthProvider><AuthState /></AuthProvider>);
  expect(await screen.findByText("Signed in")).toBeInTheDocument();
  expect(apiMe).toHaveBeenCalledTimes(1);
  window.history.replaceState({}, "", "/");
});
