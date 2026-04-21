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

const PAGE_SIZE = 20;

let commits = [];
let stats = null;
let pagination = null;
let source = null;
let stickyObserver = null;

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

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    `Tracking started ${
      stats?.tracking_started_at
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
    bar.title = `${day.day}: ${day.count} commit(s)`;
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
    <article class="commit-card">
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

function renderFeed() {
  if (!commits.length) {
    feedEl.innerHTML = `<div class="empty">No commits match the current filters.</div>`;
    return;
  }

  feedEl.innerHTML = commits.map(commitCard).join("");
}

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
  const res = await fetch(`${API_BASE}/api/bootstrap?${query}`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to load bootstrap data");
  }

  const data = await res.json();
  stats = data.stats;
  commits = data.items || [];
  pagination = data.pagination || null;

  renderStats();
  renderChart();
  renderActiveFilters();
  renderFeed();
  renderPagination();
  updateUrl();
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
  renderPagination();
}

function setupStickyFooterVisibility() {
  if (!commitsPanelEl || !panelFooterEl) return;

  if (stickyObserver) {
    stickyObserver.disconnect();
  }

  stickyObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      const rect = entry.boundingClientRect;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      const commitsOwnMostOfViewport =
        rect.top < viewportHeight * 0.25 && rect.bottom > viewportHeight * 0.6;

      panelFooterEl.classList.toggle("is-sticky", commitsOwnMostOfViewport);
    },
    {
      root: null,
      threshold: [0, 0.25, 0.5, 0.75, 1]
    }
  );

  stickyObserver.observe(commitsPanelEl);
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

window.addEventListener("resize", () => {
  setupStickyFooterVisibility();
});

(async function init() {
  readStateFromUrl();

  try {
    await loadData();
    connectStream();
    setupStickyFooterVisibility();
  } catch (err) {
    console.error(err);
    feedEl.innerHTML = `<div class="empty">Failed to load data from backend.</div>`;
  }
})();