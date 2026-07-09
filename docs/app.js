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

/* ---------- OS detection ---------- */
const OS_LABELS = { windows: "Windows", mac: "macOS", linux: "Linux" };

function detectOS() {
  // Try modern API first
  try {
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      const p = (navigator.userAgentData.platform || "").toLowerCase();
      if (p.includes("win")) return "windows";
      if (p.includes("mac") || p.includes("iphone") || p.includes("ipad")) return "mac";
      if (p.includes("linux")) return "linux";
    }
  } catch (e) { /* ignore */ }
  const platform = (navigator.platform || "").toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac") || platform.includes("iphone") || platform.includes("ipad")) return "mac";
  if (platform.includes("linux") || platform.includes("x11")) return "linux";
  const ua = (navigator.userAgent || "").toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac") || ua.includes("macintosh") || ua.includes("darwin")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "other";
}

/* Apple Silicon vs Intel — best effort; defaults to arm64 (most Macs) */
async function detectMacArch() {
  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      const { architecture } = await navigator.userAgentData.getHighEntropyValues(["architecture"]);
      if (architecture) return architecture.includes("arm") ? "arm" : "x64";
    }
  } catch (e) { /* ignore */ }
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
    if (/intel|amd|nvidia/i.test(renderer)) return "x64";
  } catch (e) { /* ignore */ }
  return "arm";
}

function pickAsset(candidates, os, arch) {
  if (!candidates.length) return null;
  if (os === "mac" && candidates.length > 1) {
    const arm = candidates.find((a) => /arm64|aarch64/i.test(a.name));
    const x64 = candidates.find((a) => !/arm64|aarch64/i.test(a.name));
    return (arch === "x64" ? x64 : arm) || candidates[0];
  }
  return candidates[0];
}

/* ---------- fetch & render releases ---------- */
async function loadReleases() {
  const latestEl = document.getElementById("latest-release");
  try {
    const res = await fetch(`${API_URL}?per_page=30`);
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const releases = (await res.json())
      .filter((r) => !r.draft)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    if (!releases.length) throw new Error("No releases found");

    const [latest, ...older] = releases;

    /* hero button → primary asset (or release page if no assets) */
    const btn = document.getElementById("download-btn");
    const meta = document.getElementById("download-meta");
    const fineprint = document.getElementById("hero-fineprint");
    if (latest.assets.length) {
      const os = detectOS();
      const assets = latest.assets;
      const assetsByOS = { windows: [], mac: [], linux: [], other: [] };
      for (const a of assets) {
        const n = (a.name || "").toLowerCase();
        if (n.endsWith(".exe") || n.endsWith(".msi") || n.includes("windows")) assetsByOS.windows.push(a);
        else if (n.endsWith(".dmg") || n.endsWith(".pkg") || n.includes("mac") || n.includes("darwin")) assetsByOS.mac.push(a);
        else if (n.endsWith(".appimage") || n.endsWith(".deb") || n.endsWith(".rpm") || n.includes("linux")) assetsByOS.linux.push(a);
        else assetsByOS.other.push(a);
      }

      const arch = os === "mac" ? await detectMacArch() : null;
      const matched = pickAsset(assetsByOS[os] || [], os, arch);
      const asset = matched || assets[0];

      btn.href = asset.browser_download_url;
      document.getElementById("download-label").textContent =
        matched ? `Download for ${OS_LABELS[os]}` : "Download latest";
      const archLabel = matched && os === "mac" && assetsByOS.mac.length > 1
        ? (/arm64|aarch64/i.test(asset.name) ? " · Apple Silicon" : " · Intel")
        : "";
      meta.textContent = `${latest.tag_name}${archLabel} · ${fmtSize(asset.size)}`;
      fineprint.innerHTML =
        `${escapeHtml(latest.tag_name)} — released ${fmtDate(latest.published_at)}` +
        ` · <a href="#releases">other platforms</a>`;
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
