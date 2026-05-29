import { clearSessionCaches } from "./AuthContext";

test("clearSessionCaches resets list caches from the previous session", () => {
  window.__sg_listsCache = { data: [{ id: 1 }], hidden: false, time: 123 };
  window.__sg_listsCacheHidden = { data: [{ id: 2 }], hidden: true, time: 456 };
  window.__sg_itemsCache = { 1: [{ id: 10, name: "Milk" }] };

  clearSessionCaches();

  expect(window.__sg_listsCache).toEqual({ data: null, hidden: false, time: 0 });
  expect(window.__sg_listsCacheHidden).toEqual({ data: null, hidden: true, time: 0 });
  expect(window.__sg_itemsCache).toEqual({});
});
