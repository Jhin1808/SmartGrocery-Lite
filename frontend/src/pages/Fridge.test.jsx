import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Fridge from "./Fridge";
import * as api from "../api";
jest.mock("react-router-dom", () => ({Link: ({children, to}) => <a href={to}>{children}</a>}), {virtual:true});
jest.mock("../demo", () => ({isDemo: () => false}));
jest.mock("../api", () => ({apiFridge:jest.fn(),apiSaveFood:jest.fn(),apiRemoveFood:jest.fn(),apiFridgeMeals:jest.fn(),apiGetLists:jest.fn(),apiMissingToList:jest.fn()}));
beforeEach(() => {jest.clearAllMocks();api.apiFridge.mockResolvedValue([]);api.apiGetLists.mockResolvedValue([{id:7,name:"Weekly shop",role:"owner"}]);});

test("checks common food and persists it", async () => {
  api.apiSaveFood.mockResolvedValue({id:1,name:"Eggs",quantity:1,unit:"items",expiry:null});
  render(<Fridge />);
  const eggs = await screen.findByRole("checkbox",{name:"Eggs"});
  fireEvent.click(eggs);
  await waitFor(() => expect(api.apiSaveFood).toHaveBeenCalledWith({name:"Eggs",quantity:1,unit:"items",expiry:null}));
  await waitFor(() => expect(eggs).toBeChecked());
  fireEvent.click(eggs);
  await waitFor(() => expect(api.apiRemoveFood).toHaveBeenCalledWith(1));
  await waitFor(() => expect(eggs).not.toBeChecked());
});

test("adds another ingredient through a single field", async () => {
  api.apiSaveFood.mockResolvedValue({id:2,name:"Mushrooms",quantity:1,unit:"items",expiry:null});
  render(<Fridge />);
  const input=await screen.findByLabelText("Add another ingredient");
  fireEvent.change(input,{target:{value:"Mushrooms"}});
  fireEvent.click(screen.getByRole("button",{name:"Add ingredient"}));
  expect(await screen.findByRole("checkbox",{name:"Mushrooms"})).toBeChecked();
});

test("searches recipes by name and adds missing ingredients to the chosen list", async () => {
  api.apiFridge.mockResolvedValue([{id:1,name:"Chicken",quantity:1,unit:"items",expiry:null},{id:2,name:"Milk",quantity:1,unit:"items",expiry:"2000-01-01"}]);
  api.apiFridgeMeals.mockResolvedValue([{external_id:"123",title:"Dinner",have:[{original:"Chicken"}],missing:[{original:"Salt"}]}]);
  api.apiMissingToList.mockResolvedValue({added:1});
  render(<Fridge />);
  const query=await screen.findByLabelText("Search recipes");
  expect(screen.getByRole("checkbox",{name:"Chicken"})).toBeChecked();
  expect(screen.getByRole("checkbox",{name:"Milk"})).not.toBeChecked();
  fireEvent.change(query,{target:{value:"Dinner"}});
  fireEvent.click(screen.getByRole("button",{name:"Find recipes"}));
  expect(await screen.findByText("Dinner")).toBeInTheDocument();
  expect(api.apiFridgeMeals).toHaveBeenCalledWith("","Dinner");
  const add=screen.getByRole("button",{name:"Add missing to list"});
  expect(add).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Missing ingredients go to"),{target:{value:"7"}});
  fireEvent.click(add);
  await waitFor(() => expect(api.apiMissingToList).toHaveBeenCalledWith("123","7"));
  expect(await screen.findByText(/1 ingredients added/)).toBeInTheDocument();
});
