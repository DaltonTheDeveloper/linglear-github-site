// assets/api.js

// Configure your API base here.
// In production we MUST hit the public API domain so everyone can use it.
window.LINGLEAR_API_BASE =
  typeof window.LINGLEAR_API_BASE === "string" && window.LINGLEAR_API_BASE.trim() !== ""
    ? window.LINGLEAR_API_BASE.trim()
    : "https://api.linglear.com";

function getToken() {
  // Cognito login stores the ID token here (see auth.js)
  return localStorage.getItem("linglear_id_token") || "";
}

async function api(path, opts = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${window.LINGLEAR_API_BASE}${path}`, {
    ...opts,
    headers
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function apiGet(path) { return api(path, { method: "GET" }); }
async function apiPost(path, body) { return api(path, { method: "POST", body: JSON.stringify(body || {}) }); }

window.LinglearAPI = { apiGet, apiPost };
