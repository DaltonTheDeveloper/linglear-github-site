/*
  Linglear Dashboard API helper (classic script; GitHub Pages-friendly).

  WHY THIS FILE IS A CLASSIC SCRIPT:
  - dashboard.js expects these globals to exist at execution time.
  - <script type="module"> is deferred and can run AFTER dashboard.js, causing
    errors like: "Cannot read properties of undefined (reading 'apiGet')".

  Exposes globals:
    - window.apiGet / apiPost / apiPut / apiDelete
    - window.getBackend / setBackend
    - window.LinglearAPI (namespace)
    - window.LINGLEAR_API_BASE (compat)
*/
(function () {
  "use strict";

  var DEFAULT_BACKEND = "https://api.linglear.com";
  var STORAGE_KEY = "linglear_backend_base";

  function normalizeBase(url) {
    if (!url) return "";
    url = String(url).trim();
    if (!url) return "";
    // Allow http(s) only
    if (!/^https?:\/\//i.test(url)) return "";
    // strip trailing slash
    url = url.replace(/\/+$/g, "");
    return url;
  }

  function getBackend() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      var normalized = normalizeBase(saved);
      return normalized || DEFAULT_BACKEND;
    } catch (e) {
      return DEFAULT_BACKEND;
    }
  }

  function setBackend(baseUrl) {
    var normalized = normalizeBase(baseUrl);
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

  // Token discovery is intentionally flexible because different parts of
  // Linglear have historically stored tokens under different keys.
  // We prefer ACCESS token (best for API auth) and fall back to ID token.
  function getToken() {
    try {
      // Common keys (newer)
      var t =
        localStorage.getItem("linglear_access_token") ||
        localStorage.getItem("linglear_id_token") ||
        localStorage.getItem("ling_auth_id_token") ||
        localStorage.getItem("linglear_token") ||
        sessionStorage.getItem("linglear_access_token") ||
        sessionStorage.getItem("linglear_id_token") ||
        sessionStorage.getItem("ling_auth_id_token") ||
        sessionStorage.getItem("linglear_token") ||
        "";

      if (t) return t;

      // JSON bundle key (some flows store all tokens in one JSON value)
      var packed = localStorage.getItem("linglear_tokens") || "";
      if (packed) {
        try {
          var obj = JSON.parse(packed);
          return obj.access_token || obj.id_token || "";
        } catch (_) {}
      }

      return "";
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
    var token = getToken();
    var headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;

    var res = await fetch(buildUrl(path), {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
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
      var msg =
        (data && (data.error || data.message)) ||
        ("HTTP " + res.status + " " + res.statusText);
      var err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function apiGet(path) {
    return apiFetch("GET", path);
  }

  function apiPost(path, body) {
    return apiFetch("POST", path, body);
  }

  function apiPut(path, body) {
    return apiFetch("PUT", path, body);
  }

  function apiDelete(path) {
    return apiFetch("DELETE", path);
  }

  // Expose globals expected by existing dashboard code
  window.getBackend = getBackend;
  window.setBackend = setBackend;

  // Legacy/compat: some older dashboard code reads this global.
  // Keep it updated so "Backend: not set" never appears.
  try {
    window.LINGLEAR_API_BASE = getBackend();
  } catch (_) {
    window.LINGLEAR_API_BASE = DEFAULT_BACKEND;
  }

  // Compatibility: some parts of the dashboard look for this string.
  // Keep it always in sync with getBackend().
  window.LINGLEAR_API_BASE = getBackend();

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
