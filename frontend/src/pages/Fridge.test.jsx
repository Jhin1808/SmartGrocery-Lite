import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Fridge from "./Fridge";
import * as api from "../api";
jest.mock("react-router-dom", () => ({Link: ({children, to}) => <a href={to}>{children}</a>}), {virtual:true});
jest.mock("../demo", () => ({isDemo: () => false}));
jest.mock("../api", () => ({apiFridge:jest.fn(),apiSaveFood:jest.fn(),apiRemoveFood:jest.fn(),apiFridgeMeals:jest.fn(),apiGetLists:jest.fn(),apiMissingToList:jest.fn()}));
beforeEach(() => {jest.clearAllMocks();api.apiFridge.mockResolvedValue([]);api.apiGetLists.mockResolvedValue([{id:7,name:"Weekly shop",role:"owner"}]);});

test("saves food with an optional date and displays the persisted inventory", async () => {
  api.apiFridge.mockResolvedValueOnce([]).mockResolvedValue([{id:1,name:"Eggs",quantity:6,unit:"items",expiry:null}]);
  render(<Fridge />);
  await screen.findByText("What’s on hand");
  fireEvent.change(screen.getByLabelText("Food"),{target:{value:"Eggs"}});
  fireEvent.change(screen.getByLabelText("Quantity"),{target:{value:"6"}});
  fireEvent.click(screen.getByRole("button",{name:"Add food"}));
  await waitFor(() => expect(api.apiSaveFood).toHaveBeenCalledWith({name:"Eggs",quantity:6,unit:"items",expiry:null},null));
  expect(await screen.findByRole("button",{name:"Edit Eggs"})).toBeInTheDocument();
});

test("uses available food for meals and adds missing ingredients to the chosen list", async () => {
  api.apiFridge.mockResolvedValue([{id:1,name:"Chicken",quantity:1,unit:"items",expiry:null},{id:2,name:"Milk",quantity:1,unit:"items",expiry:"2000-01-01"}]);
  api.apiFridgeMeals.mockResolvedValue([{external_id:"123",title:"Dinner",have:[{original:"Chicken"}],missing:[{original:"Salt"}]}]);
  api.apiMissingToList.mockResolvedValue({added:1});
  render(<Fridge />);
  const ingredient=await screen.findByRole("combobox",{name:"Ingredient to cook with"});
  expect(screen.queryByRole("option",{name:"Milk"})).not.toBeInTheDocument();
  fireEvent.change(ingredient,{target:{value:"Chicken"}});
  fireEvent.click(screen.getByRole("button",{name:"Find meals"}));
  expect(await screen.findByText("Dinner")).toBeInTheDocument();
  const add=screen.getByRole("button",{name:"Add missing to list"});
  expect(add).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Grocery list for missing ingredients"),{target:{value:"7"}});
  fireEvent.click(add);
  await waitFor(() => expect(api.apiMissingToList).toHaveBeenCalledWith("123","7"));
  expect(await screen.findByText(/1 missing ingredients added/)).toBeInTheDocument();
});
