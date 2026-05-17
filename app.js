const API_BASE = window.APP_CONFIG.API_BASE.replace(/\/+$/, "");
const feedEl = document.getElementById("feed");
const chartEl = document.getElementById("chart");
const headlineEl = document.getElementById("headline");
const sublineEl = document.getElementById("subline");
const totalCommitsEl = document.getElementById("stat-total-commits");
const totalReposEl = document.getElementById("stat-total-repos");
const totalAuthorsEl = document.getElementById("stat-total-authors");
const refreshBtn = document.getElementById("refresh-btn");
const clearFiltersBtn = document.getElementById("clear-filters-btn");
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pageIndicatorEl = document.getElementById("page-indicator");
const paginationSummaryEl = document.getElementById("pagination-summary");
const activeFiltersEl = document.getElementById("active-filters");
const commitsPanelEl = document.getElementById("commits-panel");
const panelFooterEl = document.getElementById("panel-footer");
const commitsTabBtn = document.getElementById("commits-tab-btn");
const branchesTabBtn = document.getElementById("branches-tab-btn");
const branchesPanelEl = document.getElementById("branches-panel");
const branchesTreeEl = document.getElementById("branches-tree");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminStatusEl = document.getElementById("admin-status");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const releasesTabBtn = document.getElementById("releases-tab-btn");
const releasesPanelEl = document.getElementById("releases-panel");
const releaseRepoSelectEl = document.getElementById("release-repo-select");
const releaseVersionInputEl = document.getElementById("release-version-input");
const createReleaseBtn = document.getElementById("create-release-btn");
const releaseVersionListEl = document.getElementById("release-version-list");
const releasePreviewEl = document.getElementById("release-preview");


const PAGE_SIZE = 20;

let commits = [];
let branches = [];
let releases = [];
let stats = null;
let pagination = null;
let source = null;

const state = {
  repo: "",
  branch: "",
  owner: "",
  contributor: "",
  page: 1,
  page_size: PAGE_SIZE,
};

function formatNumber(n) {
  return new Intl.NumberFormat().format(n || 0);
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);

  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getUploadKey() {
  return localStorage.getItem("upload_api_key") || "";
}

function isAdmin() {
  return Boolean(getUploadKey());
}

adminLoginBtn?.addEventListener("click", () => {
  const key = prompt("Enter upload API key");

  if (!key) return;

  localStorage.setItem("upload_api_key", key);
  renderAdminStatus();


});

adminLogoutBtn?.addEventListener("click", () => {
  logoutAdmin();
});

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCommitTags(commit) {
  const branch = String(commit.branch || "").toLowerCase();
  const message = String(commit.message || "").toLowerCase();

  // Merge tags override all others

  // Branch merged INTO main
  if (
    message.includes("-> main") ||
    message.startsWith("merge pull request")
  ) {
    return ["merge-to-main"];
  }

  // Branch created FROM main
  if (message.includes("main ->")) {
    return ["merge-from-main"];
  }

  const tags = new Set();

  if (branch.startsWith("cleanup/") || branch.startsWith("refinement")) tags.add("cleanup");
  if (branch.startsWith("feature/") || branch.startsWith("features/") || branch.startsWith("feat/")) {
    tags.add("feature");
  }
  if (branch.startsWith("bugfix/") || branch.startsWith("fix/")) tags.add("bugfix");

  if (/\bfix(ed|es|ing)?\b|\bbug\b|\bbugfix\b/.test(message)) tags.add("bugfix");
  if (/\bfeat\b|\bfeature(s)?\b|\badd(ed|s|ing)?\b/.test(message)) tags.add("feature");
  if (/\bcleanup\b|\bclean up\b|\bchange(s|d)?\b|\brefinement\b|\bupdat(e|ed|es|ing)?\b|\brefactor(ed|s|ing)?\b/.test(message)) tags.add("cleanup");

  if (tags.size === 0) {
    tags.add("feature");
  }

  return [...tags];
}

function renderTags(commit) {
  const tags = getCommitTags(commit);

  if (!tags.length) return "";

  return `
    <div class="commit-tags">
      ${tags
      .map(
        (tag) => `
            <span class="tag tag-${escapeHtml(tag)}">
              #${escapeHtml(tag)}
            </span>
          `
      )
      .join("")}
    </div>
  `;
}

function logoutAdmin() {
  localStorage.removeItem("upload_api_key");

  updateAdminUI();

  alert("Exited admin mode.");
} 

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  const merged = { ...state, ...params };

  Object.entries(merged).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });

  return search.toString();
}

function updateUrl() {
  const query = buildQuery();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  state.repo = params.get("repo") || "";
  state.branch = params.get("branch") || "";
  state.owner = params.get("owner") || "";
  state.contributor = params.get("contributor") || "";
  state.page = Math.max(1, Number(params.get("page") || 1));
  state.page_size = Math.max(1, Number(params.get("page_size") || PAGE_SIZE));
}

function commitMatchesState(commit) {
  const contributor =
    commit.contributor ||
    commit.sender_login ||
    commit.author_name ||
    commit.author_email ||
    "";

  if (state.repo && commit.repo_full_name !== state.repo) return false;
  if (state.branch && commit.branch !== state.branch) return false;
  if (state.owner && commit.repo_owner !== state.owner) return false;

  if (state.contributor) {
    const candidates = [
      commit.sender_login,
      commit.author_name,
      commit.author_email,
      contributor
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    if (!candidates.includes(state.contributor.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function renderHeadline() {
  const total = stats?.total_commits || 0;
  const daily = stats?.daily || [];
  const totalDays = daily.length || 0;
  const cpd = totalDays ? (total / totalDays).toFixed(2) : "0.00";

  headlineEl.textContent = `${formatNumber(total)} commits over ${formatNumber(totalDays)} days · ${cpd} cpd`;

  const activeFilters = [
    state.repo,
    state.branch,
    state.owner,
    state.contributor
  ].filter(Boolean).length;

  const filterText = activeFilters
    ? ` · ${activeFilters} filter${activeFilters === 1 ? "" : "s"} active`
    : "";

  sublineEl.textContent =
    `Tracking started ${stats?.tracking_started_at
      ? new Date(stats.tracking_started_at).toLocaleString()
      : "unknown"
    }${filterText}`;
}

function renderStats() {
  totalCommitsEl.textContent = formatNumber(stats?.total_commits || 0);
  totalReposEl.textContent = formatNumber(stats?.total_repos || 0);
  totalAuthorsEl.textContent = formatNumber(stats?.total_authors || 0);
  renderHeadline();
}

function renderChart() {
  chartEl.innerHTML = "";

  const daily = stats?.daily || [];
  const tail = daily.slice(-120);
  const max = Math.max(1, ...tail.map((d) => d.count));

  if (!tail.length) {
    chartEl.innerHTML = `<div class="empty">No commits match this filter set.</div>`;
    return;
  }

  for (const day of tail) {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(8, (day.count / max) * 100)}%`;

    bar.innerHTML = `
      <div class="bar-tooltip">
        <strong>${formatNumber(day.count)}</strong>
        <span>commit${day.count === 1 ? "" : "s"}</span>
        <small>${escapeHtml(day.day)}</small>
      </div>
    `;

    chartEl.appendChild(bar);
  }
}

function renderActiveFilters() {
  const filters = [];

  if (state.repo) filters.push({ label: "Repo", value: state.repo, key: "repo" });
  if (state.branch) filters.push({ label: "Branch", value: state.branch, key: "branch" });
  if (state.owner) filters.push({ label: "Owner", value: state.owner, key: "owner" });
  if (state.contributor) {
    filters.push({ label: "Contributor", value: state.contributor, key: "contributor" });
  }

  if (!filters.length) {
    activeFiltersEl.innerHTML =
      `<span class="muted-inline">Click a repo, branch, or contributor on a card to filter.</span>`;
    return;
  }

  activeFiltersEl.innerHTML = filters
    .map(
      (filter) => `
        <button
          type="button"
          class="filter-chip active"
          data-clear-filter="${escapeHtml(filter.key)}"
          title="Clear ${escapeHtml(filter.label)} filter"
        >
          ${escapeHtml(filter.label)}: ${escapeHtml(filter.value)} ×
        </button>
      `
    )
    .join("");
}

function commitCard(c) {
  const contributor = c.contributor || c.author_name || c.sender_login || "Unknown";
  const author = escapeHtml(contributor);
  const repo = escapeHtml(c.repo_full_name || "Unknown repo");
  const branch = escapeHtml(c.branch || "unknown-branch");
  const msg = escapeHtml(c.message || "");
  const avatar = escapeHtml(
    c.sender_avatar_url ||
    "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
  );

  return `
    <article class="commit-card" data-commit-sha="${escapeHtml(c.sha)}">
      <img class="avatar" src="${avatar}" alt="${author}" />
      <div>
        <div class="commit-top">
          <button
            type="button"
            class="inline-filter repo"
            data-filter-type="repo"
            data-filter-value="${repo}"
          >
            ${repo}
          </button>

          <button
            type="button"
            class="inline-filter branch"
            data-filter-type="branch"
            data-filter-value="${branch}"
          >
            ${branch}
          </button>

          <span class="meta">${timeAgo(c.timestamp)}</span>
        </div>

        <div class="message">${msg}</div>

        ${renderTags(c)}
        ${renderCommitVideo(c)}

        <div class="commit-bottom">
          <button
            type="button"
            class="inline-filter contributor"
            data-filter-type="contributor"
            data-filter-value="${author}"
          >
            ${author}
          </button>
        </div>
      </div>
    </article>
  `;
}

function getBranchType(branch) {
  const value = String(branch || "").toLowerCase();

  if (value === "main") return "main";
  if (value.startsWith("feature/") || value.startsWith("features/") || value.startsWith("feat/")) return "feature";
  if (value.startsWith("bugfix/") || value.startsWith("fix/")) return "bugfix";
  if (value.startsWith("cleanup/")) return "cleanup";
  if (value.startsWith("hotfix/")) return "hotfix";

  return "other";
}

function getBranchDisplayName(branch) {
  const parts = String(branch || "").split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : branch;
}

function buildBranchesByRepo() {
  const repos = new Map();

  for (const branchInfo of branches) {
    const repo = branchInfo.repo_full_name || "Unknown repo";
    const branch = branchInfo.branch || "unknown-branch";
    const type = getBranchType(branch);
    const key = `${repo}::${branch}`;

    if (!repos.has(repo)) {
      repos.set(repo, new Map());
    }

    const repoBranches = repos.get(repo);

    repoBranches.set(key, {
      repo,
      branch,
      type,
      displayName: getBranchDisplayName(branch),
      commitCount: 0,
      latestTimestamp: null,
      contributor: "Unknown",
      mergedToMain: false,
      mergedFromMain: false
    });
  }

  for (const commit of commits) {
    const repo = commit.repo_full_name || "Unknown repo";
    const branch = commit.branch || "unknown-branch";
    const key = `${repo}::${branch}`;

    if (!repos.has(repo)) continue;

    const repoBranches = repos.get(repo);

    if (!repoBranches.has(key)) continue;

    const item = repoBranches.get(key);

    item.commitCount += 1;

    if (
      !item.latestTimestamp ||
      new Date(commit.timestamp) > new Date(item.latestTimestamp)
    ) {
      item.latestTimestamp = commit.timestamp;
      item.contributor =
        commit.contributor ||
        commit.author_name ||
        commit.sender_login ||
        "Unknown";
    }

    const message = String(commit.message || "").toLowerCase();

    if (
      message.includes("-> main") ||
      message.startsWith("merge pull request")
    ) {
      item.mergedToMain = true;
    }

    if (message.includes("main ->")) {
      item.mergedFromMain = true;
    }
  }

  return repos;
}

function renderBranchesTree() {
  if (!branchesTreeEl) return;

  const repos = buildBranchesByRepo();

  if (!repos.size) {
    branchesTreeEl.innerHTML = `<div class="empty">No branches found yet.</div>`;
    return;
  }

  branchesTreeEl.innerHTML = [...repos.entries()]
    .map(([repoName, branchesMap]) => {
      const branches = [...branchesMap.values()].sort((a, b) => {
        if (a.type === "main") return -1;
        if (b.type === "main") return 1;
        return a.branch.localeCompare(b.branch);
      });

      const grouped = branches.reduce((acc, branch) => {
        if (!acc[branch.type]) acc[branch.type] = [];
        acc[branch.type].push(branch);
        return acc;
      }, {});

      const groups = ["main", "feature", "features", "bugfix", "cleanup", "hotfix", "other"]
        .filter((type) => grouped[type]?.length)
        .map((type) => {
          const items = grouped[type]
            .map((branch) => {
              const badges = [];

              if (branch.mergedToMain) badges.push(`<span class="branch-badge merged">merged to main</span>`);
              if (branch.mergedFromMain) badges.push(`<span class="branch-badge from-main">from main</span>`);

              return `
                <div class="branch-tree-row branch-type-${escapeHtml(branch.type)}">
                  <div class="branch-tree-line"></div>

                  <div class="branch-tree-content">
                    <div class="branch-tree-title">
                      <span class="branch-name">${escapeHtml(branch.branch)}</span>
                      ${badges.join("")}
                    </div>

                    <div class="branch-tree-meta">
                      ${formatNumber(branch.commitCount)} commit${branch.commitCount === 1 ? "" : "s"}
                      ${branch.latestTimestamp ? `· last active ${timeAgo(branch.latestTimestamp)}` : "· no recent commits"}
                      · ${escapeHtml(branch.contributor)}
                    </div>
                  </div>
                </div>
              `;
            })
            .join("");

          return `
            <div class="branch-group">
              <div class="branch-group-title">${escapeHtml(type)}</div>
              ${items}
            </div>
          `;
        })
        .join("");

      return `
        <div class="repo-tree">
          <div class="repo-tree-title">${escapeHtml(repoName)}</div>
          ${groups}
        </div>
      `;
    })
    .join("");
}

function getKnownReposFromData() {
  const repoSet = new Set();

  commits.forEach((commit) => {
    if (commit.repo_full_name) repoSet.add(commit.repo_full_name);
  });

  branches.forEach((branch) => {
    if (branch.repo_full_name) repoSet.add(branch.repo_full_name);
  });

  return [...repoSet].sort((a, b) => a.localeCompare(b));
}

function renderReleaseRepoOptions() {
  if (!releaseRepoSelectEl) return;

  const repos = getKnownReposFromData();

  releaseRepoSelectEl.innerHTML = repos
    .map((repo) => `<option value="${escapeHtml(repo)}">${escapeHtml(repo)}</option>`)
    .join("");
}

async function loadReleasesForSelectedRepo() {
  if (!releaseRepoSelectEl?.value) return;

  const repo = releaseRepoSelectEl.value;

  const res = await fetch(
    `${API_BASE}/api/releases?repo_full_name=${encodeURIComponent(repo)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to load releases");
  }

  const data = await res.json();
  releases = data.items || [];

  renderReleaseVersions();
}

function renderReleaseVersions() {
  if (!releaseVersionListEl) return;

  if (!releases.length) {
    releaseVersionListEl.innerHTML = `<div class="empty">No releases for this repo yet.</div>`;
    releasePreviewEl.textContent = "Create a version to generate patch notes.";
    return;
  }

  releaseVersionListEl.innerHTML = releases
    .map(
      (release) => `
      <div class="release-version-item">
        <button
          type="button"
          class="release-version-btn"
          data-release-id="${escapeHtml(release.id)}"
        >
          ${escapeHtml(release.version)}
        </button>

        ${isAdmin()
          ? `
              <button
                type="button"
                class="release-delete-btn"
                data-delete-release-id="${escapeHtml(release.id)}"
              >
                ×
              </button>
            `
          : ""
        }
      </div>
    `
    )
    .join("");
}

async function createRelease() {
  const repo = releaseRepoSelectEl?.value;
  const version = releaseVersionInputEl?.value.trim();

  if (!repo) {
    alert("Select a repo first.");
    return;
  }

  if (!version) {
    alert("Enter a version.");
    return;
  }

  const res = await fetch(`${API_BASE}/api/releases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": getUploadKey(),
    },
    body: JSON.stringify({
      repo_full_name: repo,
      version,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create release");
  }

  const release = await res.json();

  releaseVersionInputEl.value = "";
  await loadReleasesForSelectedRepo();

  releasePreviewEl.innerHTML = marked.parse(release.notes_markdown || "");
}

function renderFeed() {
  if (!commits.length) {
    feedEl.innerHTML = `<div class="empty">No commits match the current filters.</div>`;
    return;
  }

  feedEl.innerHTML = commits.map(commitCard).join("");
}

function renderAdminStatus() {
  if (!adminStatusEl) return;

  const active = isAdmin();

  adminStatusEl.textContent = active ? "Key Saved" : "Viewer mode";
  adminStatusEl.classList.toggle("active", active);

  adminLogoutBtn?.classList.toggle("hidden", !isAdmin());
  adminLoginBtn?.classList.toggle("hidden", isAdmin());
}

function renderCommitVideo(commit) {
  if (!commit.video?.url) return "";

  return `
    <div class="commit-video">
      <video controls preload="metadata">
        <source src="${escapeHtml(commit.video.url)}">
        Your browser does not support the video tag.
      </video>

      ${isAdmin()
      ? `
            <button
              type="button"
              class="remove-video-btn secondary-btn"
              data-remove-video-sha="${escapeHtml(commit.sha)}"
            >
              Remove video
            </button>
          `
      : ""
    }
    </div>
  `;
}

async function uploadVideo(file) {
  const key = getUploadKey();

  if (!key) {
    throw new Error("Not authorized");
  }

  const formData = new FormData();
  formData.append("video", file);

  const res = await fetch(`${API_BASE}/api/videos`, {
    method: "POST",
    headers: {
      "x-api-key": key
    },
    body: formData
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }

  return res.json();
}

async function attachVideoToCommit(sha, uploaded) {
  const res = await fetch(`${API_BASE}/api/commits/${encodeURIComponent(sha)}/video`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": getUploadKey(),
    },
    body: JSON.stringify({
      url: uploaded.url,
      filename: uploaded.filename,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to attach video to commit");
  }

  return res.json();
}

feedEl.addEventListener("dragover", (event) => {
  const card = event.target.closest(".commit-card");

  if (!card || !isAdmin()) return;

  event.preventDefault();

  card.classList.add("drag-over");
});

feedEl.addEventListener("dragleave", (event) => {
  const card = event.target.closest(".commit-card");

  if (!card) return;

  card.classList.remove("drag-over");
});

feedEl.addEventListener("drop", async (event) => {
  const card = event.target.closest(".commit-card");

  if (!card || !isAdmin()) return;

  event.preventDefault();

  card.classList.remove("drag-over");

  const file = event.dataTransfer.files[0];

  if (!file || !file.type.startsWith("video/")) {
    alert("Drop a video file.");
    return;
  }

  const uploaded = await uploadVideo(file);
  const sha = card.dataset.commitSha;

  await attachVideoToCommit(sha, uploaded);

  const commit = commits.find((c) => c.sha === sha);

  if (commit) {
    commit.video = {
      url: uploaded.url,
      filename: uploaded.filename,
    };
  }

  renderFeed();

  alert("Video uploaded and attached to commit.");
});

feedEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-video-sha]");

  if (!button) return;

  const sha = button.dataset.removeVideoSha;

  try {
    const res = await fetch(`${API_BASE}/api/commits/${encodeURIComponent(sha)}/video`, {
      method: "DELETE",
      headers: {
        "x-api-key": getUploadKey(),
      },
    });

    if (!res.ok) {
      throw new Error("Failed to remove video");
    }

    const commit = commits.find((c) => c.sha === sha);

    if (commit) {
      commit.video = null;
    }

    renderFeed();
  } catch (err) {
    console.error(err);
    alert("Failed to remove video.");
  }
});

function renderPagination() {
  const page = pagination?.page || 1;
  const totalPages = pagination?.total_pages || 1;
  const totalItems = pagination?.total_items || 0;

  pageIndicatorEl.textContent = `Page ${page} of ${totalPages}`;
  paginationSummaryEl.textContent = `${formatNumber(totalItems)} result${totalItems === 1 ? "" : "s"}`;

  prevPageBtn.disabled = !pagination?.has_prev;
  nextPageBtn.disabled = !pagination?.has_next;
}

async function loadData() {
  const query = buildQuery({ page_size: state.page_size });

  const bootstrapRes = await fetch(`${API_BASE}/api/bootstrap?${query}`, {
    cache: "no-store"
  });

  if (!bootstrapRes.ok) {
    throw new Error("Failed to load bootstrap data");
  }

  const data = await bootstrapRes.json();

  stats = data.stats;
  commits = data.items || [];
  pagination = data.pagination || null;

  try {
    const branchesRes = await fetch(`${API_BASE}/api/branches`, {
      cache: "no-store"
    });

    if (branchesRes.ok) {
      const branchData = await branchesRes.json();
      branches = branchData.items || [];
    } else {
      console.warn("Failed to load branches");
      branches = [];
    }
  } catch (err) {
    console.warn("Branches endpoint failed", err);
    branches = [];
  }

  renderStats();
  renderChart();
  renderActiveFilters();
  renderFeed();
  renderBranchesTree();
  renderReleaseRepoOptions();

  if (releaseRepoSelectEl?.value) {
    await loadReleasesForSelectedRepo();
  }
  renderPagination();
  updateUrl();
  setupStickyFooterVisibility();
}

function connectStream() {
  if (source) {
    source.close();
  }

  const query = buildQuery();
  source = new EventSource(`${API_BASE}/api/stream${query ? `?${query}` : ""}`);

  source.addEventListener("commit", (event) => {
    try {
      const commit = JSON.parse(event.data);
      addCommitLive(commit);
    } catch (err) {
      console.error("Bad stream event", err);
    }
  });

  source.onerror = () => {
    if (source) {
      source.close();
    }

    setTimeout(connectStream, 3000);
  };
}

async function setFilter(type, value) {
  if (!["repo", "branch", "owner", "contributor"].includes(type)) return;

  state[type] = value;
  state.page = 1;

  await loadData();
  connectStream();
}

async function clearFilter(type) {
  if (!["repo", "branch", "owner", "contributor"].includes(type)) return;

  state[type] = "";
  state.page = 1;

  await loadData();
  connectStream();
}

function addCommitLive(commit) {
  if (!commitMatchesState(commit)) return;
  if ((pagination?.page || 1) !== 1) return;

  const exists = commits.some((c) => c.sha === commit.sha);
  if (exists) return;

  commits.unshift(commit);
  commits = commits.slice(0, state.page_size);

  if (!stats) {
    stats = {
      tracking_started_at: new Date().toISOString(),
      total_commits: 0,
      total_repos: 0,
      total_authors: 0,
      daily: []
    };
  }

  stats.total_commits += 1;

  const day = new Date(commit.timestamp).toISOString().slice(0, 10);
  const existingDay = stats.daily.find((d) => d.day === day);

  if (existingDay) {
    existingDay.count += 1;
  } else {
    stats.daily.push({ day, count: 1 });
    stats.daily.sort((a, b) => a.day.localeCompare(b.day));
  }

  const repoSet = new Set(commits.map((c) => c.repo_full_name));
  stats.total_repos = Math.max(stats.total_repos, repoSet.size);

  const authorSet = new Set(
    commits.map((c) => c.contributor || c.author_name || c.sender_login || "Unknown")
  );
  stats.total_authors = Math.max(stats.total_authors, authorSet.size);

  if (pagination) {
    pagination.total_items += 1;
    pagination.total_pages = Math.max(
      1,
      Math.ceil(pagination.total_items / pagination.page_size)
    );
    pagination.has_next = pagination.page < pagination.total_pages;
  }

  renderStats();
  renderChart();
  renderActiveFilters();
  renderFeed();
  renderBranchesTree();
  renderPagination();
}

function setupStickyFooterVisibility() {
  if (!commitsPanelEl || !panelFooterEl) return;

  function updateStickyFooter() {
    const panelRect = commitsPanelEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const panelTopReached = panelRect.top <= 24;
    const panelStillVisible = panelRect.bottom >= 140;

    const shouldStick = panelTopReached && panelStillVisible;

    panelFooterEl.classList.toggle("is-sticky", shouldStick);
  }

  updateStickyFooter();

  window.removeEventListener("scroll", window.__commitTrackerStickyHandler);
  window.removeEventListener("resize", window.__commitTrackerStickyHandler);

  window.__commitTrackerStickyHandler = updateStickyFooter;

  window.addEventListener("scroll", window.__commitTrackerStickyHandler, { passive: true });
  window.addEventListener("resize", window.__commitTrackerStickyHandler);
}

feedEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-filter-type]");
  if (!button) return;

  const type = button.dataset.filterType;
  const value = button.dataset.filterValue;

  try {
    await setFilter(type, value);
  } catch (err) {
    console.error(err);
  }
});

releaseRepoSelectEl?.addEventListener("change", async () => {
  try {
    await loadReleasesForSelectedRepo();
  } catch (err) {
    console.error(err);
    releasePreviewEl.textContent = "Failed to load releases.";
  }
});

createReleaseBtn?.addEventListener("click", async () => {
  if (!isAdmin()) {
    alert("Admin mode required.");
    return;
  }

  try {
    await createRelease();
  } catch (err) {
    console.error(err);
    alert("Failed to create release.");
  }
});

releaseVersionListEl?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-release-id]");

  if (deleteButton) {
    event.stopPropagation();

    const releaseId = deleteButton.dataset.deleteReleaseId;

    if (!confirm("Delete this release?")) {
      return;
    }

    fetch(`${API_BASE}/api/releases/${releaseId}`, {
      method: "DELETE",
      headers: {
        "x-api-key": getUploadKey(),
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }

        await loadReleasesForSelectedRepo();

        releasePreviewEl.innerHTML =
          "Select a version to preview patch notes.";
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to delete release.");
      });

    return;
  }

  const button = event.target.closest("[data-release-id]");
  if (!button) return;

  const release = releases.find((item) => String(item.id) === String(button.dataset.releaseId));

  if (!release) return;

  releasePreviewEl.innerHTML = marked.parse(release.notes_markdown || "");
});

activeFiltersEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-clear-filter]");
  if (!button) return;

  const type = button.dataset.clearFilter;

  try {
    await clearFilter(type);
  } catch (err) {
    console.error(err);
  }
});

refreshBtn.addEventListener("click", async () => {
  try {
    await loadData();
    connectStream();
  } catch (err) {
    console.error(err);
  }
});

clearFiltersBtn.addEventListener("click", async () => {
  state.repo = "";
  state.branch = "";
  state.owner = "";
  state.contributor = "";
  state.page = 1;

  try {
    await loadData();
    connectStream();
  } catch (err) {
    console.error(err);
  }
});

prevPageBtn.addEventListener("click", async () => {
  if (!pagination?.has_prev) return;

  state.page -= 1;

  try {
    await loadData();
  } catch (err) {
    console.error(err);
  }
});

nextPageBtn.addEventListener("click", async () => {
  if (!pagination?.has_next) return;

  state.page += 1;

  try {
    await loadData();
  } catch (err) {
    console.error(err);
  }
});

commitsTabBtn?.addEventListener("click", () => {
  commitsTabBtn.classList.add("active");
  branchesTabBtn.classList.remove("active");

  commitsPanelEl.classList.remove("hidden");
  branchesPanelEl.classList.add("hidden");

  releasesTabBtn.classList.remove("active");
  releasesPanelEl.classList.add("hidden");
});

branchesTabBtn?.addEventListener("click", () => {
  branchesTabBtn.classList.add("active");
  commitsTabBtn.classList.remove("active");

  branchesPanelEl.classList.remove("hidden");
  commitsPanelEl.classList.add("hidden");

  releasesTabBtn.classList.remove("active");
  releasesPanelEl.classList.add("hidden");

  renderBranchesTree();
});

releasesTabBtn?.addEventListener("click", async () => {
  releasesTabBtn.classList.add("active");
  commitsTabBtn.classList.remove("active");
  branchesTabBtn.classList.remove("active");

  releasesPanelEl.classList.remove("hidden");
  commitsPanelEl.classList.add("hidden");
  branchesPanelEl.classList.add("hidden");

  renderReleaseRepoOptions();

  try {
    await loadReleasesForSelectedRepo();
  } catch (err) {
    console.error(err);
  }
});


(async function init() {
  readStateFromUrl();

  renderAdminStatus();
  try {
    await loadData();
    connectStream();
  } catch (err) {
    console.error(err);
    feedEl.innerHTML = `<div class="empty">Failed to load data from backend.</div>`;
  }
})();