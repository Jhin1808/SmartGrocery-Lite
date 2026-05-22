test("bearer-token localStorage fallback is disabled by default", () => {
  jest.resetModules();
  delete process.env.REACT_APP_AUTH_HEADER_FALLBACK_ENABLED;

  const { AUTH_HEADER_FALLBACK_ENABLED } = require("./api");

  expect(AUTH_HEADER_FALLBACK_ENABLED).toBe(false);
});
