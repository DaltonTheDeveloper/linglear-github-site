// Configure your API base here.
// For local dev you can set window.LINGLEAR_API_BASE manually before this script loads.
// In production the API is typically served under the same domain as the dashboard (e.g. https://dashboard.example.com/api).
// To support that out of the box we default to an empty string, which makes fetch requests relative to the current origin.
window.LINGLEAR_API_BASE = typeof window.LINGLEAR_API_BASE === "string" && window.LINGLEAR_API_BASE.trim() !== ""
  ? window.LINGLEAR_API_BASE
  : "https://api.linglear.com";

function getToken() {
  return localStorage.getItem("linglear_token") || "";
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
