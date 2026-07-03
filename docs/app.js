/* ==================================================================
   co7 landing page
   
   >>> EDIT THESE TWO LINES to point at your repository <<<
================================================================== */
const GITHUB_OWNER = "BugLiteyear"; // e.g. "dhruv"
const GITHUB_REPO  = "co7";
/* ================================================================== */

const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
const API_URL  = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

/* ---------- wire up static links ---------- */
document.getElementById("nav-github").href = REPO_URL;
document.getElementById("footer-github").href = REPO_URL;
document.getElementById("download-btn").href = `${REPO_URL}/releases/latest`;

/* ---------- signature: request demo strip ---------- */
(function animateRequestDemo() {
  const result = document.getElementById("req-result");
  const time = document.getElementById("req-time");
  if (!result || !time) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) { time.textContent = "42 ms"; return; }
  result.classList.add("pending");
  setTimeout(() => {
    result.classList.remove("pending");
    result.classList.add("done");
    time.textContent = `${38 + Math.floor(Math.random() * 30)} ms`;
  }, 900);
})();

/* ---------- helpers ---------- */
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Tiny markdown renderer for release notes (headings, lists, bold, code) */
function renderNotes(md) {
  if (!md || !md.trim()) return "<p>No release notes provided.</p>";
  const lines = escapeHtml(md.trim()).split(/\r?\n/);
  let html = "", inList = false;
  const inline = (t) => t
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^(#{1,3})\s+(.*)/);
    const li = line.match(/^[-*]\s+(.*)/);
    if (li) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(li[1])}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (h) html += `<h3>${inline(h[2])}</h3>`;
    else if (line) html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

function assetListHtml(assets) {
  if (!assets || !assets.length) return "";
  const rows = assets.map((a) => `
    <a class="asset" href="${a.browser_download_url}">
      <span class="asset-dl">↓</span>
      <span>${escapeHtml(a.name)}</span>
      <span class="asset-size">${fmtSize(a.size)} · ${a.download_count} downloads</span>
    </a>`).join("");
  return `<div class="asset-list">${rows}</div>`;
}

/* ---------- fetch & render releases ---------- */
async function loadReleases() {
  const latestEl = document.getElementById("latest-release");
  try {
    const res = await fetch(`${API_URL}?per_page=30`);
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const releases = (await res.json()).filter((r) => !r.draft);
    if (!releases.length) throw new Error("No releases found");

    const [latest, ...older] = releases;

    /* hero button → primary asset (or release page if no assets) */
    const btn = document.getElementById("download-btn");
    const meta = document.getElementById("download-meta");
    const fineprint = document.getElementById("hero-fineprint");
    if (latest.assets.length) {
      btn.href = latest.assets[0].browser_download_url;
      meta.textContent = `${latest.tag_name} · ${fmtSize(latest.assets[0].size)}`;
      fineprint.textContent = `${latest.tag_name} — released ${fmtDate(latest.published_at)}`;
    } else {
      btn.href = latest.html_url;
      meta.textContent = latest.tag_name;
    }

    /* latest release card */
    latestEl.innerHTML = `
      <div class="release-top">
        <span class="release-tag">${escapeHtml(latest.tag_name)}</span>
        <span class="release-name">${escapeHtml(latest.name || "")}</span>
        <span class="release-date">${fmtDate(latest.published_at)}</span>
      </div>
      <div class="release-notes">${renderNotes(latest.body)}</div>
      ${assetListHtml(latest.assets)}
    `;

    /* older releases */
    if (older.length) {
      const toggle = document.getElementById("toggle-older");
      const list = document.getElementById("older-releases");
      toggle.hidden = false;
      list.innerHTML = older.map((r) => `
        <details class="older-item">
          <summary>
            <span class="older-tag">${escapeHtml(r.tag_name)}</span>
            <span>${escapeHtml(r.name || "")}</span>
            <span class="older-date">${fmtDate(r.published_at)}</span>
          </summary>
          <div class="older-body">
            <div class="release-notes">${renderNotes(r.body)}</div>
            ${assetListHtml(r.assets)}
          </div>
        </details>`).join("");

      toggle.addEventListener("click", () => {
        const open = list.hidden;
        list.hidden = !open;
        toggle.querySelector(".chev").classList.toggle("open", open);
        toggle.firstChild.textContent = open ? "Hide older releases " : "Show older releases ";
      });
    }
  } catch (err) {
    latestEl.innerHTML = `
      <p class="error-note">
        Couldn't load release details right now.
        You can always find every version on the
        <a href="${REPO_URL}/releases" target="_blank" rel="noopener">GitHub releases page</a>.
      </p>`;
  }
}

loadReleases();
