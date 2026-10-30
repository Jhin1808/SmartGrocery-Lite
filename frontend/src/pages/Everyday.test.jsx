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
const overview = { staples: [milk], recent: [{ id: 4, name: 'Eggs', quantity: 12 }],
  use_first: [{ id: 20, name: 'Spinach', list_name: 'Groceries', expiry: '2026-10-31', days_left: 1 }], restocked_list_ids: [] };
beforeEach(() => {
  jest.resetAllMocks(); api.apiEveryday.mockResolvedValue(overview);
  api.apiGetLists.mockResolvedValue([{ id: 7, name: 'Groceries', owner_id: 1 }, { id: 9, name: 'Viewer list', owner_id: 2, role: 'viewer' }]);
  api.apiGetItems.mockResolvedValue([]);
  api.apiQuickAdd.mockResolvedValue({ result: 'added', list_id: 7 });
});

test('one-tap running-low shortcut adds to the chosen list and prevents repeats', async () => {
  render(<Everyday />);
  const button = await screen.findByRole('button', { name: 'We’re out of Milk' });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.queryByRole('option', { name: 'Viewer list' })).not.toBeInTheDocument();
  fireEvent.click(button);
  await waitFor(() => expect(api.apiQuickAdd).toHaveBeenCalledWith({ list_id: 7, name: 'Milk', quantity: 2 }));
  expect(await screen.findByRole('button', { name: 'Already on list Milk' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Milk added to Groceries');
});

test('weekly restock reports results and retains a this-week indication', async () => {
  api.apiRestock.mockResolvedValue({ added: 1, restored: 0, already_present: 0 });
  render(<Everyday />);
  const restock = await screen.findByRole('button', { name: 'Restock staples' });
  await waitFor(() => expect(restock).toBeEnabled()); fireEvent.click(restock);
  expect(await screen.findByText(/You’ve restocked this list this week/)).toBeInTheDocument();
  expect(api.apiRestock).toHaveBeenCalledWith(7);
  expect(screen.getByRole('status')).toHaveTextContent('1 added, 0 restored');
});

test('Buy again can add a grocery and pin it as a staple', async () => {
  api.apiPinStaple.mockResolvedValue({ id: 2, name: 'Eggs', quantity: 12 });
  render(<Everyday />);fireEvent.click(await screen.findByRole('button', { name: 'Buy again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy again: Eggs' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Make Eggs a staple' }));
  await waitFor(() => expect(api.apiPinStaple).toHaveBeenCalledWith({ name: 'Eggs', quantity: 12 }));
  expect(await screen.findByText('Pinned')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Buy again: Eggs' }));
  await waitFor(() => expect(api.apiQuickAdd).toHaveBeenCalledWith({ list_id: 7, name: 'Eggs', quantity: 12 }));
});

test('Use first shows entered-date wording and routes to ingredient search', async () => {
  render(<Everyday />);fireEvent.click(await screen.findByRole('button', { name: 'Use first' }));
  expect(screen.getByText('Tomorrow · Groceries')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Find recipes' })).toHaveAttribute('href', '/recipes?ingredient=Spinach');
});

test('failed staple writes keep input and allow retry', async () => {
  api.apiPinStaple.mockRejectedValueOnce(new Error('Please retry')).mockResolvedValueOnce({ id: 3, name: 'Bread', quantity: 1 });
  render(<Everyday />);
  fireEvent.change(await screen.findByLabelText('Grocery'), { target: { value: 'Bread' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pin staple' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please retry');
  expect(screen.getByLabelText('Grocery')).toHaveValue('Bread');
  fireEvent.click(screen.getByRole('button', { name: 'Pin staple' }));
  await waitFor(() => expect(screen.getByLabelText('Grocery')).toHaveValue(''));
});

test('failed destination check disables add and can be retried', async () => {
  api.apiGetItems.mockRejectedValueOnce(new Error('List unavailable')).mockResolvedValueOnce([]);
  render(<Everyday />);
  expect(await screen.findByRole('alert')).toHaveTextContent('List unavailable');
  expect(screen.getByRole('button', { name: 'We’re out of Milk' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'We’re out of Milk' })).toBeEnabled());
});

test('a new account can create an editable destination', async () => {
  api.apiGetLists.mockResolvedValue([]);api.apiCreateList.mockResolvedValue({ id: 12, name: 'This week' });
  render(<Everyday />);
  fireEvent.change(await screen.findByLabelText('Create a list for your groceries'), { target: { value: 'This week' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create list' }));
  expect(await screen.findByLabelText('Add groceries to')).toHaveValue('12');
});


test('restocking removes stale Use first dates and view changes clear unrelated feedback', async () => {
  api.apiEveryday.mockResolvedValue({ ...overview, use_first: [{ id: 20, list_id: 7, name: 'Milk', list_name: 'Groceries', expiry: '2026-10-31', days_left: 1 }] });
  api.apiRestock.mockResolvedValue({ added: 0, restored: 1, already_present: 0, restored_item_ids: [20] });
  render(<Everyday />);
  const button = await screen.findByRole('button', { name: 'Restock staples' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  await screen.findByText(/You’ve restocked this list this week/);
  fireEvent.click(screen.getByRole('button', { name: 'Use first' }));
  expect(screen.getByText(/Nothing with an upcoming entered date/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
