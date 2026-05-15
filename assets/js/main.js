const byId = (id) => document.getElementById(id);

const DATA_ROOT = (() => {
  const depth = location.pathname.split("/").filter(Boolean).length;
  if (depth === 0) return "";
  return "../".repeat(depth);
})();

function accountId() {
  return document.body.dataset.account || "main";
}

function accountBase(account = accountId()) {
  if (account === "main") return "";
  return `/${account}`;
}

function dataFile(name, account = accountId()) {
  return `data/${account}/${name}.json`;
}

async function loadJson(path, fallback = null) {
  try {
    const res = await fetch(`${DATA_ROOT}${path}`);
    if (!res.ok) throw new Error(`Could not load ${path}`);
    return await res.json();
  } catch (err) {
    console.warn(err);
    return fallback;
  }
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  const el = byId(id);
  if (el) el.innerHTML = value;
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

function statusBadge(status) {
  const s = status || "active";
  return `<span class="badge ${s}">${s}</span>`;
}

function questUrl(q) {
  return `${accountBase()}/quests/?quest=${encodeURIComponent(q.slug)}`;
}

function projectUrl(project, stage = 1) {
  return `${accountBase()}/projects/?project=${encodeURIComponent(project.slug)}&stage=${stage}`;
}

function itemCard(item) {
  const icon = item.icon || item.image || "";

  return `
    <div class="item-card">
      ${icon ? `<img class="item-icon" src="${icon}" alt="">` : ""}
      <div>
        <strong>${item.name || "?"}</strong>
        ${item.amount ? `<small>x${item.amount}</small>` : ""}
        ${item.type ? `<small>${item.type}</small>` : ""}
      </div>
    </div>
  `;
}

function resourceRow(item) {
  const current = item.current === "?" ? "?" : Number(item.current || 0);
  const needed = item.needed === "?" ? "?" : Number(item.needed || 0);

  let cls = "warn";

  if (current === "?" || needed === "?") {
    cls = "warn";
  } else if (current >= needed) {
    cls = "good";
  } else if (current <= 0) {
    cls = "bad";
  }

  return `
    <div class="resource-item">
      <div class="resource-row">
        <strong>${item.name || "?"}</strong>
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

function normaliseAccountQuestFile(data) {
  if (Array.isArray(data)) {
    return {
      quests: data.map((quest) => ({
        id: quest.id || quest.slug,
        status: quest.status || "active",
        objectives: (quest.objectives || []).map((obj) => {
          if (typeof obj === "boolean") return obj;
          return {
            done: Boolean(obj.done),
            progress: obj.progress || null
          };
        }),
        notes: quest.notes || ""
      })).filter((quest) => quest.id)
    };
  }

  if (data && Array.isArray(data.quests)) return data;

  return { quests: [] };
}

function mergeObjective(coreObjective, progressObjective) {
  const merged = {
    ...coreObjective,
    done: false
  };

  if (typeof progressObjective === "boolean") {
    merged.done = progressObjective;
    return merged;
  }

  if (progressObjective && typeof progressObjective === "object") {
    merged.done = Boolean(progressObjective.done);

    if (progressObjective.progress) {
      merged.progress = progressObjective.progress;
    }

    return merged;
  }

  return merged;
}

function mergeQuest(coreQuest, progressQuest) {
  if (!progressQuest) return null;

  const merged = {
    ...coreQuest,
    status: progressQuest.status || "active",
    notes: progressQuest.notes || "",
    objectives: (coreQuest.objectives || []).map((objective, index) => {
      return mergeObjective(objective, progressQuest.objectives?.[index]);
    })
  };

  return merged;
}

async function loadAccountQuests() {
  const coreQuests = await loadJson("data/quests_core.json", []);
  const accountQuestFile = normaliseAccountQuestFile(
    await loadJson(dataFile("quests"), { quests: [] })
  );

  const coreById = new Map();

  for (const quest of coreQuests) {
    coreById.set(quest.id, quest);
    if (quest.slug) coreById.set(quest.slug, quest);
  }

  return accountQuestFile.quests
    .map((progressQuest) => {
      const coreQuest = coreById.get(progressQuest.id);
      return coreQuest ? mergeQuest(coreQuest, progressQuest) : null;
    })
    .filter(Boolean);
}

function questCard(q) {
  const done = doneCount(q);
  const total = (q.objectives || []).length;

  return `
    <a class="quest-card" href="${questUrl(q)}">
      <div class="quest-card-body">
        <div class="meta">
          <span class="badge">${q.area || "Unknown"}</span>
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
        <span>${q.area || "Unknown"} · ${done}/${total} objectives</span>
      </a>
    `;
  }

  return `
    <a class="mini-quest" href="${questUrl(q)}">
      <div class="mini-head">
        <strong>${q.title}</strong>
        <span>${q.area || "Unknown"} · ${done}/${total}</span>
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

function renderQuestDetail(q) {
  return `
    <a class="back-link" href="${accountBase()}/quests/">← Back to quests</a>

    <section class="quest-detail">
      <div class="quest-main">
        <div class="meta">
          <span class="badge">${q.area || "Unknown"}</span>
          ${statusBadge(q.status)}
        </div>

        <p class="eyebrow">${q.trader || q.area || "Quest"}</p>
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
        ${q.sourceUrl ? `<p class="data-credit"><a href="${q.sourceUrl}" target="_blank" rel="noreferrer">ardb.app</a></p>` : ""}
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
    </section>
  `;
}

function projectCard(project) {
  return `
    <a class="project-card ${project.locked ? "locked" : ""}" href="${projectUrl(project)}">
      <div>
        <div class="meta">
          <span class="badge">${project.locked ? "locked" : "active"}</span>
          <span class="badge">${(project.stages || []).length} stages</span>
        </div>
        <h3>${project.title}</h3>
        <p>${project.description || ""}</p>
      </div>
    </a>
  `;
}

function projectStageTabs(project, activeStage) {
  return `
    <div class="stage-tabs">
      ${(project.stages || []).map((stage, index) => {
        const stageNumber = index + 1;
        return `
          <a class="${stageNumber === activeStage ? "active" : ""}" href="${projectUrl(project, stageNumber)}">
            ${stage.locked ? "🔒" : stageNumber}
          </a>
        `;
      }).join("")}
    </div>
  `;
}

function projectRequirementRow(req) {
  const current = req.current ?? "?";
  const needed = req.needed ?? "?";

  let cls = "warn";
  if (current !== "?" && needed !== "?" && Number(current) >= Number(needed)) cls = "good";
  if (current !== "?" && Number(current) === 0) cls = "bad";

  return `
    <div class="project-requirement">
      <div>
        <strong>${req.name || "?"}</strong>
        ${req.note ? `<small>${req.note}</small>` : ""}
      </div>
      <span class="count ${cls}">${current}/${needed}</span>
    </div>
  `;
}

function renderProjectDetail(project, activeStage) {
  const stage = project.stages?.[activeStage - 1] || project.stages?.[0];

  return `
    <a class="back-link" href="${accountBase()}/projects/">← Back to projects</a>

    <section class="project-detail">
      <div class="project-main">
        <div class="meta">
          <span class="badge">${project.locked ? "locked" : "active"}</span>
          <span class="badge">${stage?.title || "Stage"}</span>
        </div>

        <p class="eyebrow">Project</p>
        <h1>${project.title}</h1>
        <p class="lead">${project.description || ""}</p>

        ${projectStageTabs(project, activeStage)}

        <h2>${stage?.title || "Stage"}</h2>

        <div class="project-requirements">
          ${(stage?.requirements || []).length
            ? stage.requirements.map(projectRequirementRow).join("")
            : `<div class="project-requirement"><strong>?</strong><span class="count warn">?</span></div>`}
        </div>
      </div>

      <aside class="quest-side">
        <h2>Rewards</h2>
        <div class="item-grid">
          ${(stage?.rewards || []).length
            ? stage.rewards.map(itemCard).join("")
            : `<div class="item-card"><small>?</small></div>`}
        </div>
      </aside>
    </section>
  `;
}

async function homePage() {
  const account = accountId();
  const accounts = await loadJson("data/accounts.json", {});
  const profile = accounts[account] || accounts.main || {};

  const quests = await loadAccountQuests();
  const achievements = await loadJson(dataFile("achievements"), {
    summary: { earned: 0, total: 0, percent: 0 },
    earnedAchievements: [],
    lockedAchievements: []
  });
  const logbook = await loadJson(dataFile("logbook"), { resources: [], stations: [] });
  const projects = await loadJson(dataFile("projects"), []);

  document.title = `${profile.title || "ARC Raiders"} | Sic4rioDragon`;

  setText("home-eyebrow", profile.subtitle || profile.label || "ARC Raiders");
  setText("home-title", profile.title || "ARC Raiders Tracker");

  const active = quests.filter(q => q.status === "active").length;
  const completed = quests.filter(q => q.status === "completed").length;

  setText("stat-active", active);
  setText("stat-completed", completed);
  setText("stat-achievements", `${achievements.summary.percent || 0}%`);
  setText("stat-projects", projects.length);

  setHtml("home-quests", quests.slice(0, 6).map(q => miniQuest(q)).join("") || `<p>No quests listed.</p>`);
  setHtml("home-resources", (logbook.resources || []).slice(0, 6).map(resourceRow).join("") || `<p>No tracked resources listed.</p>`);
  setHtml("home-projects", projects.slice(0, 3).map(projectCard).join("") || `<p>No projects listed.</p>`);
}

async function questsPage() {
  const quests = await loadAccountQuests();
  const selectedSlug = new URLSearchParams(location.search).get("quest");

  if (selectedSlug) {
    const q = quests.find(item => item.slug === selectedSlug || item.id === selectedSlug);
    setHtml("quest-detail", q ? renderQuestDetail(q) : `<p>Quest not found for this account.</p>`);
    const list = byId("quest-list-wrap");
    if (list) list.hidden = true;
    return;
  }

  const grid = byId("quest-grid");
  const search = byId("quest-search");
  const areaFilter = byId("quest-filter");
  const statusFilter = byId("status-filter");

  if (!grid || !search || !areaFilter || !statusFilter) return;

  const areas = [...new Set(quests.map(q => q.area || "Unknown"))].sort();
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
        && (area === "all" || (q.area || "Unknown") === area)
        && (status === "all" || q.status === status);
    });

    grid.innerHTML = filtered.map(questCard).join("") || `<p>No quests found.</p>`;
  }

  search.addEventListener("input", render);
  areaFilter.addEventListener("change", render);
  statusFilter.addEventListener("change", render);

  render();
}

async function logbookPage() {
  const quests = await loadAccountQuests();
  const logbook = await loadJson(dataFile("logbook"), { resources: [], stations: [] });

  const active = quests.filter(q => q.status === "active");

  setText("logbook-quest-count", `${active.length} active`);
  setHtml("logbook-quests", active.map(q => miniQuest(q, true)).join("") || `<p>No active quests listed.</p>`);

  const resourceHtml = [
    ...(logbook.resources || []).map(resourceRow),
    ...(logbook.stations || []).map(stationCard)
  ].join("");

  setHtml("logbook-resources", resourceHtml || `<p>No tracked resources listed.</p>`);
}

async function projectsPage() {
  const projects = await loadJson(dataFile("projects"), []);
  const params = new URLSearchParams(location.search);
  const selectedSlug = params.get("project");
  const activeStage = Number(params.get("stage") || 1);

  if (selectedSlug) {
    const project = projects.find(item => item.slug === selectedSlug);
    setHtml("project-detail", project ? renderProjectDetail(project, activeStage) : `<p>Project not found.</p>`);
    const list = byId("project-list-wrap");
    if (list) list.hidden = true;
    return;
  }

  setHtml("project-grid", projects.map(projectCard).join("") || `<p>No projects listed.</p>`);
}

async function achievementsPage() {
  const data = await loadJson(dataFile("achievements"), {
    summary: { earned: 0, total: 0, percent: 0 },
    earnedAchievements: [],
    lockedAchievements: []
  });

  const list = byId("achievement-list");
  const search = byId("achievement-search");
  const filter = byId("achievement-filter");

  if (!list || !search || !filter) return;

  setText("ach-summary-title", `${data.summary.earned} / ${data.summary.total}`);
  setText("ach-summary-text", `${data.summary.percent}%`);

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
    }).join("") || `<p>No achievements found.</p>`;
  }

  search.addEventListener("input", render);
  filter.addEventListener("change", render);

  render();
}

const page = document.body.dataset.page;

if (page === "home") homePage();
if (page === "quests") questsPage();
if (page === "logbook") logbookPage();
if (page === "projects") projectsPage();
if (page === "achievements") achievementsPage();