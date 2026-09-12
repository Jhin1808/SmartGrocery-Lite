import { render, waitFor } from "@testing-library/react";
import OAuthCallback from "./OAuthCallback";

const mockRefresh = jest.fn();
const mockNavigate = jest.fn();
let mockSearch = "";
jest.mock("./AuthContext", () => ({ useAuth: () => ({ refresh: mockRefresh }) }));
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/oauth/callback", search: mockSearch, hash: "" }),
}), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = "";
});

test("a blocked or missing session returns a visible sign-in error", async () => {
  mockRefresh.mockResolvedValue(null);
  render(<OAuthCallback />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/login?auth_error=session_missing", { replace: true }));
});

test("a verified session opens the requested local list", async () => {
  mockRefresh.mockResolvedValue({ id: 1 });
  mockSearch = "?next=%2Flists%2F7";
  render(<OAuthCallback />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/lists/7", { replace: true }));
});

test.each(["https://attacker.example", "//attacker.example", "/\\attacker.example"])(
  "an OAuth return destination cannot leave the application: %s", async (next) => {
    mockRefresh.mockResolvedValue({ id: 1 });
    mockSearch = `?next=${encodeURIComponent(next)}`;
    render(<OAuthCallback />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/lists", { replace: true }));
  }
);
