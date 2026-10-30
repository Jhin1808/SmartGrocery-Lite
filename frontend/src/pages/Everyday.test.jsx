import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Everyday from "./Everyday";
import * as api from "../api";

const mockUser = { id: 1 };
jest.mock("./AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("../api", () => ({
  apiEveryday: jest.fn(), apiGetLists: jest.fn(), apiGetItems: jest.fn(), apiCreateList: jest.fn(),
  apiPinStaple: jest.fn(), apiUnpinStaple: jest.fn(), apiQuickAdd: jest.fn(), apiRestock: jest.fn(),
}));
const milk = { id: 1, name: 'Milk', quantity: 2 };
const overview = { staples: [milk, { id: 2, name: 'Bread', quantity: 1 }], recent: [{ id: 4, name: 'Eggs', quantity: 12 }],
  use_first: [{ id: 20, name: 'Spinach', list_name: 'Groceries', expiry: '2026-10-31', days_left: 1 }], restocked_list_ids: [] };
beforeEach(() => {
  jest.resetAllMocks(); api.apiEveryday.mockResolvedValue(overview);
  api.apiGetLists.mockResolvedValue([{ id: 7, name: 'Groceries', owner_id: 1 }, { id: 9, name: 'Viewer list', owner_id: 2, role: 'viewer' }]);
  api.apiGetItems.mockResolvedValue([]);
  api.apiQuickAdd.mockResolvedValue({ result: 'added', list_id: 7 });
});

test('one-tap running-low shortcut adds to the chosen list and prevents repeats', async () => {
  render(<Everyday />);
  const button = await screen.findByRole('button', { name: 'Add Milk to list' });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.queryByRole('option', { name: 'Viewer list' })).not.toBeInTheDocument();
  fireEvent.click(button);
  await waitFor(() => expect(api.apiQuickAdd).toHaveBeenCalledWith({ list_id: 7, name: 'Milk', quantity: 2 }));
  expect(await screen.findByRole('button', { name: 'Milk is on your list' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Milk added to Groceries');
});

test('weekly restock reports results and retains a this-week indication', async () => {
  api.apiRestock.mockResolvedValue({ added: 1, restored: 0, already_present: 0 });
  render(<Everyday />);
  const restock = await screen.findByRole('button', { name: 'Add all missing (2)' });
  await waitFor(() => expect(restock).toBeEnabled()); fireEvent.click(restock);
  expect(await screen.findByText(/You’ve restocked this list this week/)).toBeInTheDocument();
  expect(api.apiRestock).toHaveBeenCalledWith(7);
  expect(screen.getByRole('status')).toHaveTextContent('Added 1 grocery to Groceries');
});

test('Buy again can add a grocery and pin it as a staple', async () => {
  api.apiPinStaple.mockResolvedValue({ id: 3, name: 'Eggs', quantity: 12 });
  render(<Everyday />);fireEvent.click(await screen.findByRole('button', { name: 'Buy again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Eggs to list' })).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Options for Eggs'));
  fireEvent.click(screen.getByRole('button', { name: 'Save Eggs to regulars' }));
  await waitFor(() => expect(api.apiPinStaple).toHaveBeenCalledWith({ name: 'Eggs', quantity: 12 }));
  expect(await screen.findByText('Saved to regulars')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add Eggs to list' }));
  await waitFor(() => expect(api.apiQuickAdd).toHaveBeenCalledWith({ list_id: 7, name: 'Eggs', quantity: 12 }));
});

test('Use first shows entered-date wording and routes to ingredient search', async () => {
  render(<Everyday />);fireEvent.click(await screen.findByRole('button', { name: 'Use soon' }));
  expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Find recipes' })).toHaveAttribute('href', '/recipes?ingredient=Spinach');
});

test('failed staple writes keep input and allow retry', async () => {
  api.apiPinStaple.mockRejectedValueOnce(new Error('Please retry')).mockResolvedValueOnce({ id: 3, name: 'Rice', quantity: 1 });
  render(<Everyday />);
  fireEvent.click(await screen.findByText('Save another regular grocery'));
  fireEvent.change(screen.getByLabelText('Grocery name'), { target: { value: 'Rice' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save regular' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please retry');
  expect(screen.getByLabelText('Grocery name')).toHaveValue('Rice');
  fireEvent.click(screen.getByRole('button', { name: 'Save regular' }));
  await waitFor(() => expect(screen.getByLabelText('Grocery name')).toHaveValue(''));
});

test('failed destination check disables add and can be retried', async () => {
  api.apiGetItems.mockRejectedValueOnce(new Error('List unavailable')).mockResolvedValueOnce([]);
  render(<Everyday />);
  expect(await screen.findByRole('alert')).toHaveTextContent('List unavailable');
  expect(screen.getByRole('button', { name: 'Add Milk to list' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Milk to list' })).toBeEnabled());
});

test('a new account can create an editable destination', async () => {
  api.apiGetLists.mockResolvedValue([]);api.apiCreateList.mockResolvedValue({ id: 12, name: 'This week' });
  render(<Everyday />);
  fireEvent.change(await screen.findByLabelText('First, create a shopping list'), { target: { value: 'This week' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create list' }));
  expect(await screen.findByLabelText('Shopping list')).toHaveValue('12');
});


test('restocking removes stale Use first dates and view changes clear unrelated feedback', async () => {
  api.apiEveryday.mockResolvedValue({ ...overview, use_first: [{ id: 20, list_id: 7, name: 'Milk', list_name: 'Groceries', expiry: '2026-10-31', days_left: 1 }] });
  api.apiRestock.mockResolvedValue({ added: 0, restored: 1, already_present: 0, restored_item_ids: [20] });
  render(<Everyday />);
  const button = await screen.findByRole('button', { name: 'Add all missing (2)' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  await screen.findByText(/You’ve restocked this list this week/);
  fireEvent.click(screen.getByRole('button', { name: 'Use soon' }));
  expect(screen.getByText(/No upcoming dates to check/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});


test('first visit explains the first action and saves a regular with quantity one', async () => {
  api.apiEveryday.mockResolvedValue({ ...overview, staples: [] });
  api.apiPinStaple.mockResolvedValue({ id: 3, name: 'Rice', quantity: 1 });
  render(<Everyday />);
  expect(await screen.findByText('Start by saving a grocery you buy often.')).toBeInTheDocument();
  expect(screen.getByLabelText('Grocery name').closest('details')).toHaveAttribute('open');
  expect(screen.getByRole('link', { name: 'Open list' })).toHaveAttribute('href', '/lists/7');
  fireEvent.change(screen.getByLabelText('Grocery name'), { target: { value: 'Rice' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save regular' }));
  await waitFor(() => expect(api.apiPinStaple).toHaveBeenCalledWith({ name: 'Rice', quantity: 1 }));
  expect(await screen.findByRole('button', { name: 'Add Rice to list' })).toBeEnabled();
  expect(api.apiQuickAdd).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Tap Add to list when you need it');
});

test('Use soon removes unrelated destination controls', async () => {
  render(<Everyday />);
  fireEvent.click(await screen.findByRole('button', { name: 'Use soon' }));
  expect(screen.queryByLabelText('Shopping list')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Open list' })).not.toBeInTheDocument();
});

test('unavailable backend offers a useful fallback instead of raw Not Found', async () => {
  api.apiEveryday.mockRejectedValue(new Error('Not Found'));
  render(<Everyday />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Everyday is temporarily unavailable');
  expect(screen.getByRole('link', { name: 'Open shopping lists' })).toHaveAttribute('href', '/lists');
  expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
});

test('an account without a list is directed to create one before saving regulars', async () => {
  api.apiGetLists.mockResolvedValue([]);
  api.apiEveryday.mockResolvedValue({ ...overview, staples: [] });
  render(<Everyday />);
  expect(await screen.findByText('First, create a shopping list for your groceries.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Grocery name')).not.toBeInTheDocument();
  expect(screen.getByLabelText('First, create a shopping list')).toBeInTheDocument();
});

test('switching destination checks that list and opens the matching list page', async () => {
  api.apiGetLists.mockResolvedValue([{ id: 7, name: 'Groceries', owner_id: 1 }, { id: 12, name: 'Weekend', owner_id: 1 }]);
  api.apiGetItems.mockImplementation(async (id) => id === 12 ? [{ name: 'Milk', purchased: false }] : []);
  render(<Everyday />);
  fireEvent.change(await screen.findByLabelText('Shopping list'), { target: { value: '12' } });
  expect(screen.getByRole('link', { name: 'Open list' })).toHaveAttribute('href', '/lists/12');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Milk is on your list' })).toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Add Bread to list' }));
  await waitFor(() => expect(api.apiQuickAdd).toHaveBeenCalledWith({ list_id: 12, name: 'Bread', quantity: 1 }));
});

test('removing a regular leaves the shopping list untouched', async () => {
  api.apiUnpinStaple.mockResolvedValue({});
  render(<Everyday />);
  fireEvent.click(await screen.findByLabelText('Options for Milk'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Milk from regulars' }));
  await waitFor(() => expect(api.apiUnpinStaple).toHaveBeenCalledWith(1));
  expect(await screen.findByRole('status')).toHaveTextContent('Your shopping list hasn’t changed');
  expect(screen.queryByRole('button', { name: 'Add Milk to list' })).not.toBeInTheDocument();
  expect(api.apiQuickAdd).not.toHaveBeenCalled();
});
