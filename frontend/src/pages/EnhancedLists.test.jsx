import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import fs from "fs";
import path from "path";
import EnhancedLists from "./EnhancedLists";
import * as apiSafe from "../apiSafe";

jest.mock("./AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "owner@example.com" },
    logout: jest.fn(),
  }),
}));

jest.mock("../demo", () => ({
  isDemo: () => false,
  subscribeDemo: () => () => {},
}));

jest.mock("../api", () => ({
  FEATURE_CATALOG: false,
}));

jest.mock("../apiSafe", () => ({
  safeGetLists: jest.fn(),
  safeGetItems: jest.fn(),
  safeGetShares: jest.fn(),
  safeAddItem: jest.fn(),
  safeUpdateItem: jest.fn(),
  safeDeleteItem: jest.fn(),
  safeCreateList: jest.fn(),
  safeRenameList: jest.fn(),
  safeDeleteList: jest.fn(),
  safeHideList: jest.fn(),
  safeUnhideList: jest.fn(),
  safeAddShare: jest.fn(),
  safeUpdateShare: jest.fn(),
  safeRevokeShare: jest.fn(),
  safeGetShareLink: jest.fn(),
}));

jest.mock("../components/CategoryBadge", () => ({
  __esModule: true,
  default: () => null,
  categoryColor: () => "#94a3b8",
  categoryIcon: () => "bi-tag",
}));

jest.mock("../components/WeightDisplay", () => () => null);
jest.mock("../components/PriceDisplay", () => () => null);
jest.mock("../components/ItemTypeahead", () => () => <input aria-label="Item name" />);
jest.mock("../components/BarcodeScanner", () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  apiSafe.safeGetLists.mockResolvedValue([]);
  apiSafe.safeGetItems.mockResolvedValue([]);
  apiSafe.safeGetShares.mockResolvedValue([]);
  apiSafe.safeGetShareLink.mockResolvedValue("https://example.test/share/1");
});

test("keeps a manually created list visible when the refresh does not include it yet", async () => {
  apiSafe.safeGetLists.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  apiSafe.safeCreateList.mockResolvedValue({
    id: 42,
    name: "Weekend run",
    owner_id: 1,
    hidden: false,
  });

  render(<EnhancedLists />);

  await screen.findByText("No lists yet");
  fireEvent.change(screen.getByPlaceholderText(/new list/i), {
    target: { value: "Weekend run" },
  });

  const createButton = screen.getByRole("button", { name: /create list/i });
  expect(createButton).toBeEnabled();
  fireEvent.click(createButton);

  await waitFor(() => expect(apiSafe.safeCreateList).toHaveBeenCalledWith("Weekend run"));
  const createdNames = await screen.findAllByText("Weekend run");
  const createdRow = createdNames.map((node) => node.closest(".lm-list__item")).find(Boolean);
  expect(createdRow).toBeInTheDocument();
});

test("keeps sidebar share action and item count in a non-overlapping trailing group", async () => {
  apiSafe.safeGetLists.mockResolvedValueOnce([
    { id: 7, name: "Groceries", owner_id: 1, hidden: false },
  ]);
  apiSafe.safeGetItems.mockResolvedValueOnce([
    { id: 1, name: "Milk", quantity: 1, purchased: false },
    { id: 2, name: "Bread", quantity: 1, purchased: true },
  ]);

  render(<EnhancedLists />);

  const listNames = await screen.findAllByText("Groceries");
  const listRow = listNames.map((node) => node.closest(".lm-list__item")).find(Boolean);
  expect(listRow).not.toBeNull();

  const actions = listRow.querySelector(".lm-list__item-actions");
  expect(actions).not.toBeNull();
  expect(within(actions).getByText("1")).toBeInTheDocument();
  expect(within(actions).getByLabelText("Share Groceries")).toBeInTheDocument();
});

test("keeps sidebar share buttons visible in normal flow instead of overlay positioning", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "theme.css"), "utf8");
  const shareRule = css.match(/\.lm-list__item-share\s*\{([^}]*)\}/)?.[1] || "";

  expect(shareRule).not.toMatch(/position:\s*absolute/);
  expect(shareRule).not.toMatch(/opacity:\s*0\s*;/);
  expect(shareRule).not.toMatch(/pointer-events:\s*none/);
});
