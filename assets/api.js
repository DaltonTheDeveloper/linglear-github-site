/* Linglear Dashboard API helper (no modules; works on GitHub Pages).
   Exposes: window.apiGet, window.apiPost, window.setBackend, window.getBackend, window.LinglearAPI
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

  function getToken() {
    // Prefer Cognito ID token (good for user identity: email/sub). Fall back to access token.
    // Support legacy keys used across older dashboard builds.
    try {
      return (
        localStorage.getItem("linglear_id_token") ||
        localStorage.getItem("ling_auth_id_token") ||
        localStorage.getItem("linglear_access_token") ||
        localStorage.getItem("linglear_token") ||
        sessionStorage.getItem("linglear_id_token") ||
        sessionStorage.getItem("ling_auth_id_token") ||
        sessionStorage.getItem("linglear_access_token") ||
        sessionStorage.getItem("linglear_token") ||
        ""
      );
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
