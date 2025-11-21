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
    const storedIdToken = localStorage.getItem("linglear_id_token");
    if (storedIdToken) {
      setLoggedInUI({ idToken: storedIdToken });
    } else {
      setLoggedOutUI();
    }
  }

  window.addEventListener("DOMContentLoaded", initAuth);
})();
