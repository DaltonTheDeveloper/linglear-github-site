// Linglear Authentication Helper
//
// This script encapsulates the AWS Cognito hosted‑UI flows used on
// linglear.com. It provides functions to build login and logout URLs,
// parse tokens returned in the URL hash, decode JWT payloads, and
// update navigation elements when users sign in or out. The same
// script can be loaded on any page of the site to automatically
// synchronize login status via localStorage and update the display of
// the login and logout buttons accordingly.

(function () {
  // ----- BASIC CONFIGURATION (matches the original login demo) -----
  const region = "us-east-1";
  const userPoolId = "us-east-1_g7hqEe8iO";
  const clientId = "6lsk8r1jbfs2g0619pb6a01t9q";
  const cognitoDomain = "https://linglear-auth-1.auth.us-east-1.amazoncognito.com";

  // Must exactly match one of the callback URLs configured on the user pool client.
  // On production linglear.com this is set to https://linglear.com/; for local
  // development it can safely be the current origin. To avoid breakage when
  // deployed, we keep the production URI here.
  const redirectUri = "https://linglear.com/";

  // Used for silent refresh (prompt=none) inside an iframe.
  // You MUST add this URL to Cognito App client "Allowed callback URLs":
  //   https://linglear.com/silent-refresh.html
  const silentRedirectUri = "https://linglear.com/silent-refresh.html";

  const scope = encodeURIComponent("openid email");

  function buildLoginUrl() {
    return (
      cognitoDomain +
      "/oauth2/authorize" +
      "?client_id=" + encodeURIComponent(clientId) +
      "&response_type=token" +
      "&scope=" + scope +
      "&redirect_uri=" + encodeURIComponent(redirectUri)
    );
  }

  function buildSilentLoginUrl(state) {
    // prompt=none tells Cognito to only succeed if the user already has a session
    // cookie for the hosted UI (otherwise it returns an error).
    return (
      cognitoDomain +
      "/oauth2/authorize" +
      "?client_id=" + encodeURIComponent(clientId) +
      "&response_type=token" +
      "&scope=" + scope +
      "&prompt=none" +
      (state ? "&state=" + encodeURIComponent(state) : "") +
      "&redirect_uri=" + encodeURIComponent(silentRedirectUri)
    );
  }

  function base64UrlDecode(str) {
    // Convert base64url -> base64
    const s = (str || "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    return atob(s + pad);
  }

  function decodeJwtPayload(token) {
    try {
      const parts = (token || "").split(".");
      if (parts.length !== 3) return null;
      return JSON.parse(base64UrlDecode(parts[1]));
    } catch {
      return null;
    }
  }

  function tokenSecondsLeft(token) {
    const p = decodeJwtPayload(token);
    const exp = p && typeof p.exp === "number" ? p.exp : 0;
    const now = Math.floor(Date.now() / 1000);
    return exp - now;
  }

  function isProbablyExpired(token, skewSeconds = 60) {
    return tokenSecondsLeft(token) <= skewSeconds;
  }

  function buildLogoutUrl() {
    return (
      cognitoDomain +
      "/logout" +
      "?client_id=" + encodeURIComponent(clientId) +
      "&logout_uri=" + encodeURIComponent(redirectUri)
    );
  }

  // ----- TOKEN HELPERS -----

  function parseHashTokens() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return null;

    const params = new URLSearchParams(hash.substring(1));

    if (params.has("error")) {
      console.error(
        "[LINGLEAR AUTH] Cognito returned error:",
        params.get("error"),
        params.get("error_description")
      );
      return null;
    }

    const accessToken = params.get("access_token");
    const idToken = params.get("id_token");

    if (!accessToken && !idToken) return null;

    // Clean the URL so the hash with tokens disappears from the address bar
    try {
      window.history.replaceState(
        null,
        document.title,
        window.location.pathname + window.location.search
      );
    } catch (err) {
      console.warn("[LINGLEAR AUTH] Failed to clean URL hash:", err);
    }

    return { accessToken, idToken };
  }

  function decodeJwtPayload(jwt) {
    if (!jwt) return null;
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;

    try {
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = decodeURIComponent(
        atob(payload)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(decoded);
    } catch (err) {
      console.error("[LINGLEAR AUTH] Failed to decode JWT payload:", err);
      return null;
    }
  }

  // ----- UI HELPERS -----

  function setLoggedOutUI() {
    const userNameSpan = document.getElementById("userName");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (userNameSpan) userNameSpan.textContent = "";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";

    // Clear stored tokens
    localStorage.removeItem("linglear_id_token");
    localStorage.removeItem("linglear_access_token");
    localStorage.removeItem("ling_auth_email");
    localStorage.removeItem("ling_auth_id_token");
  }

  function setLoggedInUI(tokens) {
    let emailText = "";

    if (tokens && tokens.idToken) {
      const payload = decodeJwtPayload(tokens.idToken);
      if (payload) {
        emailText =
          payload.email ||
          payload["cognito:username"] ||
          payload.username ||
          "";
      }
    }

    const userNameSpan = document.getElementById("userName");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (userNameSpan) userNameSpan.textContent = emailText;
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";

    if (tokens && tokens.idToken) {
      localStorage.setItem("linglear_id_token", tokens.idToken);
      localStorage.setItem("ling_auth_id_token", tokens.idToken);
    }
    if (tokens && tokens.accessToken) {
      localStorage.setItem("linglear_access_token", tokens.accessToken);
    }
    if (emailText) {
      localStorage.setItem("ling_auth_email", emailText);
    }
  }

  // ----- MAIN INIT -----

  let refreshTimer = null;
  let silentRefreshPromise = null;

  function getStoredTokens() {
    return {
      idToken: localStorage.getItem("linglear_id_token") || "",
      accessToken: localStorage.getItem("linglear_access_token") || "",
    };
  }

  function getJwtExpSeconds(jwt) {
    const p = decodeJwtPayload(jwt);
    if (!p || typeof p.exp !== "number") return 0;
    return p.exp;
  }

  function secondsLeft(jwt) {
    const exp = getJwtExpSeconds(jwt);
    if (!exp) return -1;
    const now = Math.floor(Date.now() / 1000);
    return exp - now;
  }

  function isExpiredOrNear(jwt, skewSeconds) {
    const left = secondsLeft(jwt);
    if (left < 0) return true;
    return left <= (skewSeconds || 60);
  }

  function scheduleSilentRefresh(accessToken) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    const left = secondsLeft(accessToken);
    if (left <= 0) return;

    // Refresh 60s before expiry (minimum delay 5s)
    const ms = Math.max(5000, (left - 60) * 1000);
    refreshTimer = setTimeout(() => {
      ensureFreshTokens().catch(() => {
        // if refresh fails, UI will be handled by ensureFreshTokens
      });
    }, ms);
  }

  function silentRefresh() {
    if (silentRefreshPromise) return silentRefreshPromise;

    silentRefreshPromise = new Promise((resolve, reject) => {
      const timeoutMs = 10000;
      let timeoutId = null;
      let iframe = null;

      function cleanup() {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = null;
        window.removeEventListener("message", onMessage);
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        iframe = null;
        silentRefreshPromise = null;
      }

      function onMessage(evt) {
        // Only accept messages from our own origin (silent-refresh.html runs on linglear.com)
        if (evt.origin !== window.location.origin) return;
        const data = evt.data || {};
        if (data.type !== "LINGLEAR_SILENT_TOKENS") return;

        cleanup();
        if (data.ok && data.accessToken) {
          resolve({ accessToken: data.accessToken, idToken: data.idToken || "" });
        } else {
          reject(new Error(data.error || "Silent refresh failed"));
        }
      }

      window.addEventListener("message", onMessage);

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Silent refresh timeout"));
      }, timeoutMs);

      // Create a hidden iframe that will do prompt=none auth and postMessage tokens back
      iframe = document.createElement("iframe");
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.src = silentRedirectUri;
      document.body.appendChild(iframe);
    });

    return silentRefreshPromise;
  }

  async function ensureFreshTokens() {
    const tokens = getStoredTokens();

    // If access token is healthy, we're done.
    if (tokens.accessToken && !isExpiredOrNear(tokens.accessToken, 60)) {
      scheduleSilentRefresh(tokens.accessToken);
      return tokens;
    }

    // Try to silently refresh using Cognito session cookies.
    try {
      const fresh = await silentRefresh();
      if (fresh && fresh.accessToken) {
        setLoggedInUI(fresh);
        scheduleSilentRefresh(fresh.accessToken);
        return getStoredTokens();
      }
      throw new Error("Silent refresh returned empty token");
    } catch (err) {
      // If it fails, we clear local tokens so you don't keep reusing expired ones.
      console.warn("[LINGLEAR AUTH] Silent refresh failed:", err);
      setLoggedOutUI();
      throw err;
    }
  }

  function initAuth() {
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (loginBtn) {
      loginBtn.addEventListener("click", function () {
        window.location.href = buildLoginUrl();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        // Clear UI + tokens locally first
        setLoggedOutUI();
        // Then redirect to Cognito sign‑out
        window.location.href = buildLogoutUrl();
      });
    }

    // First: see if Cognito just redirected us back with tokens in the hash
    const tokensFromHash = parseHashTokens();
    if (tokensFromHash && (tokensFromHash.idToken || tokensFromHash.accessToken)) {
      setLoggedInUI(tokensFromHash);
      return;
    }

    // If not, fall back to stored tokens in localStorage
    const stored = getStoredTokens();
    if (stored.idToken || stored.accessToken) {
      setLoggedInUI(stored);
      // If the stored access token is expired, this will replace it silently (if a Cognito session exists).
      ensureFreshTokens().catch(() => {
        // UI handled inside ensureFreshTokens
      });
    } else {
      setLoggedOutUI();
    }
  }

  // Expose a small API for other scripts (api.js) to call.
  window.LinglearAuth = {
    ensureFreshTokens,
    getStoredTokens,
  };

  window.addEventListener("DOMContentLoaded", initAuth);
})();
