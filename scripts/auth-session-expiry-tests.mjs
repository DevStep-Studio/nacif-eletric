import assert from "node:assert/strict";
import React from "react";
import { createServer } from "vite";

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const entries = new Map();
const events = new EventTarget();
let redirects = 0;
let expiryEvents = 0;
events.addEventListener("voltai:session-expired", () => expiryEvents++);
globalThis.window = {
  location: { origin: "http://localhost:5173", pathname: "/login", set href(_url) { redirects++; } },
  localStorage: { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) },
  sessionStorage: { clear() {} },
  addEventListener: (...args) => events.addEventListener(...args),
  removeEventListener: (...args) => events.removeEventListener(...args),
  dispatchEvent: event => events.dispatchEvent(event),
};

// Exercise the real provider without a DOM dependency. The dispatcher supplies
// React's state/ref/effect lifecycle; assertions cover externally visible state.
function mountProvider(Component) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let output;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const dispatcher = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], update => { slots[index] = typeof update === "function" ? update(slots[index]) : update; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) {
        effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const render = () => {
    cursor = 0;
    const holder = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
    const previous = holder.current;
    holder.current = dispatcher;
    try { output = Component({ children: null }); } finally { holder.current = previous; }
    const pending = effects; effects = [];
    pending.forEach(effect => effect());
    return output.props.value;
  };
  return { render, unmount: () => slots.forEach(slot => slot?.cleanup?.()) };
}

let provider;
try {
  const { backend, request } = await server.ssrLoadModule("/src/api/backendClient.js");
  const { AuthProvider } = await server.ssrLoadModule("/src/lib/AuthContext.jsx");
  let meCalls = 0;
  let mode = "expired";
  globalThis.fetch = async url => {
    if (String(url).endsWith("/api/subscriptions/plans")) return Response.json({ plans: [] });
    meCalls++;
    return mode === "expired" ? Response.json({ message: "Token expirado" }, { status: 401 })
      : Response.json({ id: "owner", role: "user" });
  };
  backend.auth.setToken("expired-token");
  provider = mountProvider(AuthProvider);
  provider.render();
  await new Promise(resolve => setImmediate(resolve));
  let state = provider.render();
  assert.equal(backend.auth.getToken(), null);
  assert.equal(state.user, null);
  assert.equal(state.isAuthenticated, false);
  assert.equal(state.isLoadingAuth, false);
  assert.equal(state.authChecked, true);
  assert.equal(state.authError, null, "login must not inherit an authentication redirect error");
  await state.checkUserAuth();
  state = provider.render();
  assert.equal(meCalls, 1, "expired token must not be validated again on the login page");
  assert.equal(redirects, 0, "session expiry must not reload the login page");

  mode = "valid";
  backend.auth.setToken("new-session");
  await state.checkUserAuth();
  state = provider.render();
  assert.equal(state.isAuthenticated, true, "signing in after expiry must work");
  assert.equal(state.user.id, "owner");

  globalThis.fetch = async () => Response.json({ message: "Sem permissão para este módulo" }, { status: 403 });
  await assert.rejects(() => request("/api/projects"), { status: 403 });
  assert.equal(backend.auth.getToken(), "new-session", "module restrictions do not expire authentication");

  let finishOldRequest;
  globalThis.fetch = () => new Promise(resolve => { finishOldRequest = resolve; });
  const oldRequest = request("/api/projects");
  backend.auth.setToken("replacement-session");
  finishOldRequest(Response.json({ message: "Expired" }, { status: 401 }));
  await assert.rejects(() => oldRequest, { status: 401 });
  assert.equal(backend.auth.getToken(), "replacement-session", "late failures cannot invalidate a new login");

  globalThis.fetch = async () => Response.json({ message: "Senha inválida" }, { status: 401 });
  await assert.rejects(() => request("/api/auth/login", { method: "POST", body: {} }), { status: 401 });
  assert.equal(backend.auth.getToken(), "replacement-session");

  const eventsBefore = expiryEvents;
  const failures = await Promise.allSettled([request("/api/projects"), request("/api/projects")]);
  assert.equal(failures.every(result => result.status === "rejected" && result.reason.status === 401), true);
  assert.equal(expiryEvents, eventsBefore + 1, "simultaneous 401 responses expire a session only once");
  state = provider.render();
  assert.equal(state.user, null, "401 during normal use must also clear the provider");
  assert.equal(state.isAuthenticated, false);
  assert.equal(state.isLoadingAuth, false);
  assert.equal(redirects, 0);

  // A validation already in flight must not restore the logged-out account.
  backend.auth.setToken("pending-session");
  let finishMe;
  globalThis.fetch = () => new Promise(resolve => { finishMe = resolve; });
  const pending = state.checkUserAuth();
  state.logout(false);
  finishMe(Response.json({ id: "owner" }));
  await pending;
  assert.equal(provider.render().user, null);
  assert.equal(provider.render().isAuthenticated, false);
  provider.unmount();
  globalThis.fetch = () => new Promise(() => {});
  provider = mountProvider(AuthProvider);
  provider.render();
  await new Promise(resolve => setImmediate(resolve));
  state = provider.render();
  assert.equal(state.isLoadingPublicSettings, false);
  assert.equal(state.isLoadingAuth, false, "a hanging catalog cannot block the login screen");
  console.log("PASS: expired sessions settle on login, clear credentials, preserve new sessions and never reload in a loop.");
} finally {
  provider?.unmount();
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  await server.close();
}
