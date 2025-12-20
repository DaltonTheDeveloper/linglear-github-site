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

    // Tabs (Friends / Pending / Mutual / Circles)
    let currentTab = root.getAttribute("data-current-tab") || "friends";

    function setTab(tab) {
      currentTab = tab;
      root.setAttribute("data-current-tab", tab);
      root.querySelectorAll("[data-friends-tab]").forEach((b) => {
        if (b.getAttribute("data-friends-tab") === tab) b.classList.add("primary");
        else b.classList.remove("primary");
      });
      root.querySelectorAll("[data-friends-pane]").forEach((p) => {
        p.style.display = p.getAttribute("data-friends-pane") === tab ? "" : "none";
      });

      // Periodic refresh for pending (requested by Dalton)
      try {
        if (root.__pendingInterval) {
          clearInterval(root.__pendingInterval);
          root.__pendingInterval = null;
        }
        if (tab === "pending") {
          root.__pendingInterval = setInterval(() => {
            // Only refresh if we are still on the pending tab
            if (root.getAttribute("data-current-tab") === "pending") {
              loadFriends().catch(() => {});
            }
          }, 15000);
        }
      } catch (_) {}
    }

    // One-time tab wiring
    if (!root.__tabsWired) {
      root.__tabsWired = true;
      root.querySelectorAll("[data-friends-tab]").forEach((b) => {
        b.addEventListener("click", () => {
          const t = b.getAttribute("data-friends-tab");
          setTab(t);
          // When opening pending tab, we periodically refresh
          if (t === "pending") {
            try { loadFriends(); } catch (_) {}
          }
        });
      });
    }
    setTab(currentTab);

    const status = $("#statusFriends");
    if (status) status.textContent = "Loading friends…";

    try {
      const list = await window.LinglearAPI.apiGet("/api/friends/list");
      const compare = await window.LinglearAPI.apiGet("/api/dashboard/friends");
      const groups = await window.LinglearAPI.apiGet("/api/groups");

      // --- counts for tab badges
      const friendsCount = (list.friends || []).length;
      const incomingCount = (list.incoming || []).length;
      const outgoingCount = (list.outgoing || []).length;
      const blockedCount = (list.blocked || []).length;
      const cF = $("#tabCountFriends");
      const cR = $("#tabCountRequests");
      if (cF) cF.textContent = friendsCount ? `(${friendsCount})` : "";
      if (cR) cR.textContent = incomingCount ? `(${incomingCount})` : "";
      const pBadge = $("#pendingBadge");
      if (pBadge) pBadge.textContent = `${incomingCount} incoming`;

      // --- compare table (always updated)
      const table = $("#compareList");
      if (table) {
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
      }

      // --- Friends pane
      const ul = $("#friendsList");
      if (ul) {
        ul.innerHTML = "";
        (list.friends || []).forEach((f) => {
          const div = document.createElement("div");
          div.className = "item";
          div.innerHTML = `
            <div class="rank">${escapeHtml((f.display_name || "?")[0])}</div>
            <div style="flex:1">
              <div style="font-weight:800">${escapeHtml(f.display_name || "")}</div>
              <div class="meta">${escapeHtml(f.email || "")}</div>
            </div>
            <div class="actions" style="display:flex;gap:6px; flex-wrap:wrap;">
              <button class="btn small" data-mutual="${f.friend_id}">Mutual</button>
              <button class="btn small blockBtn" data-id="${f.friend_id}">Block</button>
            </div>
          `;
          ul.appendChild(div);
        });

        ul.querySelectorAll("button[data-mutual]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const fid = btn.getAttribute("data-mutual");
            const sel = $("#mutualFriendSelect");
            if (sel) sel.value = String(fid);
            setTab("mutual");
            const loadBtn = $("#loadMutualBtn");
            if (loadBtn) loadBtn.click();
          });
        });

        ul.querySelectorAll(".blockBtn").forEach((btn) => {
          btn.addEventListener("click", async (ev) => {
            const fid = ev.currentTarget.getAttribute("data-id");
            if (!confirm("Block this user? They will not be able to interact with you.")) return;
            try {
              await window.LinglearAPI.apiPost("/api/friends/block", { friend_id: Number(fid) });
              alert("User blocked.");
              loadFriends();
            } catch (err) {
              alert(err.message);
            }
          });
        });
      }

      // --- Pending pane
      function renderPendingList(containerId, items, mode) {
        const el = $(containerId);
        if (!el) return;
        el.innerHTML = "";
        (items || []).forEach((r) => {
          const div = document.createElement("div");
          div.className = "item";
          let actions = "";
          if (mode === "incoming") {
            actions = `<button class="btn small acceptBtn" data-request="${r.request_id}">Accept</button>
                       <button class="btn small declineBtn" data-request="${r.request_id}">Decline</button>`;
          } else if (mode === "outgoing") {
            actions = `<span class="badge"><span class="dot"></span>Pending</span>
                       <button class="btn small cancelBtn" data-request="${r.request_id}">Cancel</button>`;
          } else if (mode === "blocked") {
            actions = `<button class="btn small unblockBtn" data-id="${r.friend_id}">Unblock</button>`;
          }
          div.innerHTML = `
            <div class="rank">${escapeHtml((r.display_name || "?")[0])}</div>
            <div style="flex:1">
              <div style="font-weight:800">${escapeHtml(r.display_name || "")}</div>
              <div class="meta">${escapeHtml(r.email || "")}</div>
            </div>
            <div class="actions" style="display:flex;gap:4px; flex-wrap:wrap;">${actions}</div>
          `;
          el.appendChild(div);
        });
      }
      renderPendingList("#incomingList", list.incoming, "incoming");
      renderPendingList("#outgoingList", list.outgoing, "outgoing");
      renderPendingList("#blockedList", list.blocked, "blocked");
      const pendingHint = $("#pendingHint");
      if (pendingHint) pendingHint.textContent = `Incoming: ${incomingCount} • Outgoing: ${outgoingCount} • Blocked: ${blockedCount}`;

      // Bind pending action handlers
      const pendingRoot = $("#pageFriends");
      if (pendingRoot) {
        pendingRoot.querySelectorAll(".acceptBtn").forEach((btn) => {
          btn.onclick = async () => {
            const rid = btn.getAttribute("data-request");
            try {
              await window.LinglearAPI.apiPost("/api/friends/accept", { request_id: Number(rid) });
              loadFriends();
            } catch (err) { alert(err.message); }
          };
        });
        pendingRoot.querySelectorAll(".declineBtn").forEach((btn) => {
          btn.onclick = async () => {
            const rid = btn.getAttribute("data-request");
            try {
              await window.LinglearAPI.apiPost("/api/friends/decline", { request_id: Number(rid) });
              loadFriends();
            } catch (err) { alert(err.message); }
          };
        });
        pendingRoot.querySelectorAll(".cancelBtn").forEach((btn) => {
          btn.onclick = async () => {
            const rid = btn.getAttribute("data-request");
            if (!confirm("Cancel this pending friend request?")) return;
            try {
              await window.LinglearAPI.apiPost("/api/friends/cancel", { request_id: Number(rid) });
              loadFriends();
            } catch (err) { alert(err.message); }
          };
        });
        pendingRoot.querySelectorAll(".unblockBtn").forEach((btn) => {
          btn.onclick = async () => {
            const fid = btn.getAttribute("data-id");
            try {
              await window.LinglearAPI.apiPost("/api/friends/unblock", { friend_id: Number(fid) });
              loadFriends();
            } catch (err) { alert(err.message); }
          };
        });
      }

      // --- Mutual pane: friend dropdown options
      const sel = $("#mutualFriendSelect");
      if (sel) {
        const current = sel.value;
        sel.innerHTML = "";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "Select a friend…";
        sel.appendChild(opt0);
        (list.friends || []).forEach((f) => {
          const o = document.createElement("option");
          o.value = String(f.friend_id);
          o.textContent = f.display_name || f.email || `User ${f.friend_id}`;
          sel.appendChild(o);
        });
        if (current) sel.value = current;
      }

      const loadMutualBtn = $("#loadMutualBtn");
      if (loadMutualBtn && !loadMutualBtn.__wired) {
        loadMutualBtn.__wired = true;
        loadMutualBtn.onclick = async () => {
          const fid = Number((sel && sel.value) || 0);
          const out = $("#mutualList");
          const hint = $("#mutualHint");
          if (!fid) { if (hint) hint.textContent = "Pick a friend first."; return; }
          if (out) out.innerHTML = "";
          if (hint) hint.textContent = "Loading mutual shows…";
          try {
            const data = await window.LinglearAPI.apiGet(`/api/friends/mutual?friend_id=${fid}`);
            const arr = data.mutual || [];
            if (!arr.length) {
              if (hint) hint.textContent = "No overlap yet (watch history table empty or you two haven't watched the same show).";
              return;
            }
            if (hint) hint.textContent = `Found ${arr.length} mutual show(s).`;
            arr.forEach((s) => {
              const div = document.createElement("div");
              div.className = "item";
              div.innerHTML = `
                <div class="rank">🎬</div>
                <div style="flex:1">
                  <div style="font-weight:850">${escapeHtml(s.title || "")}</div>
                  <div class="meta">You: ${escapeHtml(s.my_state || "?")} • Friend: ${escapeHtml(s.friend_state || "?")}</div>
                </div>
                <span class="badge"><span class="dot"></span>${escapeHtml(s.language || "")}</span>
              `;
              if (out) out.appendChild(div);
            });
          } catch (e) {
            if (hint) hint.textContent = `Could not load: ${e.message}`;
          }
        };
      }

      // --- Circles pane
      const gList = $("#groupsList");
      if (gList) {
        gList.innerHTML = "";
        (groups.groups || []).forEach((g) => {
          const div = document.createElement("div");
          div.className = "item";
          div.innerHTML = `
            <div class="rank">👥</div>
            <div style="flex:1">
              <div style="font-weight:850">${escapeHtml(g.name || "")}</div>
              <div class="meta">Role: ${escapeHtml(g.role || "MEMBER")} • Members: ${fmt(g.member_count || 0)}</div>
            </div>
            <span class="badge"><span class="dot"></span>Circle</span>
          `;
          gList.appendChild(div);
        });
        if (!(groups.groups || []).length) {
          const div = document.createElement("div");
          div.className = "item";
          div.innerHTML = `<div style="color:rgba(234,240,255,0.7)">No circles yet. Create one above.</div>`;
          gList.appendChild(div);
        }
      }

      const createGroupBtn = $("#createGroupBtn");
      if (createGroupBtn && !createGroupBtn.__wired) {
        createGroupBtn.__wired = true;
        createGroupBtn.onclick = async () => {
          const name = ($(`#newGroupName`)?.value || "").trim();
          if (!name) return alert("Enter a circle name.");
          try {
            await window.LinglearAPI.apiPost("/api/groups/create", { name });
            $(`#newGroupName`).value = "";
            loadFriends();
          } catch (e) {
            alert(e.message);
          }
        };
      }

      if (status) status.textContent = "Loaded.";

    } catch (e) {
      if (status) status.textContent = `Could not load: ${e.message}`;
    }

    // Attach event handlers for dynamic buttons inside try block

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

  // -----------------------------------------------------------------------
  // SSE: live updates (Discord-style)
  // -----------------------------------------------------------------------
  let sse;
  function startSSE() {
    try {
      const token = window.LinglearAPI?.getToken ? window.LinglearAPI.getToken() : "";
      if (!token) return;
      const base = window.LinglearAPI.getBackend();
      const url = base + "/api/events/stream?token=" + encodeURIComponent(token);

      // Close any existing stream
      try { sse && sse.close && sse.close(); } catch (_) {}

      sse = new EventSource(url);

      sse.addEventListener("hello", () => {
        // no-op, but helps confirm connection in DevTools
      });

      sse.addEventListener("friends:update", async () => {
        // Keep friends page and any friend-related widgets in sync.
        try { await loadFriends(); } catch (_) {}
        try { await loadHome(); } catch (_) {}
      });

      // Pending request count updates (used for the Friends -> Requests tab)
      sse.addEventListener("requests:update", (ev) => {
        try {
          const data = JSON.parse(ev.data || "{}");
          const cR = $("#tabCountRequests");
          const incoming = Number(data.incoming_pending || 0);
          if (cR) cR.textContent = incoming ? `(${incoming})` : "";
          const badge = $("#pendingBadge");
          if (badge) badge.textContent = `${incoming} incoming`;
        } catch (_) {}
      });

      sse.addEventListener("dashboard:update", async () => {
        try { await loadHome(); } catch (_) {}
      });

      sse.addEventListener("notify", (ev) => {
        try {
          const data = JSON.parse(ev.data || "{}");
          if (data && data.message) window.toast ? window.toast(data.message) : alert(data.message);
        } catch (_) {}
      });

      sse.onerror = () => {
        // Browsers auto-retry EventSource. Do not spam alerts.
      };
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setActiveNav();
    requireAuthOrRedirect();
    await loadMe();
    startSSE();
    await loadHome();
    await loadFriends();
    await loadVote();
    await loadCommunity();
  });
})();
