import { fireEvent, render, screen } from "@testing-library/react";
import DemoLists from "./DemoLists";
import { enterDemo, exitDemo } from "../demo";

const mockNavigate = jest.fn();
const mockLogout = jest.fn(async () => exitDemo());
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("./AuthContext", () => ({ useAuth: () => ({ logout: mockLogout }) }));

beforeEach(() => { jest.clearAllMocks(); enterDemo(); });
afterEach(exitDemo);

test("creates a list and adds/removes groceries, preserving keyboard focus", () => {
  render(<DemoLists />);
  fireEvent.change(screen.getByLabelText("Create a grocery list"), { target: { value: " Saturday " } });
  fireEvent.click(screen.getByRole("button", { name: "Create list" }));
  expect(screen.getByRole("heading", { name: "Saturday" })).toBeInTheDocument();
  expect(screen.getByLabelText("Add a grocery")).toHaveFocus();
  expect(screen.getByText(/Add the first thing/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Add a grocery"), { target: { value: " Apples " } });
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  expect(screen.getByText("Apples")).toBeInTheDocument();
  expect(screen.getByLabelText("Add a grocery")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Remove Apples" }));
  expect(screen.queryByText("Apples")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Add a grocery")).toHaveFocus();
  fireEvent.change(screen.getByLabelText("Switch list"), { target: { value: "1" } });
  expect(screen.getByText("Milk")).toBeInTheDocument();
  expect(screen.queryByText(/Recipes|Sharing|Shop mode/)).not.toBeInTheDocument();
});

test("does not create blank lists or items, and exits without a backend call", async () => {
  render(<DemoLists />);
  fireEvent.change(screen.getByLabelText("Create a grocery list"), { target: { value: "  " } });
  expect(screen.getByRole("button", { name: "Create list" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add item" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Exit demo" }));
  expect(await screen.findByRole("heading", { name: /A little list/ })).toBeInTheDocument();
  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
});

test("crosses groceries off and restores them with a second click, retaining state between lists", () => {
  render(<DemoLists />);
  const milk = screen.getByRole("checkbox", { name: "Milk" });
  expect(milk).not.toBeChecked();
  fireEvent.click(milk);
  expect(milk).toBeChecked();
  expect(screen.getByText("Milk").closest("li")).toHaveClass("is-bought");
  expect(screen.getByRole("status")).toHaveTextContent("Milk crossed off as bought");
  expect(screen.getByText("2 to buy · 1 bought")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Create a grocery list"), { target: { value: "Dinner" } });
  fireEvent.click(screen.getByRole("button", { name: "Create list" }));
  fireEvent.change(screen.getByLabelText("Switch list"), { target: { value: "1" } });
  const savedMilk = screen.getByRole("checkbox", { name: /Milk/ });
  expect(savedMilk).toBeChecked();
  fireEvent.click(savedMilk);
  expect(savedMilk).not.toBeChecked();
  expect(screen.getByText("3 to buy · 0 bought")).toBeInTheDocument();
});

test("new groceries appear after the existing entries and start unchecked", () => {
  render(<DemoLists />);
  fireEvent.change(screen.getByLabelText("Add a grocery"), { target: { value: "Apples" } });
  fireEvent.submit(screen.getByLabelText("Add a grocery").closest("form"));
  expect(screen.getAllByRole("checkbox").map((input) => input.closest("label").querySelector('.simple-demo-item-name').textContent))
    .toEqual(["Milk", "Bread", "Eggs", "Apples"]);
  expect(screen.getByRole("checkbox", { name: "Apples" })).not.toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("Added Apples");
});
