
(function () {
  /* ------------------------------------------------------------------
   * Authentication helpers
   *
   * The original linglear site uses a standalone `auth.js` script which
   * writes Cognito tokens into localStorage. That script does not expose
   * a global `Auth` object, so the dashboard cannot depend on
   * `Auth.requireAuthOrRedirect()` or `Auth.getUserProfile()`.  Instead
   * we implement a few simple helpers here which mirror the behaviour of
   * the original site:
   *
   * - A user is considered logged in if `linglear_id_token` exists in
   *   localStorage.
   * - The email address saved by `auth.js` is stored as
   *   `ling_auth_email` in localStorage.
   * - Logging out simply clears the auth-related localStorage keys and
   *   redirects to the login page. If you wish to perform a full
   *   Cognito sign‑out, the click handler in `auth.js` bound to
   *   `logoutBtn` will handle that when present.
   */
  function isLoggedIn() {
    return !!localStorage.getItem('linglear_id_token');
  }

  function requireAuthOrRedirect() {
    if (!isLoggedIn()) {
      // If not authenticated, bounce to the login page. The
      // traditional auth.js script will then show a login button.
      window.location.replace('login.html');
      return false;
    }
    return true;
  }

  function getUserProfile() {
    const email = localStorage.getItem('ling_auth_email') || '';
    // Fallback name if email is not available
    const name = email || 'Subscriber';
    return { name: name, email: email, sub: '' };
  }

  function logout() {
    // Clear any known auth keys; the hosted UI logout can still run via
    // auth.js's click handler on `logoutBtn`, but this ensures a clean
    // local state.
    localStorage.removeItem('linglear_id_token');
    localStorage.removeItem('linglear_access_token');
    localStorage.removeItem('ling_auth_email');
    localStorage.removeItem('ling_auth_id_token');
    window.location.replace('login.html');
  }

  // Gate: require authentication or redirect to login
  if (!requireAuthOrRedirect()) return;

  // Simple local "DB" state stored in localStorage
  const LS_STATE = "linglear_dash_state_v1";

  function loadState() {
    const raw = localStorage.getItem(LS_STATE);
    if (!raw) return defaultState();
    try {
      const st = JSON.parse(raw);
      return { ...defaultState(), ...st };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(LS_STATE, JSON.stringify(state));
    refreshNavBadges();
  }

  function defaultState() {
    return {
      streakDays: 0,
      lastStreakDate: null,
      watchMinutesToday: 0,
      creditsCents: 200,
      votes: [],
      friendCode: null,
      friends: [],
      leaderboard: [
        { name: "Aulus", points: 1840, streak: 19 },
        { name: "Nyx", points: 1620, streak: 14 },
        { name: "Dalton", points: 1510, streak: 11 },
        { name: "Kai", points: 1260, streak: 8 }
      ],
      shows: [
        { title: "Money Heist", progress: 0.22, lang: "Spanish", votes: 12 },
        { title: "Narcos", progress: 0.11, lang: "Spanish", votes: 6 },
        { title: "Dark", progress: 0.05, lang: "German", votes: 3 }
      ]
    };
  }

  const state = loadState();

  // DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(title, body, type = "good") {
    const wrap = $("#toasts");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<div class="t-title">${escapeHtml(title)}</div><div class="t-body">${escapeHtml(body)}</div>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
    }, 2800);
    setTimeout(() => el.remove(), 3200);
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

  function ensureFriendCode() {
    if (state.friendCode) return state.friendCode;
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "LING-";
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    state.friendCode = code;
    saveState();
    return code;
  }

  // Populate the user chip with information from localStorage.  We use
  // getUserProfile() instead of Auth.getUserProfile() because the
  // original auth.js does not expose a global API.  This code will
  // update the avatar and username on the top bar.
  const user = getUserProfile();
  // Update both `userName` (for auth.js) and `username` (for backwards compatibility)
  const nameTargets = [document.getElementById("userName"), document.getElementById("username")].filter(Boolean);
  nameTargets.forEach(el => (el.textContent = user.name));
  const subTargets = [document.getElementById("userSub"), document.getElementById("usersub")].filter(Boolean);
  subTargets.forEach(el => (el.textContent = user.email || user.sub || "Subscriber"));
  const avatarEl = document.getElementById("avatar");
  if (avatarEl) avatarEl.textContent = (user.name || "?").trim().slice(0, 1).toUpperCase();
  // Bind logout to clear dashboard state and tokens.  Note: auth.js will
  // also handle logout events on the same button.
  const logoutButton = document.getElementById("logoutBtn") || document.getElementById("btnLogout");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => logout());
  }

  // Backend status (placeholder until Node API exists)
  const BACKEND_BASE = "";
  async function checkBackend() {
    const pill = $("#netStatus");
    try {
      if (!BACKEND_BASE) {
        pill.className = "pill pill-neutral";
        pill.querySelector(".txt").textContent = "Backend: not set";
        return;
      }
      const r = await fetch(`${BACKEND_BASE}/health`, { method: "GET" });
      if (!r.ok) throw new Error("bad");
      pill.className = "pill pill-good";
      pill.querySelector(".txt").textContent = "Backend: online";
    } catch {
      pill.className = "pill pill-bad";
      pill.querySelector(".txt").textContent = "Backend: offline";
    }
  }
  checkBackend();

  // Nav badges
  function refreshNavBadges() {
    $("#navStreakTag").textContent = `${state.streakDays}d`;
    $("#navFriendsTag").textContent = String(state.friends.length);
    $("#navCreditsTag").textContent = centsToUsd(state.creditsCents);
    const me = state.leaderboard.find(x => x.name.toLowerCase() === "dalton") || null;
    $("#navRankTag").textContent = me ? `#${rankOf("Dalton")}` : "#—";
  }

  function rankOf(name) {
    const sorted = [...state.leaderboard].sort((a,b)=>b.points-a.points);
    const idx = sorted.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    return idx >= 0 ? (idx + 1) : null;
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
    const iso = todayISO();
    if (state.lastDailyClaim === iso) {
      toast("Already claimed", "Come back tomorrow for your daily bonus.", "bad");
      return;
    }
    state.lastDailyClaim = iso;
    state.creditsCents += 10;
    bumpStreakIfNeeded();
    saveState();
    toast("Daily claimed", "+$0.10 credits • streak protected", "good");
    renderOverview();
  });

  function bumpStreakIfNeeded() {
    const iso = todayISO();
    if (state.lastStreakDate === iso) return;
    state.streakDays += 1;
    state.lastStreakDate = iso;
    const streakEl = document.querySelector("[data-kpi='streak']");
    if (streakEl) {
      streakEl.classList.add("onfire");
      setTimeout(() => streakEl.classList.remove("onfire"), 950);
    }
  }

  // Overview page
  function renderOverview() {
    const el = views.overview;
    const similar = findSimilarShows();
    const nextVoteTargets = topVoteTargets();
    el.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 12;">
          <div class="row">
            <div class="grow">
              <h2>Overview</h2>
              <div class="muted">Your progress, streaks, and what to vote next.</div>
            </div>
            <span class="badge blue">Personalized</span>
            <span class="badge green">Friends-ready</span>
            <span class="badge yellow">Community</span>
          </div>
        </div>

        <div class="card" style="grid-column: span 4;">
          <div class="kpi spark onfire" data-kpi="streak">
            <div class="label">Streak</div>
            <div class="value">${state.streakDays}<span style="font-size:14px; font-weight:900; color:rgba(255,255,255,.74)"> days</span></div>
            <div class="sub">Keep learning daily to boost rank</div>
          </div>
        </div>

        <div class="card" style="grid-column: span 4;">
          <div class="kpi">
            <div class="label">Credits</div>
            <div class="value">${centsToUsd(state.creditsCents)}</div>
            <div class="sub">Used for translations + votes</div>
          </div>
        </div>

        <div class="card" style="grid-column: span 4;">
          <div class="kpi">
            <div class="label">Watch time (today)</div>
            <div class="value">${state.watchMinutesToday}<span style="font-size:14px; font-weight:900; color:rgba(255,255,255,.74)"> min</span></div>
            <div class="sub">Higher watch time → more voting power</div>
          </div>
        </div>

        <div class="card" style="grid-column: span 7;">
          <h2>Shows in your orbit</h2>
          <div class="muted">Progress + what’s trending around you.</div>
          <div class="hr"></div>
          <table class="table">
            <thead>
              <tr><th>Show</th><th>Language</th><th>Progress</th><th>Votes (community)</th></tr>
            </thead>
            <tbody>
              ${state.shows.map(s => `
                <tr>
                  <td><b>${escapeHtml(s.title)}</b></td>
                  <td>${escapeHtml(s.lang)}</td>
                  <td>${Math.round(s.progress * 100)}%</td>
                  <td>${s.votes}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="hr"></div>
          <div class="row">
            <div class="grow">
              <div class="muted small">Similar shows you might like</div>
              <div class="row" style="margin-top:8px">
                ${similar.map(t => `<span class="badge blue">+ ${escapeHtml(t)}</span>`).join("") || `<span class="muted">No suggestions yet</span>`}
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="grid-column: span 5;">
          <h2>Best next votes</h2>
          <div class="muted">Targets that build your library fastest.</div>
          <div class="hr"></div>
          ${nextVoteTargets.map(v => `
            <div class="row" style="margin-bottom:10px">
              <div class="grow">
                <div style="font-weight:900">${escapeHtml(v.show)} <span class="muted">• S${v.season}</span></div>
                <div class="muted small">${escapeHtml(v.why)}</div>
              </div>
              <button class="btn btn-primary" data-vote="${escapeHtml(v.show)}|${v.season}">Vote</button>
            </div>
          `).join("")}
          <div class="muted small">Each vote costs <b>$0.33</b> (adjust later). Voting also boosts your rank.</div>
        </div>
      </div>
    `;
    el.querySelectorAll("[data-vote]").forEach(btn => {
      btn.addEventListener("click", () => {
        const [show, seasonStr] = btn.getAttribute("data-vote").split("|");
        placeVote(show, parseInt(seasonStr, 10));
        renderOverview();
      });
    });
  }

  function findSimilarShows() {
    const hasMH = state.shows.some(s => s.title.toLowerCase().includes("money heist"));
    const rec = [];
    if (hasMH) rec.push("Berlin (spin-off)", "Elite", "Vis a Vis");
    const hasSpanish = state.shows.some(s => s.lang.toLowerCase() === "spanish");
    if (hasSpanish) rec.push("La Reina del Sur", "Control Z");
    return Array.from(new Set(rec)).slice(0, 6);
  }

  function topVoteTargets() {
    return [
      { show: "Money Heist", season: 1, why: "High demand + your current focus" },
      { show: "Narcos", season: 1, why: "Spanish exposure + strong community momentum" },
      { show: "Dark", season: 1, why: "Diversify language challenge + leaderboard bonus" }
    ];
  }

  function placeVote(show, season) {
    const cost = 33;
    if (state.creditsCents < cost) {
      toast("Not enough credits", "Claim daily bonus or log watch time.", "bad");
      return;
    }
    state.creditsCents -= cost;
    state.votes.unshift({ show, season, reason: "Targeted vote from dashboard", costCents: cost, ts: Date.now() });
    const s = state.shows.find(x => x.title.toLowerCase() === show.toLowerCase());
    if (s) s.votes += 1;
    const me = state.leaderboard.find(x => x.name === "Dalton");
    if (me) me.points += 25;
    saveState();
    toast("Vote placed", `${show} • Season ${season} (-$0.33)`, "good");
    refreshNavBadges();
  }

  // Friends page
  function renderFriends() {
    const el = views.friends;
    const myCode = ensureFriendCode();
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
            <input class="input" id="myFriendCode" value="${escapeHtml(myCode)}" readonly />
            <button class="btn btn-primary" id="btnCopyCode">Copy</button>
          </div>
          <div class="muted small" style="margin-top:10px">
            Later, your backend will map codes → user_id in RDS and enforce subscription checks.
          </div>
        </div>
        <div class="card" style="grid-column: span 6;">
          <h2>Add a friend</h2>
          <div class="muted">Enter their friend code to connect.</div>
          <div class="hr"></div>
          <div class="row">
            <input class="input" id="friendCodeInput" placeholder="LING-XXXXXX" />
            <button class="btn btn-primary" id="btnAddFriend">Add</button>
          </div>
          <div class="muted small" style="margin-top:10px">
            In the real version, this triggers: create_friend_link(user_id, friend_user_id).
          </div>
        </div>
        <div class="card" style="grid-column: span 12;">
          <h2>Your circle</h2>
          <div class="muted">Progress comparison + similar show overlap.</div>
          <div class="hr"></div>
          ${state.friends.length ? `
            <table class="table">
              <thead>
                <tr><th>Friend</th><th>Since</th><th>Shared shows</th><th>Streak</th><th></th></tr>
              </thead>
              <tbody>
                ${state.friends.map((f, idx) => `
                  <tr>
                    <td><b>${escapeHtml(f.name)}</b><div class="muted small">${escapeHtml(f.code)}</div></td>
                    <td>${new Date(f.sinceTs).toLocaleDateString()}</td>
                    <td>${(f.sharedShows || []).slice(0,3).map(s => `<span class="badge blue">${escapeHtml(s)}</span>`).join(" ")}</td>
                    <td>${f.streak || Math.max(1, Math.floor(Math.random()*14))}d</td>
                    <td><button class="btn btn-ghost" data-rm="${idx}">Remove</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : `<div class="muted">No friends yet. Add one to unlock progress comparisons and head-to-head streak races.</div>`}
        </div>
      </div>
    `;
    $("#btnCopyCode").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(myCode);
        toast("Copied", "Friend code copied to clipboard.", "good");
      } catch {
        toast("Copy failed", "Your browser blocked clipboard. Copy manually.", "bad");
      }
    });
    $("#btnAddFriend").addEventListener("click", () => {
      const input = $("#friendCodeInput");
      const code = (input.value || "").trim().toUpperCase();
      if (!/^LING-[A-Z0-9]{6}$/.test(code)) {
        toast("Invalid code", "Format should look like LING-ABC123.", "bad");
        return;
      }
      if (code === myCode) {
        toast("Nice try", "You can’t add yourself.", "bad");
        return;
      }
      if (state.friends.some(f => f.code === code)) {
        toast("Already added", "That friend is already in your circle.", "bad");
        return;
      }
      const shared = sharedShowsRandom();
      state.friends.push({
        name: `Friend ${state.friends.length + 1}`,
        code,
        sinceTs: Date.now(),
        sharedShows: shared,
        streak: Math.max(1, Math.floor(Math.random() * 20))
      });
      input.value = "";
      saveState();
      toast("Friend added", `Connected with ${code}`, "good");
      renderFriends();
    });
    el.querySelectorAll("[data-rm]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-rm"), 10);
        state.friends.splice(idx, 1);
        saveState();
        toast("Removed", "Friend removed from your circle.", "good");
        renderFriends();
      });
    });
  }

  function sharedShowsRandom() {
    const pool = ["Money Heist", "Narcos", "Elite", "Dark", "Prison Break", "Breaking Bad"];
    const n = 1 + Math.floor(Math.random() * 3);
    const out = [];
    while (out.length < n) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!out.includes(pick)) out.push(pick);
    }
    return out;
  }

  // Votes page
  function renderVotes() {
    const el = views.votes;
    el.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 12;">
          <div class="row">
            <div class="grow">
              <h2>Votes</h2>
              <div class="muted">Target translations, prioritize shows, and earn more voting power.</div>
            </div>
            <span class="badge yellow">Credits: ${centsToUsd(state.creditsCents)}</span>
          </div>
        </div>
        <div class="card" style="grid-column: span 5;">
          <h2>Vote power</h2>
          <div class="muted">This is what you’ll store per user in RDS.</div>
          <div class="hr"></div>
          <div class="row">
            <div class="kpi">
              <div class="label">Monthly credits</div>
              <div class="value">$2.00</div>
              <div class="sub">Reset monthly (subscription tier)</div>
            </div>
          </div>
          <div class="hr"></div>
          <div class="muted small">
            <b>Future logic:</b>
            watch_minutes_today → bonus_credits_cents,
            streak_days → multiplier,
            friend_group_activity → shared bonus pool.
          </div>
        </div>
        <div class="card" style="grid-column: span 7;">
          <h2>Place a targeted vote</h2>
          <div class="muted">Pick a show/season and create demand signals.</div>
          <div class="hr"></div>
          <div class="row">
            <div class="grow">
              <label class="muted small">Show</label>
              <input class="input" id="voteShow" placeholder="e.g., Money Heist" />
            </div>
            <div style="width:120px">
              <label class="muted small">Season</label>
              <input class="input" id="voteSeason" type="number" min="1" value="1" />
            </div>
          </div>
          <div style="margin-top:10px">
            <label class="muted small">Why (optional)</label>
            <input class="input" id="voteWhy" placeholder="e.g., My friends are watching this next" />
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn btn-primary" id="btnPlaceVote">Vote (-$0.33)</button>
            <span class="muted small">Credits left: <b>${centsToUsd(state.creditsCents)}</b></span>
          </div>
        </div>
        <div class="card" style="grid-column: span 12;">
          <h2>Vote history</h2>
          <div class="muted">Each action is stored per user (and later shared to community analytics).</div>
          <div class="hr"></div>
          ${state.votes.length ? `
            <table class="table">
              <thead>
                <tr><th>When</th><th>Show</th><th>Season</th><th>Reason</th><th>Cost</th></tr>
              </thead>
              <tbody>
                ${state.votes.slice(0, 25).map(v => `
                  <tr>
                    <td>${new Date(v.ts).toLocaleString()}</td>
                    <td><b>${escapeHtml(v.show)}</b></td>
                    <td>S${v.season}</td>
                    <td class="muted">${escapeHtml(v.reason || "")}</td>
                    <td>${centsToUsd(v.costCents)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : `<div class="muted">No votes yet. Place a vote to start shaping the library.</div>`}
        </div>
      </div>
    `;
    $("#btnPlaceVote").addEventListener("click", () => {
      const show = ($("#voteShow").value || "").trim();
      const season = parseInt($("#voteSeason").value || "1", 10);
      const why = ($("#voteWhy").value || "").trim();
      if (!show) {
        toast("Missing show", "Enter a show title.", "bad");
        return;
      }
      if (!Number.isFinite(season) || season < 1) {
        toast("Invalid season", "Season must be 1 or higher.", "bad");
        return;
      }
      const cost = 33;
      if (state.creditsCents < cost) {
        toast("Not enough credits", "Claim daily bonus or log watch time.", "bad");
        return;
      }
      state.creditsCents -= cost;
      state.votes.unshift({ show, season, reason: why || "Targeted vote from Votes page", costCents: cost, ts: Date.now() });
      if (!state.shows.some(s => s.title.toLowerCase() === show.toLowerCase())) {
        state.shows.push({ title: show, progress: 0, lang: "Unknown", votes: 1 });
      } else {
        const s = state.shows.find(x => x.title.toLowerCase() === show.toLowerCase());
        if (s) s.votes += 1;
      }
      const me = state.leaderboard.find(x => x.name === "Dalton");
      if (me) me.points += 25;
      saveState();
      toast("Vote placed", `${show} • Season ${season}`, "good");
      renderVotes();
    });
  }

  // Community page
  function renderCommunity() {
    const el = views.community;
    const sorted = [...state.leaderboard].sort((a,b)=>b.points-a.points);
    const myRank = rankOf("Dalton") || "—";
    el.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 12;">
          <div class="row">
            <div class="grow">
              <h2>Community</h2>
              <div class="muted">Leaderboards, group goals, and “similar show” matchmaking.</div>
            </div>
            <span class="badge green">Your rank: #${myRank}</span>
          </div>
        </div>
        <div class="card" style="grid-column: span 7;">
          <h2>Leaderboard</h2>
          <div class="muted">Points come from watch time, streaks, votes, and helpful reports.</div>
          <div class="hr"></div>
          <table class="table">
            <thead>
              <tr><th>#</th><th>User</th><th>Points</th><th>Streak</th></tr>
            </thead>
            <tbody>
              ${sorted.map((u,i)=>`
                <tr>
                  <td><b>${i+1}</b></td>
                  <td>${escapeHtml(u.name)}</td>
                  <td>${u.points}</td>
                  <td>${u.streak}d</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="card" style="grid-column: span 5;">
          <h2>Community features you can unlock</h2>
          <div class="muted">This is what converts early users into daily users.</div>
          <div class="hr"></div>
          <div class="row" style="margin-bottom:10px">
            <span class="badge blue">Show Rooms</span>
            <span class="muted small">Users join a show room, compare progress, vote together.</span>
          </div>
          <div class="row" style="margin-bottom:10px">
            <span class="badge green">Group Streaks</span>
            <span class="muted small">Friends maintain streak together → bonus vote credits.</span>
          </div>
          <div class="row" style="margin-bottom:10px">
            <span class="badge yellow">Bounties</span>
            <span class="muted small">“Translate E3 today” bounty pool funded by votes.</span>
          </div>
          <div class="row" style="margin-bottom:10px">
            <span class="badge blue">Similarity Match</span>
            <span class="muted small">Find learners with same shows + goals.</span>
          </div>
          <div class="hr"></div>
          <button class="btn btn-primary" id="btnJoinRoom">Join a Room (demo)</button>
          <button class="btn btn-ghost" id="btnPostUpdate">Post Progress Update (demo)</button>
        </div>
        <div class="card" style="grid-column: span 12;">
          <h2>Community feed (demo)</h2>
          <div class="muted">Later: stored in RDS + cached; shows are filtered per user interest.</div>
          <div class="hr"></div>
          <div id="feed"></div>
        </div>
      </div>
    `;
    const feed = $("#feed");
    const items = buildDemoFeed();
    feed.innerHTML = items.map(x => `
      <div class="card" style="box-shadow:none; background: rgba(255,255,255,.03); border-color: rgba(255,255,255,.10); margin-bottom:12px">
        <div class="row">
          <div class="grow">
            <div style="font-weight:900">${escapeHtml(x.title)}</div>
            <div class="muted small">${escapeHtml(x.body)}</div>
          </div>
          <span class="badge blue">${escapeHtml(x.tag)}</span>
        </div>
      </div>
    `).join("");
    $("#btnJoinRoom").addEventListener("click", () => toast("Joined room", "You joined Money Heist • Room #12 (demo).", "good"));
    $("#btnPostUpdate").addEventListener("click", () => toast("Posted", "Progress update shared to your room (demo).", "good"));
  }

  function buildDemoFeed() {
    return [
      { title: "Room: Money Heist • Vote push started", body: "12 users voted Season 1 Episode 3 in the last hour.", tag: "Voting" },
      { title: "Streak race", body: "Dalton is +2 days ahead of Kai — keep the streak alive.", tag: "Friends" },
      { title: "New show room suggestion", body: "People who watch Narcos also join: Elite.", tag: "Match" }
    ];
  }

  // Command palette
  const overlay = $("#cmdOverlay");
  const cmdInput = $("#cmdInput");
  const cmdList = $("#cmdList");
  const commands = [
    { key: "overview", label: "Go to Overview", run: () => (location.hash = "#/overview") },
    { key: "friends", label: "Go to Friends", run: () => (location.hash = "#/friends") },
    { key: "votes", label: "Go to Votes", run: () => (location.hash = "#/votes") },
    { key: "community", label: "Go to Community", run: () => (location.hash = "#/community") },
    { key: "logout", label: "Log out", run: () => logout() }
  ];
  function openCmd() {
    overlay.classList.remove("hidden");
    cmdInput.value = "";
    renderCmdList("");
    cmdInput.focus();
  }
  function closeCmd() {
    overlay.classList.add("hidden");
  }
  function renderCmdList(q) {
    const query = (q || "").trim().toLowerCase();
    const filtered = commands.filter(c => c.key.includes(query) || c.label.toLowerCase().includes(query));
    cmdList.innerHTML = filtered.map((c, i) => `
      <div class="cmd-item" data-i="${i}">
        <div><b>${escapeHtml(c.key)}</b> <span class="muted">— ${escapeHtml(c.label)}</span></div>
        <span class="muted">↵</span>
      </div>
    `).join("") || `<div class="muted small">No commands</div>`;
    cmdList.querySelectorAll(".cmd-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.getAttribute("data-i"), 10);
        const filtered2 = commands.filter(c => c.key.includes(query) || c.label.toLowerCase().includes(query));
        const cmd = filtered2[idx];
        if (cmd) { closeCmd(); cmd.run(); }
      });
    });
  }
  $("#btnOpenCmd").addEventListener("click", openCmd);
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && !overlay.classList.contains("hidden")) return;
    if (e.key === "/" && document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (e.key === "/") { e.preventDefault(); openCmd(); }
    if (e.key === "Escape") closeCmd();
  });
  cmdInput.addEventListener("input", () => renderCmdList(cmdInput.value));
  cmdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = cmdList.querySelector(".cmd-item");
      if (first) first.click();
    }
    if (e.key === "Escape") closeCmd();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCmd();
  });
})();