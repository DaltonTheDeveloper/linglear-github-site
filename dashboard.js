(() => {
  const STORAGE_KEY = "linglear_dashboard_state_v1";

  const defaultState = {
    creditsCents: 327,
    watchMinutesToday: 0,
    streakDays: 0,
    lastStreakDate: null,
    friends: [],
    friendCode: "",
    votes: [],
    shows: [
      { title: "Money Heist", lang: "Spanish", progress: 62, votes: 11 },
      { title: "Narcos", lang: "Spanish", progress: 14, votes: 7 },
      { title: "Dark", lang: "German", progress: 5, votes: 3 }
    ],
    leaderboard: [
      { name: "Dalton", points: 980 },
      { name: "Mia", points: 840 },
      { name: "Noah", points: 760 }
    ]
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      const parsed = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(defaultState)), parsed || {});
    } catch {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const state = loadState();

  // DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(title, msg, type = "good") {
    const box = document.createElement("div");
    box.className = `toast ${type}`;
    box.innerHTML = `<div class="toast-title">${escapeHtml(title)}</div><div class="toast-msg">${escapeHtml(msg)}</div>`;
    $("#toasts").appendChild(box);
    setTimeout(() => box.classList.add("show"), 10);
    setTimeout(() => {
      box.classList.remove("show");
      setTimeout(() => box.remove(), 200);
    }, 2800);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function centsToUsd(c) { return `$${(c / 100).toFixed(2)}`; }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function bumpStreakIfNeeded() {
    const today = todayISO();
    if (!state.lastStreakDate) {
      state.lastStreakDate = today;
      state.streakDays = 1;
      saveState();
      return;
    }
    if (state.lastStreakDate === today) return;
    // naive: if they log watch time on a different day, increment streak
    state.lastStreakDate = today;
    state.streakDays += 1;
    saveState();
  }

  function getUserProfile() {
    try {
      const email = localStorage.getItem("linglear_email") || "user@linglear.com";
      const name = email;
      return { name, email, sub: "Subscriber" };
    } catch {
      return { name: "User", email: "", sub: "Subscriber" };
    }
  }

  function logout() {
    localStorage.removeItem("linglear_token");
    localStorage.removeItem("linglear_email");
    toast("Logged out", "Your session has been cleared.", "good");
  }

  // REAL friend code comes from the backend (RDS) via /api/me.
  async function loadMeFromApi() {
    if (!window.LinglearAPI || typeof window.LinglearAPI.apiGet !== "function") return null;
    try {
      const me = await window.LinglearAPI.apiGet("/api/me");
      if (me && me.friend_code) {
        state.friendCode = me.friend_code;
        saveState();
      }
      return me;
    } catch {
      return null;
    }
  }

  // Populate topbar chip
  const user = getUserProfile();
  const nameTargets = [document.getElementById("userName"), document.getElementById("username")].filter(Boolean);
  nameTargets.forEach(el => (el.textContent = user.name));
  const subTargets = [document.getElementById("userSub"), document.getElementById("usersub")].filter(Boolean);
  subTargets.forEach(el => (el.textContent = user.email || user.sub || "Subscriber"));
  const avatarEl = document.getElementById("avatar");
  if (avatarEl) avatarEl.textContent = (user.name || "?").trim().slice(0, 1).toUpperCase();

  const logoutButton = document.getElementById("logoutBtn") || document.getElementById("btnLogout");
  if (logoutButton) logoutButton.addEventListener("click", () => logout());

  // ✅ Backend status (REAL)
  const BACKEND_BASE = (typeof window.LINGLEAR_API_BASE === "string" && window.LINGLEAR_API_BASE.trim() !== "")
    ? window.LINGLEAR_API_BASE
    : "";

  async function checkBackend() {
    const pill = $("#netStatus");
    try {
      if (!BACKEND_BASE) {
        pill.className = "pill pill-neutral";
        pill.querySelector(".txt").textContent = "Backend: not set";
        return;
      }
      let r = await fetch(`${BACKEND_BASE}/health`, { method: "GET" });
      if (!r.ok) r = await fetch(`${BACKEND_BASE}/api/health`, { method: "GET" });
      if (!r.ok) throw new Error("bad");
      pill.className = "pill pill-good";
      const host = BACKEND_BASE.replace(/^https?:\/\//, "").replace(/\/$/, "");
      pill.querySelector(".txt").textContent = `Backend: online (${host})`;
    } catch {
      pill.className = "pill pill-bad";
      pill.querySelector(".txt").textContent = "Backend: offline";
    }
  }

  checkBackend();

  function refreshNavBadges() {
    $("#navStreakTag").textContent = `${state.streakDays}d`;
    $("#navFriendsTag").textContent = String(state.friends.length);
    $("#navCreditsTag").textContent = centsToUsd(state.creditsCents);
    $("#navRankTag").textContent = "#—";
  }

  refreshNavBadges();

  // Routing
  const views = {
    overview: $("#view-overview"),
    friends: $("#view-friends"),
    votes: $("#view-votes"),
    community: $("#view-community")
  };

  function setActiveRoute(route) {
    $$(".navitem").forEach(a => a.classList.toggle("active", a.dataset.route === route));
    Object.entries(views).forEach(([k, el]) => el.classList.toggle("active", k === route));
    if (route === "overview") renderOverview();
    if (route === "friends") renderFriends();
    if (route === "votes") renderVotes();
    if (route === "community") renderCommunity();
  }

  function getRoute() {
    const h = window.location.hash || "#/overview";
    const m = h.match(/^#\/([a-z]+)/i);
    return (m ? m[1].toLowerCase() : "overview");
  }

  window.addEventListener("hashchange", () => setActiveRoute(getRoute()));
  if (!window.location.hash) window.location.hash = "#/overview";
  setActiveRoute(getRoute());

  // Quick actions
  $("#btnAddWatch").addEventListener("click", () => {
    state.watchMinutesToday += 15;
    bumpStreakIfNeeded();
    state.creditsCents += 5;
    saveState();
    toast("Watch time logged", "+15 minutes • +$0.05 credits", "good");
    renderOverview();
  });

  $("#btnClaimDaily").addEventListener("click", () => {
    state.creditsCents += 10;
    saveState();
    toast("Daily bonus claimed", "+$0.10 credits", "good");
    refreshNavBadges();
    renderOverview();
  });

  // Overview page
  function renderOverview() {
    const el = views.overview;
    el.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 12;">
          <div class="row">
            <div class="grow">
              <h2>Overview</h2>
              <div class="muted">This page will become real once watch history endpoints are wired.</div>
            </div>
            <span class="badge yellow">Credits: ${centsToUsd(state.creditsCents)}</span>
          </div>
        </div>

        <div class="card" style="grid-column: span 12;">
          <h2>Your shows</h2>
          <div class="muted">Backfill placeholder — real shows come from DB later.</div>
          <div class="hr"></div>
          <div class="muted">No shows yet.</div>
        </div>
      </div>
    `;
  }

  // Friends page (REAL API)
  function renderFriends() {
    const el = views.friends;

    el.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 12;">
          <div class="row">
            <div class="grow">
              <h2>Friends</h2>
              <div class="muted">Compare progress, sync similar shows, and compete on streaks.</div>
            </div>
            <span class="badge blue">Friend Codes</span>
            <span class="badge green">${state.friends.length} friends</span>
          </div>
        </div>

        <div class="card" style="grid-column: span 6;">
          <h2>Your friend code</h2>
          <div class="muted">Share this code with friends so they can join your circle.</div>
          <div class="hr"></div>
          <div class="row">
            <input class="input" id="myFriendCode" value="${escapeHtml(state.friendCode || "Loading...")}" readonly />
            <button class="btn btn-primary" id="btnCopyCode">Copy</button>
          </div>
          <div class="muted small" style="margin-top:10px">
            This code is stored in RDS and tied to your account.
          </div>
        </div>

        <div class="card" style="grid-column: span 6;">
          <h2>Add a friend</h2>
          <div class="muted">Enter their friend code to connect.</div>
          <div class="hr"></div>
          <div class="row">
            <input class="input" id="friendCodeInput" placeholder="83V4Q2  (or LING-83V4Q2)" />
            <button class="btn btn-primary" id="btnAddFriend">Add</button>
          </div>
          <div id="friendLookup" class="muted small" style="margin-top:10px"></div>
          <div class="muted small" style="margin-top:10px">
            This will create a <b>pending</b> request the receiver must accept.
          </div>
        </div>

        <div class="card" style="grid-column: span 12;">
          <h2>Your circle</h2>
          <div class="muted">Accepted friends + pending requests.</div>
          <div class="hr"></div>
          <div id="friendsTableArea" class="muted">Loading…</div>
        </div>
      </div>
    `;

    $("#btnCopyCode").addEventListener("click", async () => {
      const code = (state.friendCode || "").trim();
      if (!code) {
        toast("Not ready", "Friend code is still loading.", "bad");
        return;
      }
      try {
        await navigator.clipboard.writeText(code);
        toast("Copied", "Friend code copied to clipboard.", "good");
      } catch {
        toast("Copy failed", "Your browser blocked clipboard. Copy manually.", "bad");
      }
    });

    $("#btnAddFriend").addEventListener("click", async () => {
      const input = $("#friendCodeInput");
      const raw = (input.value || "").trim().toUpperCase();
      const norm = raw.startsWith("LING-") ? raw.slice(5) : raw;

      if (!/^[A-Z0-9]{6,16}$/.test(norm)) {
        toast(
          "Invalid code",
          "Paste a code like 83V4Q2 (or LING-83V4Q2).",
          "bad"
        );
        return;
      }

      if ((state.friendCode || "").trim().toUpperCase() === norm) {
        toast("Nice try", "You can’t add yourself.", "bad");
        return;
      }

      try {
        await window.LinglearAPI.apiPost("/api/friends/request", { code: norm });
        input.value = "";
        const lookupEl = document.getElementById("friendLookup");
        if (lookupEl) lookupEl.textContent = "";
        toast("Request sent", "Friend request is now pending.", "good");
        await refreshFriendsFromApi();
      } catch (e) {
        toast("Failed", String(e.message || e), "bad");
      }
    });

    // Live lookup so user can verify they’re adding the right person
    (function setupFriendLookup() {
      const input = document.getElementById("friendCodeInput");
      const lookupEl = document.getElementById("friendLookup");
      if (!input || !lookupEl) return;

      let t = null;
      input.addEventListener("input", () => {
        if (t) clearTimeout(t);
        const raw = (input.value || "").trim().toUpperCase();
        const norm = raw.startsWith("LING-") ? raw.slice(5) : raw;
        if (!norm) {
          lookupEl.textContent = "";
          return;
        }
        if (!/^[A-Z0-9]{6,16}$/.test(norm)) {
          lookupEl.textContent = "";
          return;
        }
        lookupEl.textContent = "Looking up user…";
        t = setTimeout(async () => {
          try {
            const u = await window.LinglearAPI.apiGet(
              "/api/friends/lookup?code=" + encodeURIComponent(norm)
            );
            const name = (u && (u.display_name || u.email)) || "User";
            const email = (u && u.email) || "";
            lookupEl.textContent = "Will request: " + name + (email && name !== email ? " (" + email + ")" : "");
          } catch (e) {
            lookupEl.textContent = "No user found for that code.";
          }
        }, 250);
      });
    })();

    async function refreshFriendsFromApi() {
      await loadMeFromApi();
      const myCodeEl = document.getElementById("myFriendCode");
      if (myCodeEl) myCodeEl.value = state.friendCode || "";

      try {
        const data = await window.LinglearAPI.apiGet("/api/friends/list");

        const friends = Array.isArray(data.friends) ? data.friends : [];
        const incoming = Array.isArray(data.incoming) ? data.incoming : [];
        const outgoing = Array.isArray(data.outgoing) ? data.outgoing : [];
        const blocked = Array.isArray(data.blocked) ? data.blocked : [];

        state.friends = friends.map(f => ({
          name: f.display_name || f.email || "Friend",
          code: f.code || "",
          sinceTs: Date.now()
        }));
        saveState();
        refreshNavBadges();

        const area = $("#friendsTableArea");
        const sections = [];

        sections.push(`
          <div style="margin-bottom:14px">
            <b>Accepted</b>
            <div class="hr" style="margin:10px 0"></div>
            ${friends.length ? `
              <table class="table">
                <thead><tr><th>Friend</th><th></th></tr></thead>
                <tbody>
                  ${friends.map((f) => `
                    <tr>
                      <td><b>${escapeHtml(f.display_name || f.email || "Friend")}</b><div class="muted small">${escapeHtml(f.email || "")}</div></td>
                      <td style="text-align:right"><button class="btn btn-ghost" data-block="${escapeHtml(String(f.friend_id || ""))}">Block</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            ` : `<div class="muted">No friends yet. Add one to unlock progress comparisons.</div>`}
          </div>
        `);

        sections.push(`
          <div style="margin-bottom:14px">
            <b>Pending (incoming)</b>
            <div class="hr" style="margin:10px 0"></div>
            ${incoming.length ? `
              <table class="table">
                <thead><tr><th>From</th><th></th></tr></thead>
                <tbody>
                  ${incoming.map((r) => `
                    <tr>
                      <td><b>${escapeHtml(r.display_name || r.email || "User")}</b></td>
                      <td style="text-align:right">
                        <button class="btn btn-primary" data-accept="${escapeHtml(String(r.request_id))}">Accept</button>
                        <button class="btn btn-ghost" data-reject="${escapeHtml(String(r.request_id))}">Reject</button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            ` : `<div class="muted">No incoming requests.</div>`}
          </div>
        `);

        sections.push(`
          <div style="margin-bottom:14px">
            <b>Pending (outgoing)</b>
            <div class="hr" style="margin:10px 0"></div>
            ${outgoing.length ? `
              <table class="table">
                <thead><tr><th>To</th><th></th></tr></thead>
                <tbody>
                  ${outgoing.map((r) => `
                    <tr>
                      <td><b>${escapeHtml(r.display_name || r.email || "User")}</b></td>
                      <td style="text-align:right"><span class="badge blue">Pending</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            ` : `<div class="muted">No outgoing requests.</div>`}
          </div>
        `);

        sections.push(`
          <div>
            <b>Blocked</b>
            <div class="hr" style="margin:10px 0"></div>
            ${blocked.length ? `
              <table class="table">
                <thead><tr><th>User</th><th></th></tr></thead>
                <tbody>
                  ${blocked.map((b) => `
                    <tr>
                      <td><b>${escapeHtml(b.display_name || b.email || "User")}</b></td>
                      <td style="text-align:right"><button class="btn btn-ghost" data-unblock="${escapeHtml(String(b.user_id || ""))}">Unblock</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            ` : `<div class="muted">No blocked users.</div>`}
          </div>
        `);

        area.classList.remove("muted");
        area.innerHTML = sections.join("");

        area.querySelectorAll("[data-accept]").forEach(btn => {
          btn.addEventListener("click", async () => {
            try {
              await window.LinglearAPI.apiPost("/api/friends/respond", { request_id: btn.getAttribute("data-accept"), action: "ACCEPT" });
              toast("Accepted", "Friend request accepted.", "good");
              await refreshFriendsFromApi();
            } catch (e) {
              toast("Failed", String(e.message || e), "bad");
            }
          });
        });

        area.querySelectorAll("[data-reject]").forEach(btn => {
          btn.addEventListener("click", async () => {
            try {
              await window.LinglearAPI.apiPost("/api/friends/respond", { request_id: btn.getAttribute("data-reject"), action: "REJECT" });
              toast("Rejected", "Friend request rejected.", "good");
              await refreshFriendsFromApi();
            } catch (e) {
              toast("Failed", String(e.message || e), "bad");
            }
          });
        });

        area.querySelectorAll("[data-block]").forEach(btn => {
          btn.addEventListener("click", async () => {
            try {
              await window.LinglearAPI.apiPost("/api/friends/block", { user_id: btn.getAttribute("data-block") });
              toast("Blocked", "User blocked.", "good");
              await refreshFriendsFromApi();
            } catch (e) {
              toast("Failed", String(e.message || e), "bad");
            }
          });
        });

        area.querySelectorAll("[data-unblock]").forEach(btn => {
          btn.addEventListener("click", async () => {
            try {
              await window.LinglearAPI.apiPost("/api/friends/unblock", { user_id: btn.getAttribute("data-unblock") });
              toast("Unblocked", "User unblocked.", "good");
              await refreshFriendsFromApi();
            } catch (e) {
              toast("Failed", String(e.message || e), "bad");
            }
          });
        });

      } catch (e) {
        const area = $("#friendsTableArea");
        area.classList.add("muted");
        area.textContent = `API error: ${String(e.message || e)}`;
      }
    }

    refreshFriendsFromApi();
  }

  function renderVotes() {
    const el = views.votes;
    el.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 12;">
          <h2>Votes</h2>
          <div class="muted">Backfill placeholder — real votes will be DB wired later.</div>
          <div class="hr"></div>
          <div class="muted">No votes yet.</div>
        </div>
      </div>
    `;
  }

  function renderCommunity() {
    const el = views.community;
    el.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 12;">
          <h2>Community</h2>
          <div class="muted">Backfill placeholder.</div>
          <div class="hr"></div>
          <div class="muted">No community data yet.</div>
        </div>
      </div>
    `;
  }
})();
