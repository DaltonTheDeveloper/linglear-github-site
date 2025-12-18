/* Linglear Dashboard API helper (no modules; works on GitHub Pages).
 *
 * Exposes:
 *   - window.LinglearAPI.{getBackend,setBackend,apiGet,apiPost,apiPut,apiDelete}
 *   - window.apiGet / window.apiPost / ... (legacy aliases)
 *   - window.LINGLEAR_API_BASE (legacy global used by some older pages)
 *
 * Notes (AI-friendly):
 * - The backend base URL is resolved once from:
 *     1) localStorage override ("linglear_backend_base")
 *     2) sensible default derived from window.location.hostname
 * - Auth tokens are read from localStorage keys written by auth.js.
 * - All requests include: Authorization: Bearer <token> when a token exists.
 */
(function () {
  "use strict";

  function defaultBackendForHost() {
    try {
      var h = String((window.location && window.location.hostname) || "");
      if (!h) return "https://api.linglear.com";
      if (h === "localhost" || h === "127.0.0.1") return "http://localhost:3000";
      // When running on the marketing site domains, use the public API host.
      if (h === "linglear.com" || h === "www.linglear.com") return "https://api.linglear.com";
      return "https://api.linglear.com";
    } catch (e) {
      return "https://api.linglear.com";
    }
  }

  var DEFAULT_BACKEND = defaultBackendForHost();
  var STORAGE_KEY = "linglear_backend_base";

  function normalizeBase(url) {
    if (!url) return "";
    url = String(url).trim();
    if (!url) return "";
    // Allow http(s) only
    if (!/^https?:\/\//i.test(url)) return "";
    // strip trailing slash
    return url.replace(/\/+$/, "");
  }

  function setBackend(url) {
    var normalized = normalizeBase(url);
    try {
      if (!normalized) {
        localStorage.removeItem(STORAGE_KEY);
        return DEFAULT_BACKEND;
      }
      localStorage.setItem(STORAGE_KEY, normalized);
      return normalized;
    } catch (e) {
      return normalized || DEFAULT_BACKEND;
    }
  }

  function getBackend() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      var n = normalizeBase(saved);
      return n || DEFAULT_BACKEND;
    } catch (e) {
      return DEFAULT_BACKEND;
    }
  }

  // Pull an auth token from the same keys written by /auth.js.
  // We prefer access_token (short-lived, for APIs) but allow id_token too.
  function getToken() {
    try {
      // Newer keys used by linglear.com
      var access = localStorage.getItem("linglear_access_token");
      var idt = localStorage.getItem("linglear_id_token");
      var legacyId = localStorage.getItem("ling_auth_id_token");
      // Older prototype keys (still supported)
      var old = localStorage.getItem("linglear_token") || sessionStorage.getItem("linglear_token");
      return access || idt || legacyId || old || "";
    } catch (e) {
      return "";
    }
  }

  function buildUrl(path) {
    var base = getBackend();
    if (!path) return base;
    if (path[0] !== "/") path = "/" + path;
    return base + path;
  }

  async function apiFetch(method, path, body) {
    var url = buildUrl(path);

    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    var res = await fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      // IMPORTANT: keep credentials off for now (we're using bearer tokens).
      credentials: "omit",
    });

    var text = await res.text();
    var data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = { raw: text };
    }

    if (!res.ok) {
      var msg = (data && (data.error || data.message)) || (text || "Request failed");
      var err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  function apiGet(path) { return apiFetch("GET", path); }
  function apiPost(path, body) { return apiFetch("POST", path, body); }
  function apiPut(path, body) { return apiFetch("PUT", path, body); }
  function apiDelete(path, body) { return apiFetch("DELETE", path, body); }

  // Legacy global used by some older pages (dashboard.js used to read this).
  // Keep it always in-sync with the real backend resolver.
  try {
    window.LINGLEAR_API_BASE = getBackend();
  } catch (e) {}

  window.apiGet = apiGet;
  window.apiPost = apiPost;
  window.apiPut = apiPut;
  window.apiDelete = apiDelete;

  window.LinglearAPI = {
    DEFAULT_BACKEND: DEFAULT_BACKEND,
    getBackend: getBackend,
    setBackend: setBackend,
    apiGet: apiGet,
    apiPost: apiPost,
    apiPut: apiPut,
    apiDelete: apiDelete,
  };
})();