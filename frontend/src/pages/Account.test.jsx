import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Account from "./Account";
import { apiUpdateMe } from "../api";
const mockUser = { id: 1, name: "Alex", email: "alex@example.com", picture: "https://example.com/provider.png" };
const mockRefresh = jest.fn().mockResolvedValue({});
jest.mock("./AuthContext", () => ({ useAuth: () => ({ user: mockUser, refresh: mockRefresh }) }));
jest.mock("../api", () => ({ apiUpdateMe: jest.fn(), apiChangePassword: jest.fn() }));
test("profile has no avatar URL editor and saves only the display name", async () => {
  apiUpdateMe.mockResolvedValue({});
  render(<Account />);
  expect(screen.queryByLabelText("Avatar URL")).not.toBeInTheDocument();
  expect(document.querySelector('input[type="url"]')).toBeNull();
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Alex Smith" } });
  fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));
  await waitFor(() => expect(apiUpdateMe).toHaveBeenCalledWith({ name: "Alex Smith" }));
});
