(function () {
  // Keep these in sync with auth.js
  const cognitoDomain = "https://linglear-auth-1.auth.us-east-1.amazoncognito.com";
  const clientId = "6lsk8r1jbfs2g0619pb6a01t9q";
  const redirectUri = "https://linglear.com/silent-refresh.html";
  const scopes = ["openid", "email"];

  function parseHash() {
    const hash = window.location.hash || "";
    if (!hash || hash.length < 2) return null;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token") || "";
    const idToken = params.get("id_token") || "";
    const error = params.get("error") || "";
    const errorDescription = params.get("error_description") || "";

    return { accessToken, idToken, error, errorDescription };
  }

  function buildSilentAuthorizeUrl(state) {
    return (
      cognitoDomain +
      "/oauth2/authorize" +
      "?client_id=" + encodeURIComponent(clientId) +
      "&response_type=token" +
      "&scope=" + encodeURIComponent(scopes.join(" ")) +
      "&redirect_uri=" + encodeURIComponent(redirectUri) +
      "&prompt=none" +
      "&state=" + encodeURIComponent(state)
    );
  }

  // If we already have tokens in the hash, send them to the parent.
  const parsed = parseHash();
  if (parsed && (parsed.accessToken || parsed.idToken || parsed.error)) {
    try {
      window.parent.postMessage(
        {
          type: "LINGLEAR_SILENT_TOKENS",
          accessToken: parsed.accessToken,
          idToken: parsed.idToken,
          error: parsed.error,
          errorDescription: parsed.errorDescription,
        },
        "*"
      );
    } finally {
      // Clean the URL so the token doesn’t stick around
      history.replaceState({}, document.title, window.location.pathname);
    }
    return;
  }

  // Otherwise, start the silent auth attempt.
  const state = "sr_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  window.location.replace(buildSilentAuthorizeUrl(state));
})();
