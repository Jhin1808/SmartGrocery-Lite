import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DemoImportGate from './DemoImportGate';
import { apiImportDemo } from '../api';
import { pendingDemo } from '../demoTransfer';
jest.mock('../api', () => ({ apiImportDemo: jest.fn() }));
const draft = { import_key: '12345678-1234-4234-8234-123456789000', name: 'My groceries', items: [{ name: 'Milk', quantity: 1, purchased: true }] };
beforeEach(() => { jest.clearAllMocks(); sessionStorage.setItem('sg-demo-transfer', JSON.stringify(draft)); });
afterEach(() => sessionStorage.clear());

test('does not import before sign-in and preserves draft through the public page', () => {
  render(<DemoImportGate><p>Sign in form</p></DemoImportGate>);
  expect(screen.getByText('Sign in form')).toBeInTheDocument();
  expect(apiImportDemo).not.toHaveBeenCalled();expect(pendingDemo()).toEqual(draft);
});

test('successful import preserves checked state, clears draft and opens the app', async () => {
  apiImportDemo.mockResolvedValue({ name: draft.name, list_id: 9 });
  render(<DemoImportGate userId={1}><p>Shopping lists</p></DemoImportGate>);
  expect(await screen.findByText('Shopping lists')).toBeInTheDocument();
  expect(apiImportDemo).toHaveBeenCalledWith(draft);
  expect(screen.getByRole('status')).toHaveTextContent('including checked-off groceries');
  expect(pendingDemo()).toBeNull();
});

test('failed imports retain the same key and draft for a safe retry', async () => {
  apiImportDemo.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({ name: draft.name, list_id: 9 });
  render(<DemoImportGate userId={1}><p>Shopping lists</p></DemoImportGate>);
  expect(await screen.findByRole('alert')).toHaveTextContent('draft is still available');
  expect(pendingDemo()).toEqual(draft);
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving list' }));
  await screen.findByText('Shopping lists');
  expect(apiImportDemo).toHaveBeenCalledTimes(2);
  expect(apiImportDemo.mock.calls[0][0].import_key).toBe(apiImportDemo.mock.calls[1][0].import_key);
  await waitFor(() => expect(pendingDemo()).toBeNull());
});
