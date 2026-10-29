import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecipeDetail } from "./Recipes";
import { apiRecipeDetail, apiRecipeAddToList } from "../api";
import { safeCreateList } from "../apiSafe";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../api", () => ({
  apiRecipeDetail: jest.fn(), apiRecipeAddToList: jest.fn(), FEATURE_RECIPES: true,
}));
jest.mock("../apiSafe", () => ({ safeCreateList: jest.fn(), safeGetLists: jest.fn() }));
jest.mock("./AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../demo", () => ({ isDemo: () => false, subscribeDemo: jest.fn() }));

const existing = [{ id: 7, name: "Weekly groceries" }];
const created = { id: 12, name: "Dinner" };
beforeEach(() => {
  jest.resetAllMocks();
  apiRecipeDetail.mockResolvedValue({ external_id: "42", title: "Tomato pasta", ingredients: [{ name: "Tomato", measure: "2" }] });
  apiRecipeAddToList.mockResolvedValue({ added: 1, skipped: [] });
  safeCreateList.mockResolvedValue(created);
});
function setup(lists = existing) {
  const onAdded = jest.fn();
  const onListCreated = jest.fn();
  const props = { recipeId: "42", lists, onAdded, onListCreated, onClose: jest.fn() };
  const view = render(<RecipeDetail {...props} />);
  return { ...view, props, onAdded, onListCreated };
}

test("creates a named list and fills it with recipe ingredients", async () => {
  const { onAdded, onListCreated } = setup();
  await screen.findByLabelText("Shopping list");
  fireEvent.change(screen.getByLabelText("Shopping list"), { target: { value: "new" } });
  expect(screen.getByLabelText("New list name")).toHaveValue("Tomato pasta");
  fireEvent.change(screen.getByLabelText("New list name"), { target: { value: " Dinner " } });
  fireEvent.click(screen.getByRole("button", { name: "Create list & add ingredients" }));
  await screen.findByRole("status");
  expect(safeCreateList).toHaveBeenCalledWith("Dinner");
  expect(onListCreated).toHaveBeenCalledWith(created);
  expect(apiRecipeAddToList).toHaveBeenCalledWith("42", 12);
  expect(onAdded).toHaveBeenCalledWith({ added: 1, skipped: [], listId: 12, listName: "Dinner" });
  expect(screen.getByRole("link", { name: "View lists" })).toHaveAttribute("href", "/lists");
});

test("offers creation when the user has no lists and rejects blank names", async () => {
  setup([]);
  const input = await screen.findByLabelText("New list name");
  expect(input).toHaveValue("Tomato pasta");
  fireEvent.change(input, { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "Create list & add ingredients" })).toBeDisabled();
  expect(safeCreateList).not.toHaveBeenCalled();
});

test("existing lists still receive ingredients without creating a new one", async () => {
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Add ingredients" }));
  await screen.findByRole("status");
  expect(apiRecipeAddToList).toHaveBeenCalledWith("42", 7);
  expect(safeCreateList).not.toHaveBeenCalled();
});

test("a creation failure leaves the entered name available for retry", async () => {
  safeCreateList.mockRejectedValueOnce(new Error("Couldn't create list"));
  setup([]);
  fireEvent.click(await screen.findByRole("button", { name: "Create list & add ingredients" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't create list");
  expect(screen.getByLabelText("New list name")).toHaveValue("Tomato pasta");
  expect(apiRecipeAddToList).not.toHaveBeenCalled();
});

test("retries ingredients on the created list without making a duplicate", async () => {
  apiRecipeAddToList.mockRejectedValueOnce(new Error("Try adding ingredients again"));
  const { props, rerender, onListCreated } = setup([]);
  fireEvent.click(await screen.findByRole("button", { name: "Create list & add ingredients" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try adding ingredients again");
  expect(onListCreated).toHaveBeenCalledWith(created);
  rerender(<RecipeDetail {...props} lists={[created]} />);
  expect(screen.getByLabelText("Shopping list")).toHaveValue("12");
  fireEvent.click(screen.getByRole("button", { name: "Add ingredients" }));
  await waitFor(() => expect(apiRecipeAddToList).toHaveBeenCalledTimes(2));
  expect(safeCreateList).toHaveBeenCalledTimes(1);
  expect(apiRecipeAddToList).toHaveBeenLastCalledWith("42", 12);
  await screen.findByRole("status");
});
