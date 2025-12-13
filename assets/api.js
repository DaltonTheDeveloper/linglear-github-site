// Configure your API base here.
// For local dev:  http://localhost:3000
// For prod:       https://api.linglear.com  (or your EC2/ALB domain)
window.LINGLEAR_API_BASE = window.LINGLEAR_API_BASE || "http://localhost:3000";

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
