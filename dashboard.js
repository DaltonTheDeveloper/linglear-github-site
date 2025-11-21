// Shared dashboard logic for Linglear
//
// This script ensures users are authenticated before viewing any dashboard
// page, extracts their email from the stored JWT when necessary, and
// populates the sidebar with it. It also handles logout and toggling
// the sidebar on mobile.
(function () {
  const idToken = localStorage.getItem('ling_auth_id_token');
  if (!idToken) {
    // Redirect to login page if no ID token is present
    window.location.href = 'login.html';
    return;
  }
  let email = localStorage.getItem('ling_auth_email');
  // Decode the ID token if we haven't already stored the email
  function decodeJwtPayload(jwt) {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = decodeURIComponent(
        atob(payload)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(decoded);
    } catch (err) {
      return null;
    }
  }
  if (!email) {
    const payload = decodeJwtPayload(idToken);
    if (payload) {
      email = payload.email || payload['cognito:username'] || payload.username || '';
      if (email) {
        localStorage.setItem('ling_auth_email', email);
      }
    }
  }
  // Populate the email in the sidebar
  const emailElem = document.getElementById('sidebarEmail');
  if (emailElem) emailElem.textContent = email || '';

  // Logout handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('ling_auth_email');
      localStorage.removeItem('ling_auth_id_token');
      localStorage.removeItem('linglear_id_token');
      localStorage.removeItem('linglear_access_token');
      window.location.href = 'login.html';
    });
  }

  // Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }
})();
