import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResetPassword from "./ResetPassword";
import { apiForgotPassword, apiPasswordResetConfig } from "../api";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ search: "" }),
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../api", () => ({
  apiForgotPassword: jest.fn(),
  apiPasswordResetConfig: jest.fn(),
  apiResetPassword: jest.fn(),
}));

afterEach(() => { delete window.turnstile; jest.clearAllMocks(); });

test("the reset form waits for CAPTCHA and shows a verification failure", async () => {
  let verify;
  window.turnstile = {
    render: jest.fn((_element, options) => { verify = options.callback; return "widget-1"; }),
    remove: jest.fn(),
  };
  apiPasswordResetConfig.mockResolvedValue({ captcha_required: true, site_key: "public-test-key" });
  apiForgotPassword.mockRejectedValue({ status: 400, message: "Captcha invalid" });

  render(<ResetPassword />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
  const send = screen.getByRole("button", { name: "Send reset code" });
  await screen.findByLabelText("Human verification");
  expect(send).toBeDisabled();
  act(() => verify("captcha-token"));
  expect(send).toBeEnabled();

  fireEvent.click(send);
  await waitFor(() => expect(apiForgotPassword).toHaveBeenCalledWith("test@example.com", "captcha-token"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Verification failed or expired");
  expect(screen.queryByText(/check your inbox for a reset code/i)).not.toBeInTheDocument();
});
