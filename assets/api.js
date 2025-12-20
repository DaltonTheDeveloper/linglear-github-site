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

  // ---- Auth token helpers (AI-friendly) ------------------------------------
  // We store Cognito tokens in localStorage. These tokens expire.
  // If expired, we clear them and force the user back to /login.html so they
  // can re-authenticate cleanly.
  function _b64UrlDecode(str) {
    try {
      str = str.replace(/-/g, "+").replace(/_/g, "/");
      // pad
      while (str.length % 4) str += "=";
      return atob(str);
    } catch (e) {
      return null;
    }
  }

  function _parseJwt(token) {
    try {
      if (!token || token.split(".").length < 2) return null;
      var payload = token.split(".")[1];
      var json = _b64UrlDecode(payload);
      if (!json) return null;
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function _isExpiredJwt(token, skewSeconds) {
    var p = _parseJwt(token);
    if (!p || !p.exp) return false; // if unknown, let backend decide
    var skew = (typeof skewSeconds === "number" ? skewSeconds : 30);
    var now = Math.floor(Date.now() / 1000);
    return (now + skew) >= p.exp;
  }

  function _clearAuthStorage() {
    try {
      var keys = [
        "linglear_access_token",
        "linglear_id_token",
        "linglear_refresh_token",
        "linglear_tokens",
        "ling_auth_id_token",
        "ling_auth_access_token",
        "ling_auth_refresh_token",
        "ling_auth_email",
        "linglear_email"
      ];
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  function _forceRelogin(message) {
    try {
      if (message) window.toast && window.toast(message);
    } catch (e) {}
    _clearAuthStorage();
    // Preserve where they were so login can bounce them back if you want.
    try { sessionStorage.setItem("post_login_redirect", window.location.href); } catch (e) {}
    window.location.href = "/login.html";
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

      if (t) {
        // If token is expired, force a clean re-login.
        if (_isExpiredJwt(t, 30)) {
          _forceRelogin('Session expired. Please log in again.');
          return '';
        }
        return t;
      }

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
      // If Cognito token is expired/invalid, force re-login (no silent failures).
      if (res.status === 401) {
        var rawMsg = (data && (data.error || data.message)) || "";
        var rawText = (typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg));
        if (/token expired|jwt expired|expired/i.test(rawText)) {
          _forceRelogin('Session expired. Please log in again.');
        }
      }
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
    // Expose token getter so non-module scripts (dashboard.js) can
    // authenticate SSE (EventSource cannot set Authorization headers).
    getToken: getToken,
    apiGet: apiGet,
    apiPost: apiPost,
    apiPut: apiPut,
    apiDelete: apiDelete,
  };
})();