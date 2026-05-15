const ARDB = {
  enabled: true,
  apiBase: "https://ardb.app/api",
  staticBase: "https://ardb.app/static"
};

const DATA_ROOT = (() => {
  const depth = location.pathname.split("/").filter(Boolean).length;
  if (depth === 0) return "";
  return "../".repeat(depth);
})();

const byId = (id) => document.getElementById(id);

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  const el = byId(id);
  if (el) el.innerHTML = value;
}

async function loadJson(path) {
  const res = await fetch(`${DATA_ROOT}${path}`);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${url}`);
  return res.json();
}

async function fetchArdbQuest(quest) {
  if (!ARDB.enabled || !quest.ardbId) return null;

  try {
    return await fetchJson(`${ARDB.apiBase}/quests/${quest.ardbId}`);
  } catch {
    return null;
  }
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

function normalizeImagePath(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${ARDB.staticBase}${path.startsWith("/") ? "" : "/"}${path}`;
}

function findImage(obj) {
  if (!obj || typeof obj !== "object") return "";

  return obj.image
    || obj.icon
    || obj.iconPath
    || obj.imagePath
    || obj.img
    || obj.thumbnail
    || "";
}

function normalizeArdbItem(raw) {
  if (!raw || typeof raw !== "object") return null;

  const item = raw.item && typeof raw.item === "object" ? raw.item : raw;

  return {
    name: item.name || raw.name || raw.title || "Unknown item",
    amount: raw.amount || raw.quantity || raw.count || raw.qty || item.amount || item.quantity || "",
    image: normalizeImagePath(findImage(item) || findImage(raw)),
    id: item.id || raw.id || raw.itemId || ""
  };
}

function pickArdbArray(obj, names) {
  if (!obj || typeof obj !== "object") return [];

  for (const name of names) {
    if (Array.isArray(obj[name])) return obj[name];
  }

  return [];
}

function ardbRewards(ardbQuest) {
  return pickArdbArray(ardbQuest, [
    "rewards",
    "rewardItems",
    "questRewards",
    "reward_items"
  ]).map(normalizeArdbItem).filter(Boolean);
}

function ardbGrantedItems(ardbQuest) {
  return pickArdbArray(ardbQuest, [
    "granted",
    "grantedItems",
    "providedItems",
    "granted_items",
    "requiredItems"
  ]).map(normalizeArdbItem).filter(Boolean);
}

function ardbObjectives(ardbQuest) {
  const objectives = pickArdbArray(ardbQuest, [
    "objectives",
    "tasks",
    "requirements",
    "steps"
  ]);

  return objectives.map((o) => {
    if (typeof o === "string") return { text: o, done: false };

    return {
      text: o.text || o.name || o.description || o.objective || "Unknown objective",
      done: false,
      progress: o.progress || null
    };
  });
}

function mergeArdbQuest(localQuest, ardbQuest) {
  if (!ardbQuest) return localQuest;

  const objectives = ardbObjectives(ardbQuest);
  const rewards = ardbRewards(ardbQuest);
  const grantedItems = ardbGrantedItems(ardbQuest);

  return {
    ...localQuest,
    title: ardbQuest.title || ardbQuest.name || localQuest.title,
    area: Array.isArray(ardbQuest.maps)
      ? ardbQuest.maps.join(", ")
      : localQuest.area,
    description: ardbQuest.description || localQuest.description,
    objectives: objectives.length ? objectives.map((obj, index) => ({
      ...obj,
      done: localQuest.objectives?.[index]?.done || false,
      progress: localQuest.objectives?.[index]?.progress || obj.progress || null
    })) : localQuest.objectives,
    rewards: rewards.length ? rewards : localQuest.rewards,
    grantedItems: grantedItems.length ? grantedItems : localQuest.grantedItems,
    ardbUrl: `https://ardb.app/db/quests/${localQuest.ardbId}`
  };
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
  const icon = item.icon || item.image || "";

  return `
    <div class="item-card">
      ${icon ? `<img class="item-icon" src="${icon}" alt="">` : ""}
      <div>
        <strong>${item.name}</strong>
        ${item.amount ? `<small>x${item.amount}</small>` : ""}
        ${item.type ? `<small>${item.type}</small>` : ""}
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

async function loadQuestsWithArdb() {
  const quests = await loadJson("data/quests.json");

  if (!ARDB.enabled) return quests;

  const enriched = await Promise.all(
    quests.map(async (quest) => {
      const ardbQuest = await fetchArdbQuest(quest);
      return mergeArdbQuest(quest, ardbQuest);
    })
  );

  return enriched;
}

async function homePage() {
  const quests = await loadQuestsWithArdb();
  const achievements = await loadJson("data/achievements.json");
  const logbook = await loadJson("data/logbook.json");

  const active = quests.filter(q => q.status === "active").length;
  const completed = quests.filter(q => q.status === "completed").length;

  setText("stat-active", active);
  setText("stat-completed", completed);
  setText("stat-achievements", `${achievements.summary.percent}%`);

  setHtml("home-quests", quests.slice(0, 6).map(q => miniQuest(q)).join(""));
  setHtml("home-resources", (logbook.resources || []).slice(0, 6).map(resourceRow).join(""));
}

async function questsPage() {
  const quests = await loadQuestsWithArdb();

  const grid = byId("quest-grid");
  const search = byId("quest-search");
  const areaFilter = byId("quest-filter");
  const statusFilter = byId("status-filter");

  if (!grid || !search || !areaFilter || !statusFilter) return;

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
  const quests = await loadQuestsWithArdb();
  const slug = slugFromPath();
  const q = quests.find(item => item.slug === slug);

  if (!q) {
    setHtml("quest-detail", `
      <div class="quest-main">
        <h1>Quest not found</h1>
        <p>This quest folder does not match a slug in data/quests.json.</p>
      </div>
    `);
    return;
  }

  document.title = `${q.title} | ARC Raiders`;

  setHtml("quest-detail", `
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
      ${q.ardbUrl ? `<p class="data-credit"><a href="${q.ardbUrl}" target="_blank" rel="noreferrer">Quest data provided by ardb.app</a></p>` : ""}
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
  `);
}

async function logbookPage() {
  const logbookName = document.body.dataset.logbook === "second"
    ? "data/logbook-second.json"
    : "data/logbook.json";

  const quests = await loadQuestsWithArdb();
  const logbook = await loadJson(logbookName);

  const active = quests.filter(q => q.status === "active");

  setText("logbook-quest-count", `${active.length} active`);
  setHtml("logbook-quests", active.map(q => miniQuest(q, true)).join(""));

  setHtml("logbook-resources", `
    ${(logbook.resources || []).map(resourceRow).join("")}
    ${(logbook.stations || []).map(stationCard).join("")}
  `);
}

async function achievementsPage() {
  const data = await loadJson("data/achievements.json");

  const list = byId("achievement-list");
  const search = byId("achievement-search");
  const filter = byId("achievement-filter");

  if (!list || !search || !filter) return;

  setText("ach-summary-title", `${data.summary.earned} / ${data.summary.total}`);
  setText("ach-summary-text", `${data.summary.percent}% achievements earned`);

  const progress = byId("ach-progress");
  if (progress) progress.style.width = `${data.summary.percent}%`;

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