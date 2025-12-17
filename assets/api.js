// assets/api.js
// Centralized fetch helper that automatically finds a Cognito/OIDC token.

// If you're running locally, keep localhost.
// In production, set window.LINGLEAR_API_BASE before this loads, or edit below.
const API_BASE =
  (window && window.LINGLEAR_API_BASE) ||
  (location.hostname === "localhost" ? "http://localhost:3000" : "https://api.linglear.com");

function tryParseJson(s) {
  try { return JSON.parse(s); } catch (_) { return null; }
}

function findTokenInStorage(storage) {
  if (!storage) return null;

  // 1) Our explicit key
  const direct = storage.getItem("linglear_token");
  if (direct && direct !== "null" && direct !== "undefined") return direct;

  // 2) Amplify / Cognito Hosted UI localStorage keys:
  // CognitoIdentityServiceProvider.<clientId>.<username>.idToken
  for (const k of Object.keys(storage)) {
    if (k.includes("CognitoIdentityServiceProvider") && k.endsWith(".idToken")) {
      const v = storage.getItem(k);
      if (v) return v;
    }
  }

  // 3) OIDC-client-ts style (stored as JSON):
  // oidc.user:<authority>:<clientId>
  for (const k of Object.keys(storage)) {
    if (k.startsWith("oidc.user:")) {
      const obj = tryParseJson(storage.getItem(k));
      if (obj && (obj.id_token || obj.access_token)) return obj.id_token || obj.access_token;
    }
  }

  // 4) Generic fallbacks: any key that looks like a JWT in an id/access token slot
  for (const k of Object.keys(storage)) {
    const lk = k.toLowerCase();
    if (lk.includes("idtoken") || lk.includes("id_token") || lk.includes("accesstoken") || lk.includes("access_token")) {
      const v = storage.getItem(k);
      if (v && v.split(".").length === 3) return v;
    }
  }

  return null;
}

function getAuthToken() {
  // Try localStorage then sessionStorage
  const t1 = findTokenInStorage(window.localStorage);
  if (t1) {
    // Cache to our canonical key so future reads are cheap
    if (window.localStorage.getItem("linglear_token") !== t1) {
      window.localStorage.setItem("linglear_token", t1);
    }
    return t1;
  }

  const t2 = findTokenInStorage(window.sessionStorage);
  if (t2) {
    window.localStorage.setItem("linglear_token", t2);
    return t2;
  }

  return null;
}

export async function apiFetch(path, opts = {}) {
  const url = API_BASE + path;

  const headers = new Headers(opts.headers || {});
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // If you're calling JSON endpoints
  if (!headers.has("Content-Type") && opts.body && typeof opts.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...opts,
    headers,
    credentials: "include",
  });

  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch (_) {}
  } else {
    try { data = await res.text(); } catch (_) {}
  }

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export async function apiGet(path) {
  return apiFetch(path, { method: "GET" });
}

export async function apiPost(path, bodyObj) {
  return apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj || {}),
  });
}
