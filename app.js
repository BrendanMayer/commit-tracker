const API_BASE = window.APP_CONFIG.API_BASE.replace(/\/+$/, "");
const feedEl = document.getElementById("feed");
const chartEl = document.getElementById("chart");
const headlineEl = document.getElementById("headline");
const sublineEl = document.getElementById("subline");
const totalCommitsEl = document.getElementById("stat-total-commits");
const totalReposEl = document.getElementById("stat-total-repos");
const totalAuthorsEl = document.getElementById("stat-total-authors");
const refreshBtn = document.getElementById("refresh-btn");

let commits = [];
let stats = null;
let source = null;

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
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHeadline() {
  const total = stats?.total_commits || 0;
  const daily = stats?.daily || [];
  const totalDays = daily.length || 0;
  const cpd = totalDays ? (total / totalDays).toFixed(2) : "0.00";

  headlineEl.textContent = `${formatNumber(total)} commits over ${formatNumber(totalDays)} days · ${cpd} cpd`;
  sublineEl.textContent = `Tracking started ${stats?.tracking_started_at ? new Date(stats.tracking_started_at).toLocaleString() : "unknown"}`;
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
  const max = Math.max(1, ...tail.map(d => d.count));

  if (!tail.length) {
    chartEl.innerHTML = `<div class="empty">No commits yet. Humanity has briefly paused.</div>`;
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

function commitCard(c) {
  const author = escapeHtml(c.author_name || c.sender_login || "Unknown");
  const repo = escapeHtml(c.repo_full_name);
  const branch = escapeHtml(c.branch || "");
  const msg = escapeHtml(c.message || "");
  const shaShort = escapeHtml((c.sha || "").slice(0, 7));
  const commitUrl = escapeHtml(c.url || "#");
  const avatar = escapeHtml(c.sender_avatar_url || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png");

  return `
    <article class="commit-card">
      <img class="avatar" src="${avatar}" alt="${author}" />
      <div>
        <div class="commit-top">
          <span class="repo">${repo}</span>
          <span class="repo">${branch}</span>
          <span class="meta">${timeAgo(c.timestamp)}</span>
        </div>
        <div class="message">${msg}</div>
        <div class="commit-bottom">
          <span>${author}</span>
          
        </div>
      </div>
    </article>
  `;
}

function renderFeed() {
  if (!commits.length) {
    feedEl.innerHTML = `<div class="empty">No commits tracked yet.</div>`;
    return;
  }
  feedEl.innerHTML = commits.map(commitCard).join("");
}

function addCommitLive(commit) {
  const exists = commits.some(c => c.sha === commit.sha);
  if (exists) return;

  commits.unshift(commit);
  commits = commits.slice(0, 100);

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
  const existingDay = stats.daily.find(d => d.day === day);
  if (existingDay) {
    existingDay.count += 1;
  } else {
    stats.daily.push({ day, count: 1 });
    stats.daily.sort((a, b) => a.day.localeCompare(b.day));
  }

  const repoSet = new Set(commits.map(c => c.repo_full_name));
  stats.total_repos = Math.max(stats.total_repos, repoSet.size);

  const authorSet = new Set(commits.map(c => c.author_name || c.sender_login || "Unknown"));
  stats.total_authors = Math.max(stats.total_authors, authorSet.size);

  renderStats();
  renderChart();
  renderFeed();
}

async function loadInitial() {
  const res = await fetch(`${API_BASE}/api/bootstrap?limit=100`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load bootstrap data");
  const data = await res.json();
  stats = data.stats;
  commits = data.commits || [];
  renderStats();
  renderChart();
  renderFeed();
}

function connectStream() {
  if (source) source.close();

  source = new EventSource(`${API_BASE}/api/stream`);

  source.addEventListener("commit", (event) => {
    try {
      const commit = JSON.parse(event.data);
      addCommitLive(commit);
    } catch (err) {
      console.error("Bad stream event", err);
    }
  });

  source.onerror = () => {
    if (source) source.close();
    setTimeout(connectStream, 3000);
  };
}

refreshBtn.addEventListener("click", async () => {
  try {
    await loadInitial();
  } catch (err) {
    console.error(err);
  }
});

(async function init() {
  try {
    await loadInitial();
    connectStream();
  } catch (err) {
    console.error(err);
    feedEl.innerHTML = `<div class="empty">Failed to load data from backend.</div>`;
  }
})();