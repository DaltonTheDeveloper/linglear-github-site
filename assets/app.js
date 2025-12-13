(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function setActiveNav() {
    const path = (location.pathname || "").toLowerCase();
    $$(".navbtn").forEach((b) => {
      const href = (b.getAttribute("href") || "").toLowerCase();
      b.classList.toggle("active", href && path.endsWith(href));
    });
  }

  function requireAuthOrRedirect() {
    const token = localStorage.getItem("linglear_token");
    if (!token) {
      // If you already have a login.html flow, redirect there.
      // Otherwise, keep user on page and show a banner.
      const msg = $("#authNotice");
      if (msg) msg.style.display = "block";
    }
  }

  function fmt(num) {
    return new Intl.NumberFormat().format(num ?? 0);
  }

  async function loadMe() {
    try {
      const me = await window.LinglearAPI.apiGet("/api/me");
      const elName = $("#meName");
      const elCode = $("#friendCode");
      if (elName) elName.textContent = me.display_name || "You";
      if (elCode) elCode.textContent = me.friend_code || "—";
      return me;
    } catch (e) {
      // not logged in or API down
      return null;
    }
  }

  // HOME PAGE
  async function loadHome() {
    const root = $("#pageHome");
    if (!root) return;

    const status = $("#statusLine");
    status.textContent = "Loading your dashboard…";

    try {
      const data = await window.LinglearAPI.apiGet("/api/dashboard/home");

      // Streak
      $("#streakCount").textContent = fmt(data.streak?.current_streak || 0);
      $("#weekMinutes").textContent = fmt(data.week?.minutes_watched || 0);
      $("#weekVotes").textContent = fmt(data.week?.votes_cast || 0);
      $("#weekEpisodes").textContent = fmt(data.week?.episodes_completed || 0);

      // Next unlock
      $("#unlockTitle").textContent = data.next_unlock?.title || "No target yet";
      $("#unlockMeta").textContent = data.next_unlock?.meta || "Start voting to unlock episodes.";
      const pct = Math.max(0, Math.min(100, data.next_unlock?.progress_pct || 0));
      $("#unlockBar").style.width = `${pct}%`;
      $("#unlockPct").textContent = `${pct}%`;

      // Continue watching
      const cw = $("#continueList");
      cw.innerHTML = "";
      (data.continue_watching || []).slice(0, 5).forEach((x) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div class="rank">▶</div>
          <div style="flex:1">
            <div style="font-weight:800">${escapeHtml(x.show)}</div>
            <div class="meta">${escapeHtml(x.meta || "")}</div>
            <div class="progress" style="margin-top:8px"><i style="width:${Math.max(0, Math.min(100, x.progress_pct || 0))}%"></i></div>
          </div>
          <a class="btn" href="./vote.html">Vote</a>
        `;
        cw.appendChild(div);
      });

      // Friends activity
      const fa = $("#friendFeed");
      fa.innerHTML = "";
      (data.friend_activity || []).slice(0, 6).forEach((ev) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div class="rank">${escapeHtml(ev.icon || "•")}</div>
          <div style="flex:1">
            <div style="font-weight:800">${escapeHtml(ev.title)}</div>
            <div class="meta">${escapeHtml(ev.time_ago || "")}</div>
          </div>
          <span class="badge"><span class="dot"></span>${escapeHtml(ev.tag || "Activity")}</span>
        `;
        fa.appendChild(div);
      });

      // Spark streak
      if (data.streak_incremented) {
        const fire = $("#fireIcon");
        const sparks = window.createSparks(fire);
        sparks.fire();
        fire.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
      }

      status.textContent = "Loaded.";
    } catch (e) {
      status.textContent = `Could not load: ${e.message}. Check API base or login token.`;
    }
  }

  // FRIENDS PAGE
  async function loadFriends() {
    const root = $("#pageFriends");
    if (!root) return;

    const status = $("#statusFriends");
    status.textContent = "Loading friends…";

    try {
      const list = await window.LinglearAPI.apiGet("/api/friends/list");
      const compare = await window.LinglearAPI.apiGet("/api/dashboard/friends");

      // list
      const ul = $("#friendsList");
      ul.innerHTML = "";
      (list.friends || []).forEach((f) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div class="rank">${escapeHtml((f.display_name || "?")[0])}</div>
          <div style="flex:1">
            <div style="font-weight:800">${escapeHtml(f.display_name || "")}</div>
            <div class="meta">${escapeHtml(f.status || "Friend")}</div>
          </div>
          <span class="badge"><span class="dot"></span>${escapeHtml(f.shared || "Shared")}</span>
        `;
        ul.appendChild(div);
      });

      // compare
      const table = $("#compareList");
      table.innerHTML = "";
      (compare.rows || []).forEach((r, idx) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div class="rank">${idx + 1}</div>
          <div style="flex:1">
            <div style="font-weight:850">${escapeHtml(r.display_name)}</div>
            <div class="meta">Minutes: ${fmt(r.minutes_watched)} • Votes: ${fmt(r.votes_cast)} • Episodes: ${fmt(r.episodes_completed)}</div>
          </div>
          <span class="badge"><span class="dot"></span>${escapeHtml(r.badge || "This week")}</span>
        `;
        table.appendChild(div);
      });

      status.textContent = "Loaded.";
    } catch (e) {
      status.textContent = `Could not load: ${e.message}`;
    }

    // Friend code request
    const codeBtn = $("#addByCodeBtn");
    if (codeBtn) {
      codeBtn.onclick = async () => {
        const code = ($("#friendCodeInput").value || "").trim();
        if (!code) return alert("Enter a friend code.");
        try {
          await window.LinglearAPI.apiPost("/api/friends/code", { code });
          alert("Friend request sent.");
        } catch (e) {
          alert(e.message);
        }
      };
    }

    // Email invite
    const emailBtn = $("#inviteEmailBtn");
    if (emailBtn) {
      emailBtn.onclick = async () => {
        const email = ($("#friendEmailInput").value || "").trim();
        if (!email) return alert("Enter an email.");
        try {
          await window.LinglearAPI.apiPost("/api/friends/email", { email });
          alert("Invite sent.");
        } catch (e) {
          alert(e.message);
        }
      };
    }
  }

  // VOTE PAGE
  async function loadVote() {
    const root = $("#pageVote");
    if (!root) return;

    const status = $("#statusVote");
    status.textContent = "Loading vote targets…";

    try {
      const data = await window.LinglearAPI.apiGet("/api/vote/targets");

      $("#votesRemaining").textContent = fmt(data.balance?.remaining || 0);
      $("#votesEarned").textContent = fmt(data.balance?.earned || 0);
      $("#votesSpent").textContent = fmt(data.balance?.spent || 0);

      const board = $("#targetsList");
      board.innerHTML = "";

      (data.targets || []).forEach((t) => {
        const pct = Math.max(0, Math.min(100, t.progress_pct || 0));
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div class="rank">🎯</div>
          <div style="flex:1">
            <div style="font-weight:850">${escapeHtml(t.title)}</div>
            <div class="meta">${escapeHtml(t.meta || "")}</div>
            <div class="row" style="margin-top:8px;justify-content:space-between;">
              <div class="progress" style="flex:1; min-width:180px;"><i style="width:${pct}%"></i></div>
              <span class="badge" style="margin-left:10px;"><span class="dot"></span>${pct}%</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; width:150px;">
            <input class="input" type="number" min="1" step="1" placeholder="Votes" data-target="${t.target_id}">
            <button class="btn primary" data-cast="${t.target_id}">Cast</button>
          </div>
        `;
        board.appendChild(div);
      });

      board.querySelectorAll("button[data-cast]").forEach((btn) => {
        btn.onclick = async () => {
          const targetId = btn.getAttribute("data-cast");
          const input = board.querySelector(`input[data-target="${targetId}"]`);
          const votes = parseInt((input?.value || "0"), 10);
          if (!votes || votes <= 0) return alert("Enter votes > 0.");
          try {
            const out = await window.LinglearAPI.apiPost("/api/vote/cast", { target_id: targetId, votes });
            // subtle micro feedback
            btn.animate([{ transform:"scale(1)" }, { transform:"scale(1.04)" }, { transform:"scale(1)" }], { duration: 260 });
            alert(out.message || "Votes cast.");
            location.reload();
          } catch (e) {
            alert(e.message);
          }
        };
      });

      status.textContent = "Loaded.";
    } catch (e) {
      status.textContent = `Could not load: ${e.message}`;
    }
  }

  // COMMUNITY PAGE
  async function loadCommunity() {
    const root = $("#pageCommunity");
    if (!root) return;

    const status = $("#statusCommunity");
    status.textContent = "Loading community hubs…";

    try {
      const data = await window.LinglearAPI.apiGet("/api/community/hubs");

      $("#activeNow").textContent = fmt(data.global?.active_now || 0);
      $("#unlockedToday").textContent = fmt(data.global?.unlocked_today || 0);

      const list = $("#hubsList");
      list.innerHTML = "";
      (data.hubs || []).forEach((h) => {
        const pct = Math.max(0, Math.min(100, h.progress_pct || 0));
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <div class="rank">🏛</div>
          <div style="flex:1">
            <div style="font-weight:900">${escapeHtml(h.title)}</div>
            <div class="meta">${escapeHtml(h.meta || "")}</div>
            <div class="row" style="margin-top:8px; justify-content:space-between;">
              <div class="progress" style="flex:1; min-width:180px;"><i style="width:${pct}%"></i></div>
              <span class="badge" style="margin-left:10px;"><span class="dot"></span>${pct}%</span>
            </div>
          </div>
          <a class="btn" href="./vote.html">Join</a>
        `;
        list.appendChild(div);
      });

      status.textContent = "Loaded.";
    } catch (e) {
      status.textContent = `Could not load: ${e.message}`;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setActiveNav();
    requireAuthOrRedirect();
    await loadMe();
    await loadHome();
    await loadFriends();
    await loadVote();
    await loadCommunity();
  });
})();
