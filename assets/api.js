// Linglear API helper
// Production default MUST be the public API so everyone can use it.
// You can override by setting window.LINGLEAR_API_BASE before this loads.
window.LINGLEAR_API_BASE =
  typeof window.LINGLEAR_API_BASE === "string" && window.LINGLEAR_API_BASE.trim() !== ""
    ? window.LINGLEAR_API_BASE
    : "https://api.linglear.com";

// ✅ Cognito Hosted UI gives us id_token + access_token.
// Your auth.js stores them as linglear_id_token and linglear_access_token.
// Prefer id_token (contains email/sub reliably for user mapping).
function getToken() {
  return (
    localStorage.getItem("linglear_id_token") ||
    localStorage.getItem("linglear_access_token") ||
    localStorage.getItem("linglear_token") ||
    ""
  );
}

async function api(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${window.LINGLEAR_API_BASE}${path}`, {
    ...opts,
    headers
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function apiGet(path) {
  return api(path, { method: "GET" });
}
async function apiPost(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body || {}) });
}

window.LinglearAPI = { apiGet, apiPost };
