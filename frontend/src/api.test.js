test("bearer-token localStorage fallback is disabled by default", () => {
  jest.resetModules();
  delete process.env.REACT_APP_AUTH_HEADER_FALLBACK_ENABLED;

  const { AUTH_HEADER_FALLBACK_ENABLED } = require("./api");

  expect(AUTH_HEADER_FALLBACK_ENABLED).toBe(false);
});

test("wrong API routing cannot turn the frontend HTML into an authenticated user", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, status: 200, headers: { get: () => "text/html" },
    text: async () => "<!doctype html><div id='root'></div>",
  });
  try {
    const { apiMe } = require("./api");
    await expect(apiMe()).rejects.toThrow("unexpected response");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Google login and data requests share the configured new API origin", () => {
  const previous = process.env.REACT_APP_API_BASE;
  process.env.REACT_APP_API_BASE = " https://api.tobuylists.com/ ";
  jest.resetModules();
  try {
    const { API_BASE, googleLoginUrl } = require("./api");
    expect(API_BASE).toBe("https://api.tobuylists.com");
    expect(googleLoginUrl()).toBe("https://api.tobuylists.com/auth/google/login");
  } finally {
    if (previous === undefined) delete process.env.REACT_APP_API_BASE;
    else process.env.REACT_APP_API_BASE = previous;
    jest.resetModules();
  }
});
