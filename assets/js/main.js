const DATA_ROOT = (() => {
  const depth = location.pathname.split("/").filter(Boolean).length;
  if (depth === 0) return "";
  return "../".repeat(depth);
})();

const byId = (id) => document.getElementById(id);

async function loadJson(path) {
  const res = await fetch(`${DATA_ROOT}${path}`);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

function slugFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function questUrl(q) {
  return `/quests/${q.slug}/`;
}

function statusBadge(status) {
  const s = status || "active";
  return `<span class="badge ${s}">${s}</span>`;
}

function objectiveText(o) {
  return typeof o === "string" ? o : o.text;
}

function progressText(o) {
  if (!o || !o.progress) return "";
  return `<br><small>${o.progress.current}/${o.progress.total}</small>`;
}

function doneCount(q) {
  return (q.objectives || []).filter(o => o.done).length;
}

function questCard(q) {
  const done = doneCount(q);
  const total = (q.objectives || []).length;

  return `
    <a class="quest-card" href="${questUrl(q)}">
      <div class="quest-card-body">
        <div class="meta">
          <span class="badge">${q.area}</span>
          ${statusBadge(q.status)}
          <span class="badge">${done}/${total}</span>
        </div>

        <h3>${q.title}</h3>
        <p>${q.description || ""}</p>

        <ul class="objective-list">
          ${(q.objectives || []).slice(0, 4).map(o => `
            <li>
              <span class="box ${o.done ? "checked" : ""}"></span>
              <span>${objectiveText(o)}${progressText(o)}</span>
            </li>
          `).join("")}
        </ul>
      </div>
    </a>
  `;
}

function miniQuest(q, expanded = false) {
  const done = doneCount(q);
  const total = (q.objectives || []).length;

  if (!expanded) {
    return `
      <a class="mini-quest" href="${questUrl(q)}">
        <strong>${q.title}</strong>
        <span>${q.area} · ${done}/${total} objectives</span>
      </a>
    `;
  }

  return `
    <a class="mini-quest" href="${questUrl(q)}">
      <div class="mini-head">
        <strong>${q.title}</strong>
        <span>${q.area} · ${done}/${total}</span>
      </div>

      <div class="mini-body">
        <ul class="objective-list">
          ${(q.objectives || []).map(o => `
            <li>
              <span class="box ${o.done ? "checked" : ""}"></span>
              <span>${objectiveText(o)}${progressText(o)}</span>
            </li>
          `).join("")}
        </ul>
      </div>
    </a>
  `;
}

function itemCard(item) {
  return `
    <div class="item-card">
      <div>
        <strong>${item.name}</strong>
        ${item.amount ? `<small>x${item.amount}</small>` : ""}
      </div>
    </div>
  `;
}

function resourceRow(item) {
  const current = Number(item.current || 0);
  const needed = Number(item.needed || 0);

  let cls = "warn";
  if (current >= needed) cls = "good";
  if (current <= 0) cls = "bad";

  return `
    <div class="resource-item">
      <div class="resource-row">
        <strong>${item.name}</strong>
        <span class="count ${cls}">${current}/${needed}</span>
      </div>
    </div>
  `;
}

function stationCard(station) {
  return `
    <div class="station-card">
      <div class="section-title">
        <h2>${station.name}</h2>
        <span>${station.status || "tracked"}</span>
      </div>

      <div class="resource-list">
        ${(station.resources || []).map(resourceRow).join("")}
      </div>
    </div>
  `;
}

async function homePage() {
  const quests = await loadJson("data/quests.json");
  const achievements = await loadJson("data/achievements.json");
  const logbook = await loadJson("data/logbook.json");

  const active = quests.filter(q => q.status === "active").length;
  const completed = quests.filter(q => q.status === "completed").length;

  byId("stat-active").textContent = active;
  byId("stat-completed").textContent = completed;
  byId("stat-achievements").textContent = `${achievements.summary.percent}%`;

  byId("home-quests").innerHTML = quests.slice(0, 6).map(q => miniQuest(q)).join("");
  byId("home-resources").innerHTML = (logbook.resources || []).slice(0, 6).map(resourceRow).join("");
}

async function questsPage() {
  const quests = await loadJson("data/quests.json");

  const grid = byId("quest-grid");
  const search = byId("quest-search");
  const areaFilter = byId("quest-filter");
  const statusFilter = byId("status-filter");

  const areas = [...new Set(quests.map(q => q.area))].sort();
  areaFilter.innerHTML += areas.map(a => `<option value="${a}">${a}</option>`).join("");

  function render() {
    const term = search.value.trim().toLowerCase();
    const area = areaFilter.value;
    const status = statusFilter.value;

    const filtered = quests.filter(q => {
      const haystack = [
        q.title,
        q.area,
        q.description,
        ...(q.objectives || []).map(objectiveText)
      ].join(" ").toLowerCase();

      return (!term || haystack.includes(term))
        && (area === "all" || q.area === area)
        && (status === "all" || q.status === status);
    });

    grid.innerHTML = filtered.map(questCard).join("") || `<p>No quests found.</p>`;
  }

  search.addEventListener("input", render);
  areaFilter.addEventListener("change", render);
  statusFilter.addEventListener("change", render);

  render();
}

async function questDetailPage() {
  const quests = await loadJson("data/quests.json");
  const slug = slugFromPath();
  const q = quests.find(item => item.slug === slug);

  if (!q) {
    byId("quest-detail").innerHTML = `
      <div class="quest-main">
        <h1>Quest not found</h1>
        <p>This quest folder does not match a slug in data/quests.json.</p>
      </div>
    `;
    return;
  }

  document.title = `${q.title} | ARC Raiders`;

  byId("quest-detail").innerHTML = `
    <div class="quest-main">
      <div class="meta">
        <span class="badge">${q.area}</span>
        ${statusBadge(q.status)}
      </div>

      <p class="eyebrow">${q.area}</p>
      <h1>${q.title}</h1>
      <p class="lead">${q.description || ""}</p>

      <h2>Objectives</h2>
      <ul class="objective-list large">
        ${(q.objectives || []).map(o => `
          <li>
            <span class="box ${o.done ? "checked" : ""}"></span>
            <span>${objectiveText(o)}${progressText(o)}</span>
          </li>
        `).join("")}
      </ul>

      ${q.notes ? `<h2 style="margin-top:24px">Notes</h2><p>${q.notes}</p>` : ""}
    </div>

    <aside class="quest-side">
      <h2>Granted items</h2>
      <div class="item-grid">
        ${(q.grantedItems || []).length
          ? q.grantedItems.map(itemCard).join("")
          : `<div class="item-card"><small>none listed</small></div>`}
      </div>

      <h2 style="margin-top:24px">Rewards</h2>
      <div class="item-grid">
        ${(q.rewards || []).length
          ? q.rewards.map(itemCard).join("")
          : `<div class="item-card"><small>none listed</small></div>`}
      </div>
    </aside>
  `;
}

async function logbookPage() {
  const quests = await loadJson("data/quests.json");
  const logbook = await loadJson("data/logbook.json");

  const active = quests.filter(q => q.status === "active");

  byId("logbook-quest-count").textContent = `${active.length} active`;
  byId("logbook-quests").innerHTML = active.map(q => miniQuest(q, true)).join("");

  byId("logbook-resources").innerHTML = `
    ${(logbook.resources || []).map(resourceRow).join("")}
    ${(logbook.stations || []).map(stationCard).join("")}
  `;
}

async function achievementsPage() {
  const data = await loadJson("data/achievements.json");

  const list = byId("achievement-list");
  const search = byId("achievement-search");
  const filter = byId("achievement-filter");

  byId("ach-summary-title").textContent = `${data.summary.earned} / ${data.summary.total}`;
  byId("ach-summary-text").textContent = `${data.summary.percent}% achievements earned`;
  byId("ach-progress").style.width = `${data.summary.percent}%`;

  const achievements = [
    ...(data.earnedAchievements || []),
    ...(data.lockedAchievements || [])
  ];

  function render() {
    const term = search.value.trim().toLowerCase();
    const state = filter.value;

    const filtered = achievements.filter(a => {
      const haystack = `${a.title} ${a.description}`.toLowerCase();

      return (!term || haystack.includes(term))
        && (state === "all" || a.status === state);
    });

    list.innerHTML = filtered.map(a => {
      const progress = a.progress ? `${a.progress.current} / ${a.progress.total}` : "";

      return `
        <article class="achievement-card ${a.status}">
          <div class="achievement-icon">${a.status === "earned" ? "✓" : "!"}</div>

          <div>
            <div class="meta">
              <span class="badge ${a.status}">${a.status}</span>
              ${a.hidden ? `<span class="badge">hidden shown</span>` : ""}
            </div>

            <h3>${a.title}</h3>
            <p>${a.description}</p>
            <small>${a.rarity || ""}${a.unlocked ? ` · ${a.unlocked}` : ""}</small>
          </div>

          <div class="achievement-progress">${progress}</div>
        </article>
      `;
    }).join("");
  }

  search.addEventListener("input", render);
  filter.addEventListener("change", render);

  render();
}

const page = document.body.dataset.page;

if (page === "home") homePage();
if (page === "quests") questsPage();
if (page === "quest-detail") questDetailPage();
if (page === "logbook") logbookPage();
if (page === "achievements") achievementsPage();