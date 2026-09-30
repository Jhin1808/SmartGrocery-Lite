import { render, screen } from "@testing-library/react";
jest.mock("react-router-dom", () => ({Link: ({children, to}) => <a href={to}>{children}</a>}), {virtual:true});
import Stores from "./Stores";
import Templates from "./Templates";
import * as api from "../api";
jest.mock("../demo", () => ({ isDemo: () => true }));
jest.mock("./AuthContext", () => ({ useAuth: () => ({logout: jest.fn()}) }));
jest.mock("../api", () => ({ FEATURE_KROGER: true, FEATURE_TEMPLATES: true, apiKrogerStatus: jest.fn(), apiListTemplates: jest.fn(), apiTemplateCategories: jest.fn() }));
it.each([["stores", Stores], ["templates", Templates]])("keeps demo %s off account-only APIs", (_, Page) => {
  render(<Page />);
  expect(screen.getByRole("link", {name: "Exit demo and sign in"})).toHaveAttribute("href", "/login");
  expect(screen.getByRole("link", {name: "Back to demo lists"})).toHaveAttribute("href", "/lists");
  expect(api.apiKrogerStatus).not.toHaveBeenCalled();
  expect(api.apiListTemplates).not.toHaveBeenCalled();
  expect(api.apiTemplateCategories).not.toHaveBeenCalled();
});
