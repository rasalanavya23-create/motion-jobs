/* ═══════════════════════════════════════════════════════════
   Motion Jobs — Frontend Application
   ═══════════════════════════════════════════════════════════ */

const DATA_URL = "./data/jobs.json";

/* ── State ──────────────────────────────────────────────── */
const state = {
  allJobs:      [],
  filtered:     [],
  tab:          "jobs",        // jobs | bookmarks | tracker
  filters: {
    search:     "",
    dateRange:  "all",         // all | 24h | week | month
    country:    "all",
    workType:   "all",         // all | Remote | Hybrid | On-site
    employment: "all",
    visa:       false,
    sort:       "newest",
  },
  activeJob:    null,
  profile: {
    name: "", email: "", phone: "", portfolio: "", linkedin: "", location: "",
    resumes: [],
  },
  bookmarks:    new Set(),
  tracker:      {},            // id → { status, appliedAt, notes }
  lastUpdated:  null,
  newJobCount:  0,
  prevJobIds:   new Set(),
};

/* ── Persisted storage helpers ──────────────────────────── */
function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function loadPersisted() {
  state.profile   = loadLS("mj_profile",   state.profile);
  state.bookmarks = new Set(loadLS("mj_bookmarks", []));
  state.tracker   = loadLS("mj_tracker",   {});
  state.prevJobIds= new Set(loadLS("mj_prev_ids",  []));
}

function savePersisted() {
  saveLS("mj_profile",   state.profile);
  saveLS("mj_bookmarks", [...state.bookmarks]);
  saveLS("mj_tracker",   state.tracker);
  saveLS("mj_prev_ids",  [...state.prevJobIds]);
}

/* ── Utilities ──────────────────────────────────────────── */
function timeAgo(isoString) {
  if (!isoString) return "Unknown date";
  const dt = new Date(isoString);
  if (isNaN(dt)) return "Unknown date";
  const diff = Date.now() - dt.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <= 7)  return `${days}d ago`;
  if (days  <= 30) return `${Math.floor(days/7)}w ago`;
  return dt.toLocaleDateString();
}

function isWithin(isoString, hours) {
  if (!isoString) return false;
  const dt = new Date(isoString);
  return (Date.now() - dt.getTime()) < hours * 3600000;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function initials(name) {
  return (name || "?")
    .split(/\s+/).filter(Boolean)
    .slice(0,2).map(w => w[0]).join("").toUpperCase() || "?";
}

function colorForName(name) {
  const colors = [
    ["#7c5cfc","#a855f7"],["#3b82f6","#6366f1"],["#ec4899","#a855f7"],
    ["#14b8a6","#3b82f6"],["#f59e0b","#ef4444"],["#22c55e","#14b8a6"],
  ];
  const idx = (name || "").charCodeAt(0) % colors.length;
  return colors[idx];
}

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>${escapeHtml(msg)}`;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ── Outreach message generator ────────────────────────── */
function generateOutreach(job) {
  const skills    = (job.skills || []).slice(0, 3).join(", ");
  const location  = job.work_type === "Remote" ? "remote-first" : job.location || job.country;
  const workNote  = job.work_type === "Remote"
    ? "I'm fully set up for remote collaboration and have experience delivering high-quality motion work across time zones."
    : `I'm open to working from ${location} and excited about the possibility of joining your team in person.`;

  const descSnippet = (() => {
    const d = (job.description || "").toLowerCase();
    if (d.includes("brand")) return "brand storytelling";
    if (d.includes("social")) return "social media content";
    if (d.includes("product")) return "product animation";
    if (d.includes("explainer")) return "explainer videos";
    if (d.includes("3d")) return "3D motion design";
    if (d.includes("ui") || d.includes("interface")) return "UI animation";
    if (d.includes("broadcast")) return "broadcast design";
    return "motion graphics";
  })();

  return `Subject: Motion Designer – ${job.title} at ${job.company}

Hi [Hiring Manager's Name],

I came across ${job.company}'s ${job.title} role and immediately connected with the work you're doing in ${descSnippet}. ${job.company}'s visual identity caught my attention, and I'd love to bring my experience to your creative team.

I'm a motion designer specializing in ${skills || "After Effects, Cinema 4D, and storytelling-driven animation"}. ${workNote}

A few highlights from my recent work:
• [Project 1 – brief description and measurable result]
• [Project 2 – brief description and measurable result]
• Portfolio: [YOUR PORTFOLIO LINK]

I'm particularly excited about ${job.company} because [specific reason – company product, campaign, or recent launch you admire]. I believe my background in ${descSnippet} aligns well with what you're looking for.

Would you be open to a 20-minute call to explore this further? I'm happy to work around your schedule.

Thank you for your time.

Best,
[YOUR NAME]
[YOUR EMAIL] | [YOUR PHONE]
[YOUR PORTFOLIO] | [YOUR LINKEDIN]`;
}

/* ── Decision-makers generator ──────────────────────────── */
function generateContacts(job) {
  const company = job.company || "this company";
  const roles = [
    { title: "Head of Talent Acquisition",  dept: "Recruiting"       },
    { title: "Creative Director",            dept: "Creative"         },
    { title: "Design Manager",               dept: "Design"           },
    { title: "Motion Design Lead",           dept: "Motion"           },
    { title: "Recruiter",                    dept: "Talent"           },
    { title: "VP of Design",                 dept: "Design Leadership"},
  ];
  return roles.map(r => ({
    name:     `[Find on LinkedIn: "${r.title} at ${company}"]`,
    title:    r.title,
    company:  company,
    linkedin: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(r.title + " " + company)}`,
    email:    null,
  }));
}

/* ── Data fetching ──────────────────────────────────────── */
async function loadJobs() {
  showLoader();
  try {
    const r = await fetch(`${DATA_URL}?t=${Date.now()}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    state.lastUpdated = data.last_updated;
    state.allJobs     = data.jobs || [];

    // detect new jobs since last session
    const currentIds = new Set(state.allJobs.map(j => j.id));
    state.newJobCount = [...currentIds].filter(id => !state.prevJobIds.has(id)).length;
    if (state.prevJobIds.size > 0 && state.newJobCount > 0) {
      toast(`${state.newJobCount} new motion design jobs found!`, "success");
    }
    state.prevJobIds = currentIds;
    savePersisted();

    updateRefreshBar();
    applyFilters();
  } catch (err) {
    console.error(err);
    showEmpty("Could not load jobs data",
      "Make sure data/jobs.json exists. Run the GitHub Action to populate it with real jobs.");
  }
}

/* ── Filtering & sorting ────────────────────────────────── */
function applyFilters() {
  const f = state.filters;
  let jobs = [...state.allJobs];

  if (f.search) {
    const q = f.search.toLowerCase();
    jobs = jobs.filter(j =>
      (j.title||"").toLowerCase().includes(q) ||
      (j.company||"").toLowerCase().includes(q) ||
      (j.description||"").toLowerCase().includes(q) ||
      (j.location||"").toLowerCase().includes(q)
    );
  }

  if (f.dateRange !== "all") {
    const hours = { "24h": 24, "week": 168, "month": 720 }[f.dateRange];
    jobs = jobs.filter(j => isWithin(j.date_posted, hours));
  }

  if (f.country !== "all") {
    jobs = jobs.filter(j => (j.country||"").toLowerCase().includes(f.country.toLowerCase()));
  }

  if (f.workType !== "all") {
    jobs = jobs.filter(j => (j.work_type||"").toLowerCase() === f.workType.toLowerCase());
  }

  if (f.employment !== "all") {
    jobs = jobs.filter(j => (j.employment_type||"").toLowerCase().includes(f.employment.toLowerCase()));
  }

  if (f.visa) {
    jobs = jobs.filter(j => j.visa_sponsorship === true);
  }

  if (f.sort === "newest") {
    jobs.sort((a, b) => new Date(b.date_posted) - new Date(a.date_posted));
  } else if (f.sort === "oldest") {
    jobs.sort((a, b) => new Date(a.date_posted) - new Date(b.date_posted));
  } else if (f.sort === "salary") {
    jobs.sort((a, b) => (b.salary_max || b.salary_min || 0) - (a.salary_max || a.salary_min || 0));
  }

  state.filtered = jobs;
  renderJobs();
  updateCounts();
}

/* ── Rendering ──────────────────────────────────────────── */
function showLoader() {
  document.getElementById("jobs-grid").innerHTML = `
    <div class="loader-wrap" style="grid-column:1/-1">
      <div class="spinner"></div>
      <p style="color:var(--text-3);font-size:13px">Fetching motion design jobs worldwide…</p>
    </div>`;
}

function showEmpty(title, desc) {
  document.getElementById("jobs-grid").innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🎬</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
    </div>`;
}

function renderJobs() {
  const grid = document.getElementById("jobs-grid");
  const jobs = state.tab === "bookmarks"
    ? state.filtered.filter(j => state.bookmarks.has(j.id))
    : state.filtered;

  if (!jobs.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <h3>No jobs found</h3>
        <p>Try adjusting your filters or check back after the next auto-refresh.</p>
      </div>`;
    return;
  }

  grid.innerHTML = jobs.map(j => buildJobCard(j)).join("");

  grid.querySelectorAll(".job-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".card-bookmark")) return;
      openDetail(card.dataset.id);
    });
  });

  grid.querySelectorAll(".card-bookmark").forEach(btn => {
    btn.addEventListener("click", () => toggleBookmark(btn.dataset.id));
  });
}

function buildJobCard(j) {
  const bk    = state.bookmarks.has(j.id);
  const isNew = isWithin(j.date_posted, 24);
  const [c1, c2] = colorForName(j.company);
  const wtCls = { "Remote": "tag-remote", "Hybrid": "tag-hybrid", "On-site": "tag-onsite" }[j.work_type] || "";
  const skills = (j.skills || []).slice(0, 4);

  return `
<div class="job-card${bk ? " bookmarked" : ""}" data-id="${escapeHtml(j.id)}">
  <div class="card-top">
    <div class="company-avatar" style="background:linear-gradient(135deg,${c1},${c2})">
      ${escapeHtml(initials(j.company))}
    </div>
    <div class="card-title-area">
      <div class="card-title">${escapeHtml(j.title)}</div>
      <div class="card-company">${escapeHtml(j.company)}</div>
    </div>
    <button class="card-bookmark${bk ? " active" : ""}" data-id="${escapeHtml(j.id)}" title="Bookmark">
      ${bk ? "★" : "☆"}
    </button>
  </div>

  <div class="card-meta">
    ${j.location || j.country ? `
    <div class="meta-tag">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      ${escapeHtml((j.location ? j.location + ", " : "") + (j.country || ""))}
    </div>` : ""}
    ${j.work_type ? `<div class="meta-tag ${wtCls}">${escapeHtml(j.work_type)}</div>` : ""}
    ${j.employment_type ? `<div class="meta-tag">${escapeHtml(j.employment_type)}</div>` : ""}
    ${j.visa_sponsorship ? `<div class="meta-tag tag-visa">✈ Visa Sponsorship</div>` : ""}
    ${j.salary ? `<div class="meta-tag tag-salary">💰 ${escapeHtml(j.salary)}</div>` : ""}
    ${isNew ? `<div class="meta-tag tag-new">🔥 New</div>` : ""}
  </div>

  ${j.description ? `<div class="card-desc">${escapeHtml(j.description)}</div>` : ""}

  ${skills.length ? `
  <div class="skills-row">
    ${skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("")}
    ${(j.skills||[]).length > 4 ? `<span class="skill-tag">+${(j.skills||[]).length - 4}</span>` : ""}
  </div>` : ""}

  <div class="card-footer">
    <span class="source-tag">${escapeHtml(j.source || "")}</span>
    <span>${escapeHtml(timeAgo(j.date_posted))}</span>
    ${j.apply_url ? `
    <a href="${escapeHtml(j.apply_url)}" target="_blank" rel="noopener"
       onclick="event.stopPropagation()"
       style="margin-left:auto;background:var(--accent);color:#fff;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap">
      Apply →
    </a>` : ""}
  </div>
</div>`;
}

/* ── Detail panel ───────────────────────────────────────── */
function openDetail(id) {
  const job = state.allJobs.find(j => j.id === id);
  if (!job) return;
  state.activeJob = job;
  renderDetail(job);
  document.getElementById("detail-panel").classList.add("open");
  document.getElementById("detail-overlay").classList.add("open");
}

function closeDetail() {
  document.getElementById("detail-panel").classList.remove("open");
  document.getElementById("detail-overlay").classList.remove("open");
}

function renderDetail(job) {
  const [c1, c2] = colorForName(job.company);
  const tracked  = state.tracker[job.id];
  const contacts = generateContacts(job);
  const outreach = generateOutreach(job);

  document.getElementById("detail-content").innerHTML = `
    <!-- Header -->
    <div class="detail-header">
      <button class="detail-close" id="detail-close">✕</button>
      <div class="company-avatar" style="background:linear-gradient(135deg,${c1},${c2});width:50px;height:50px;font-size:20px;border-radius:12px">
        ${escapeHtml(initials(job.company))}
      </div>
      <div class="detail-title-wrap">
        <div class="detail-job-title">${escapeHtml(job.title)}</div>
        <div class="detail-company">${escapeHtml(job.company)}</div>
      </div>
    </div>

    <!-- Body -->
    <div class="detail-body">

      <!-- Meta grid -->
      <div class="detail-meta-grid">
        <div class="detail-meta-item">
          <div class="detail-meta-label">📍 Location</div>
          <div class="detail-meta-value">${escapeHtml((job.location || "") + (job.country ? (job.location ? ", " : "") + job.country : ""))}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">🌐 Work Type</div>
          <div class="detail-meta-value">${escapeHtml(job.work_type || "—")}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">💼 Employment</div>
          <div class="detail-meta-value">${escapeHtml(job.employment_type || "—")}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">💰 Salary</div>
          <div class="detail-meta-value">${escapeHtml(job.salary || "Not listed")}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">📅 Posted</div>
          <div class="detail-meta-value">${escapeHtml(timeAgo(job.date_posted))}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">✈️ Visa</div>
          <div class="detail-meta-value">${job.visa_sponsorship === true ? "✓ Sponsorship Available" : "Not mentioned"}</div>
        </div>
        ${job.experience ? `
        <div class="detail-meta-item" style="grid-column:1/-1">
          <div class="detail-meta-label">🎯 Experience</div>
          <div class="detail-meta-value">${escapeHtml(String(job.experience))}</div>
        </div>` : ""}
      </div>

      <!-- Skills -->
      ${(job.skills || []).length ? `
      <div>
        <div class="detail-section-title">Required Skills</div>
        <div class="detail-skills">
          ${(job.skills||[]).map(s => `<span class="skill-tag" style="font-size:12px;padding:4px 10px">${escapeHtml(s)}</span>`).join("")}
        </div>
      </div>` : ""}

      <!-- Description -->
      ${job.description ? `
      <div>
        <div class="detail-section-title">Job Description</div>
        <div class="detail-desc">${escapeHtml(job.description)}</div>
      </div>` : ""}

      <!-- Decision Makers & Contact -->
      <div>
        <div class="detail-section-title">Reach Out to ${escapeHtml(job.company)}</div>

        <!-- Direct company links -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          ${job.apply_url ? `
          <a href="${escapeHtml(job.apply_url)}" target="_blank" rel="noopener" class="contact-link" style="background:var(--accent);color:#fff;border-color:var(--accent);font-size:12px;padding:6px 12px">
            🚀 Apply Directly
          </a>` : ""}
          ${job.company_linkedin ? `
          <a href="${escapeHtml(job.company_linkedin)}" target="_blank" rel="noopener" class="contact-link">
            💼 Company LinkedIn
          </a>` : ""}
          ${job.company_twitter ? `
          <a href="${escapeHtml(job.company_twitter)}" target="_blank" rel="noopener" class="contact-link">
            🐦 Twitter / X
          </a>` : ""}
          ${job.company_website ? `
          <a href="${escapeHtml(job.company_website)}" target="_blank" rel="noopener" class="contact-link">
            🌐 Website
          </a>` : ""}
        </div>

        <!-- Email contacts -->
        ${job.careers_email || job.jobs_email ? `
        <div style="margin-bottom:12px">
          <div class="detail-meta-label" style="margin-bottom:6px">📧 Common Hiring Emails</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${job.careers_email ? `
            <a href="mailto:${escapeHtml(job.careers_email)}" class="contact-link">
              ✉ ${escapeHtml(job.careers_email)}
            </a>` : ""}
            ${job.jobs_email ? `
            <a href="mailto:${escapeHtml(job.jobs_email)}" class="contact-link">
              ✉ ${escapeHtml(job.jobs_email)}
            </a>` : ""}
          </div>
        </div>` : ""}

        <!-- Hiring roles to find on LinkedIn -->
        <div class="detail-meta-label" style="margin-bottom:6px">🔍 Find These People on LinkedIn</div>
        <div class="detail-contacts-list">
          ${contacts.map(c => `
          <div class="contact-card">
            <div class="contact-avatar">${escapeHtml(c.title.substring(0,2).toUpperCase())}</div>
            <div class="contact-info">
              <div class="contact-name">${escapeHtml(c.title)}</div>
              <div class="contact-title">${escapeHtml(c.company)}</div>
            </div>
            <div class="contact-links">
              <a class="contact-link" href="${escapeHtml(c.linkedin)}" target="_blank" rel="noopener">🔗 Search LinkedIn</a>
            </div>
          </div>`).join("")}
        </div>
      </div>

      <!-- Outreach -->
      <div>
        <div class="detail-section-title">Personalized Outreach Message</div>
        <div class="outreach-box">
          <textarea id="outreach-text" spellcheck="true">${escapeHtml(outreach)}</textarea>
          <div class="outreach-actions">
            <button class="btn-sm btn-outline" id="copy-outreach">📋 Copy to Clipboard</button>
            <button class="btn-sm btn-outline" id="regen-outreach">🔄 Regenerate</button>
          </div>
        </div>
      </div>

      <!-- Source -->
      <div style="font-size:12px;color:var(--text-3)">
        Source: <span style="color:var(--text-2)">${escapeHtml(job.source || "")}</span>
      </div>

    </div>

    <!-- Footer -->
    <div class="detail-footer">
      <a href="${escapeHtml(job.apply_url || "#")}" target="_blank" rel="noopener" class="btn-apply">
        🚀 Apply Now
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
      <button class="btn-track${tracked ? " tracked" : ""}" id="track-btn">
        ${tracked ? "✓ Tracked" : "+ Track Application"}
      </button>
    </div>
  `;

  document.getElementById("detail-close").onclick  = closeDetail;
  document.getElementById("copy-outreach").onclick = () => {
    navigator.clipboard.writeText(document.getElementById("outreach-text").value)
      .then(() => toast("Outreach message copied!", "success"))
      .catch(() => toast("Copy failed — select text manually", "error"));
  };
  document.getElementById("regen-outreach").onclick = () => {
    document.getElementById("outreach-text").value = generateOutreach(job);
    toast("Message regenerated");
  };
  document.getElementById("track-btn").onclick = () => trackApplication(job);
}

/* ── Tracker ────────────────────────────────────────────── */
function trackApplication(job) {
  if (!state.tracker[job.id]) {
    state.tracker[job.id] = {
      title:     job.title,
      company:   job.company,
      status:    "applied",
      appliedAt: new Date().toISOString(),
      notes:     "",
    };
    savePersisted();
    toast(`Tracking "${job.title}" at ${job.company}`, "success");
    document.getElementById("track-btn").classList.add("tracked");
    document.getElementById("track-btn").textContent = "✓ Tracked";
    updateCounts();
  } else {
    toast("Already in your tracker");
  }
}

function renderTracker() {
  const grid   = document.getElementById("jobs-grid");
  const tracked = Object.entries(state.tracker);
  if (!tracked.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">📋</div>
        <h3>No applications tracked yet</h3>
        <p>Open any job and click "+ Track Application" to keep tabs on your applications.</p>
      </div>`;
    return;
  }

  const statuses = ["applied","interview","offer","rejected","ghosted"];
  grid.innerHTML = `<div class="tracker-grid" style="grid-column:1/-1;padding:0">
    ${tracked.map(([id, t]) => `
    <div class="tracker-card">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:600">${escapeHtml(t.title)}</div>
          <div style="font-size:12px;color:var(--text-3)">${escapeHtml(t.company)}</div>
        </div>
        <button onclick="removeTracked('${id}')" style="background:none;border:none;color:var(--text-3);font-size:16px;cursor:pointer">✕</button>
      </div>
      <select class="status-select" onchange="updateTrackedStatus('${id}', this.value)">
        ${statuses.map(s => `<option value="${s}"${t.status===s?" selected":""}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join("")}
      </select>
      <div style="font-size:11px;color:var(--text-3)">Applied: ${escapeHtml(timeAgo(t.appliedAt))}</div>
    </div>`).join("")}
  </div>`;
}

function updateTrackedStatus(id, status) {
  if (state.tracker[id]) {
    state.tracker[id].status = status;
    savePersisted();
    toast(`Status updated to ${status}`);
  }
}

window.removeTracked = function(id) {
  delete state.tracker[id];
  savePersisted();
  renderTracker();
  updateCounts();
};

/* ── Bookmark ───────────────────────────────────────────── */
function toggleBookmark(id) {
  if (state.bookmarks.has(id)) {
    state.bookmarks.delete(id);
    toast("Bookmark removed");
  } else {
    state.bookmarks.add(id);
    toast("Job bookmarked ★", "success");
  }
  savePersisted();
  document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
    if (el.classList.contains("card-bookmark")) {
      el.classList.toggle("active", state.bookmarks.has(id));
      el.textContent = state.bookmarks.has(id) ? "★" : "☆";
    }
    if (el.classList.contains("job-card")) {
      el.classList.toggle("bookmarked", state.bookmarks.has(id));
    }
  });
  updateCounts();
}

/* ── Profile modal ──────────────────────────────────────── */
function openProfile() {
  document.getElementById("profile-overlay").classList.add("open");
  const p = state.profile;
  document.getElementById("p-name").value      = p.name      || "";
  document.getElementById("p-email").value     = p.email     || "";
  document.getElementById("p-phone").value     = p.phone     || "";
  document.getElementById("p-portfolio").value = p.portfolio || "";
  document.getElementById("p-linkedin").value  = p.linkedin  || "";
  document.getElementById("p-location").value  = p.location  || "";
  renderResumeList();
}

function closeProfile() {
  document.getElementById("profile-overlay").classList.remove("open");
}

function saveProfile() {
  state.profile.name      = document.getElementById("p-name").value.trim();
  state.profile.email     = document.getElementById("p-email").value.trim();
  state.profile.phone     = document.getElementById("p-phone").value.trim();
  state.profile.portfolio = document.getElementById("p-portfolio").value.trim();
  state.profile.linkedin  = document.getElementById("p-linkedin").value.trim();
  state.profile.location  = document.getElementById("p-location").value.trim();
  savePersisted();
  closeProfile();
  toast("Profile saved!", "success");
}

function renderResumeList() {
  const list = document.getElementById("resume-list");
  if (!state.profile.resumes?.length) {
    list.innerHTML = `<p style="font-size:12px;color:var(--text-3)">No resumes uploaded yet.</p>`;
    return;
  }
  list.innerHTML = state.profile.resumes.map((r, i) => `
    <div class="resume-item">
      <span style="font-size:18px">📄</span>
      <span class="resume-item-name">${escapeHtml(r.name)}</span>
      <span class="resume-item-date">${escapeHtml(timeAgo(r.uploadedAt))}</span>
      <button onclick="removeResume(${i})" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:14px">✕</button>
    </div>`).join("");
}

window.removeResume = function(i) {
  state.profile.resumes.splice(i, 1);
  renderResumeList();
};

function handleResumeUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!state.profile.resumes) state.profile.resumes = [];
  state.profile.resumes.unshift({ name: file.name, uploadedAt: new Date().toISOString() });
  renderResumeList();
  toast(`Resume "${file.name}" added`, "success");
  e.target.value = "";
}

/* ── Refresh bar ────────────────────────────────────────── */
function updateRefreshBar() {
  const bar = document.getElementById("refresh-bar");
  if (!state.lastUpdated) { bar.style.display = "none"; return; }
  const dt = new Date(state.lastUpdated);
  bar.style.display = "";
  bar.innerHTML = `
    <span>🔄</span>
    <span>Last refreshed: <strong>${dt.toLocaleString()}</strong> — Auto-refresh runs daily at 6 AM UTC</span>
    <span style="margin-left:auto;opacity:.7">${state.allJobs.length.toLocaleString()} total jobs</span>`;
}

/* ── Counts ─────────────────────────────────────────────── */
function updateCounts() {
  document.getElementById("count-all").textContent      = state.filtered.length.toLocaleString();
  document.getElementById("count-bookmarks").textContent = state.bookmarks.size;
  document.getElementById("count-tracker").textContent   = Object.keys(state.tracker).length;
  document.getElementById("result-count").innerHTML      =
    `Showing <strong>${state.filtered.length.toLocaleString()}</strong> of ${state.allJobs.length.toLocaleString()} jobs`;
  if (state.newJobCount > 0) {
    document.getElementById("new-badge").textContent = state.newJobCount;
    document.getElementById("new-badge").style.display = "";
  }
}

/* ── Country options ────────────────────────────────────── */
function populateCountries() {
  const countries = [...new Set(state.allJobs.map(j => j.country).filter(Boolean))].sort();
  const sel = document.getElementById("filter-country");
  sel.innerHTML = `<option value="all">All Countries</option>` +
    countries.map(c => `<option value="${c}">${c}</option>`).join("");
}

/* ── Tabs ───────────────────────────────────────────────── */
function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  if (tab === "tracker") {
    renderTracker();
  } else {
    applyFilters();
  }
}

/* ── Boot ───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  loadPersisted();

  // Search
  const searchInput = document.getElementById("search-input");
  let searchTimer;
  searchInput.addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      applyFilters();
    }, 300);
  });

  // Filter chips
  document.querySelectorAll(".chip[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.group;
      const val   = chip.dataset.filter;
      document.querySelectorAll(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      if (group === "date")     state.filters.dateRange  = val;
      if (group === "worktype") state.filters.workType   = val;
      if (group === "emptype")  state.filters.employment = val;
      applyFilters();
    });
  });

  // Visa checkbox
  document.getElementById("filter-visa").addEventListener("change", e => {
    state.filters.visa = e.target.checked;
    applyFilters();
  });

  // Country select
  document.getElementById("filter-country").addEventListener("change", e => {
    state.filters.country = e.target.value;
    applyFilters();
  });

  // Sort
  document.getElementById("sort-select").addEventListener("change", e => {
    state.filters.sort = e.target.value;
    applyFilters();
  });

  // Nav tabs
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.addEventListener("click", () => switchTab(t.dataset.tab));
  });

  // Overlay close
  document.getElementById("detail-overlay").addEventListener("click", closeDetail);

  // Profile
  document.getElementById("btn-profile").addEventListener("click", openProfile);
  document.getElementById("profile-save").addEventListener("click", saveProfile);
  document.getElementById("profile-cancel").addEventListener("click", closeProfile);
  document.getElementById("profile-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("profile-overlay")) closeProfile();
  });

  // Resume upload
  document.getElementById("resume-upload-area").addEventListener("click", () =>
    document.getElementById("resume-file").click());
  document.getElementById("resume-file").addEventListener("change", handleResumeUpload);

  // Drag-drop resume
  const dropArea = document.getElementById("resume-upload-area");
  dropArea.addEventListener("dragover", e => { e.preventDefault(); dropArea.style.borderColor = "var(--accent)"; });
  dropArea.addEventListener("dragleave", ()=> dropArea.style.borderColor = "");
  dropArea.addEventListener("drop", e => {
    e.preventDefault();
    dropArea.style.borderColor = "";
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!state.profile.resumes) state.profile.resumes = [];
      state.profile.resumes.unshift({ name: file.name, uploadedAt: new Date().toISOString() });
      renderResumeList();
      toast(`Resume "${file.name}" added`, "success");
    }
  });

  // Load data
  loadJobs().then(() => populateCountries());
});
