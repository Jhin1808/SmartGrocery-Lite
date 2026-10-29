import { render, cleanup } from "@testing-library/react";
import PageMetadata from "./PageMetadata";

let mockPathname = "/";
jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: mockPathname }),
}), { virtual: true });

beforeEach(() => {
  document.head.innerHTML = '<link rel="canonical" href="https://www.tobuylists.com/login">';
});
afterEach(cleanup);

test.each([
  ["/", "/login", "index, follow"],
  ["/login", "/login", "index, follow"],
  ["/terms", "/terms", "index, follow"],
  ["/lists/42", "/lists/42", "noindex, follow"],
  ["/reset", "/reset", "noindex, follow"],
])("sets canonical and indexing rules for %s", (path, canonical, robots) => {
  mockPathname = path;
  render(<PageMetadata />);
  expect(document.querySelector('link[rel="canonical"]').href).toBe(`https://www.tobuylists.com${canonical}`);
  expect(document.querySelector('meta[name="robots"]').content).toBe(robots);
  expect(document.querySelector('meta[property="og:url"]').content).toBe(`https://www.tobuylists.com${canonical}`);
  expect(document.querySelector('meta[name="description"]').content).toContain(path === "/terms" ? "terms of service" : "share grocery lists");
});
