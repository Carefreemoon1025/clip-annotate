// sidepanel.js - 侧边栏主逻辑

let allClippings = [];
let currentView = "list"; // list | settings | export

// DOM references
const $ = (id) => document.getElementById(id);
const clippingsList = $("clippingsList");
const emptyState = $("emptyState");
const searchInput = $("searchInput");
const settingsPanel = $("settingsPanel");
const exportPanel = $("exportPanel");
const apiKeyInput = $("apiKeyInput");
const apiEndpointInput = $("apiEndpointInput");
const configStatus = $("configStatus");
const apiModelInput = $("apiModelInput");
const btnTheme = $("btnTheme");
const themeDropdown = $("themeDropdown");
const btnFontColor = $("btnFontColor");
const fontColorDropdown = $("fontColorDropdown");

const THEMES = [
  { theme: "", label: "☀️ 默认", icon: "☀️" },
  { theme: "eye-care", label: "🌙 护眼", icon: "🌙" },
  { theme: "dark", label: "🌑 黑暗", icon: "🌑" }
];

const FONT_COLORS = [
  { id: "default", label: "默认", colors: {
    "":      { primary: "#1e293b", soft: "#475569" },
    "eye-care": { primary: "#5c4b3a", soft: "#7a6a5a" },
    "dark":  { primary: "#e2e8f0", soft: "#cbd5e1" }
  }},
  { id: "slate", label: "石板蓝", colors: {
    "":      { primary: "#334155", soft: "#52637a" },
    "eye-care": { primary: "#5a6a7a", soft: "#6b7a8a" },
    "dark":  { primary: "#cbd5e1", soft: "#94a3b8" }
  }},
  { id: "amber", label: "琥珀", colors: {
    "":      { primary: "#92400e", soft: "#a16207" },
    "eye-care": { primary: "#8b6914", soft: "#a07d3a" },
    "dark":  { primary: "#fcd34d", soft: "#fbbf24" }
  }},
  { id: "emerald", label: "墨绿", colors: {
    "":      { primary: "#065f46", soft: "#047857" },
    "eye-care": { primary: "#5c7a5a", soft: "#6b8a6a" },
    "dark":  { primary: "#6ee7b7", soft: "#34d399" }
  }},
  { id: "rose", label: "玫瑰", colors: {
    "":      { primary: "#9f1239", soft: "#be123c" },
    "eye-care": { primary: "#8b4a5a", soft: "#9a5a6a" },
    "dark":  { primary: "#fda4af", soft: "#fb7185" }
  }},
  { id: "violet", label: "紫罗兰", colors: {
    "":      { primary: "#5b21b6", soft: "#6d28d9" },
    "eye-care": { primary: "#6b5a8b", soft: "#7a6a9a" },
    "dark":  { primary: "#c4b5fd", soft: "#a78bfa" }
  }}
];

// Initialize
document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadClippings();
  setupEventListeners();
  await loadTheme();
  await loadFontColor();
  render();
}

// Load from storage
async function loadClippings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getClippings" }, (response) => {
      allClippings = response?.clippings || [];
      resolve();
    });
  });
}

// Event listeners
function setupEventListeners() {
  // Search
  searchInput.addEventListener("input", render);

  // Settings
  $("btnSettings").addEventListener("click", showSettings);
  $("btnBackFromSettings").addEventListener("click", showList);

  // Export
  $("btnExport").addEventListener("click", showExport);
  $("btnBackFromExport").addEventListener("click", showList);
  $("btnExportJson").addEventListener("click", exportJSON);
  $("btnExportMarkdown").addEventListener("click", exportMarkdown);

  // Save config
  $("btnSaveConfig").addEventListener("click", saveConfig);

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "clippingSaved" || request.action === "summaryReady") {
      loadClippings().then(render);
    }
  });

  // Load saved config
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
    if (response) {
      apiKeyInput.value = response.apiKey || "";
      apiEndpointInput.value = response.apiEndpoint || "https://api.deepseek.com";
      apiModelInput.value = response.apiModel || "deepseek-v4-flash";
    }
  });

  // 事件委托: clipping 卡片交互
  clippingsList.addEventListener("click", (e) => {
    const card = e.target.closest(".clipping-card");
    if (!card) return;
    const clippingId = card.dataset.id;
    const clipping = allClippings.find(c => c.id === clippingId);
    if (!clipping) return;

    // Copy button
    if (e.target.closest(".action-btn.copy")) {
      navigator.clipboard.writeText(clipping.rawText).then(() => {
        const btn = e.target.closest(".action-btn.copy");
        btn.textContent = "✅";
        setTimeout(() => { btn.textContent = "📋"; }, 1500);
      });
      return;
    }

    // Delete button
    if (e.target.closest(".action-btn.delete")) {
      if (confirm("确定删除这条抄录？")) {
        chrome.runtime.sendMessage({ action: "deleteClipping", clippingId });
        allClippings = allClippings.filter(item => item.id !== clippingId);
        render();
      }
      return;
    }

    // Raw text toggle
    if (e.target.closest(".raw-toggle")) {
      const toggle = e.target.closest(".raw-toggle");
      const rawText = card.querySelector(".raw-text");
      if (toggle && rawText) {
        const isVisible = rawText.classList.toggle("visible");
        toggle.textContent = isVisible ? "▲ 收起原文" : "▼ 查看原文";
      }
      return;
    }

    // Retry summary
    if (e.target.closest(".summary-error")) {
      chrome.runtime.sendMessage({ action: "retrySummary", clippingId });
      e.target.closest(".summary-error").textContent = "⏳ 重新生成中...";
      return;
    }

    // 点击 annotation-display 切换到编辑模式
    const display = e.target.closest(".annotation-display");
    if (display) {
      const input = card.querySelector(".annotation-input");
      if (input) {
        display.style.display = "none";
        input.style.display = "block";
        input.focus();
      }
    }
  });

  // 事件委托: annotation input 失焦保存
  clippingsList.addEventListener("focusout", (e) => {
    const input = e.target.closest(".annotation-input");
    if (!input) return;
    const card = input.closest(".clipping-card");
    if (!card) return;
    const clippingId = card.dataset.id;
    const clipping = allClippings.find(c => c.id === clippingId);
    if (!clipping) return;

    const newVal = input.value.trim();
    const display = card.querySelector(".annotation-display");
    display.style.display = "";
    input.style.display = "none";

    if (newVal !== clipping.annotation) {
      clipping.annotation = newVal;
      display.innerHTML = newVal
        ? `<span class="annotation-label">📝 批注:</span> ${escapeHtml(newVal)}`
        : `<span class="annotation-label">📝 添加批注...</span>`;
      chrome.runtime.sendMessage({ action: "updateAnnotation", clippingId, annotation: newVal });
    }
  });

  // 事件委托: annotation input 回车保存
  clippingsList.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && e.target.closest(".annotation-input")) {
      e.preventDefault();
      e.target.blur();
    }
  });

  // Theme dropdown toggle
  btnTheme.addEventListener("click", (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle("hidden");
  });

  // Theme option click
  themeDropdown.addEventListener("click", (e) => {
    const option = e.target.closest(".theme-option");
    if (!option) return;
    const theme = option.dataset.theme;
    setTheme(theme);
    themeDropdown.classList.add("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    themeDropdown.classList.add("hidden");
    fontColorDropdown.classList.add("hidden");
  });

  // Font color dropdown toggle
  btnFontColor.addEventListener("click", (e) => {
    e.stopPropagation();
    themeDropdown.classList.add("hidden");
    fontColorDropdown.classList.toggle("hidden");
  });

  // Font color option click
  fontColorDropdown.addEventListener("click", (e) => {
    const option = e.target.closest(".theme-option");
    if (!option) return;
    setFontColor(option.dataset.color);
    fontColorDropdown.classList.add("hidden");
  });
}

// Theme functions
function setTheme(theme) {
  document.body.className = theme;
  const current = THEMES.find(t => t.theme === theme) || THEMES[0];
  btnTheme.textContent = current.icon;
  chrome.storage.local.set({ theme });
  applyColors();
  renderSwatches();
}

// Font color functions
function renderSwatches() {
  const currentId = document.body.dataset.fontColor || "default";
  const theme = document.body.className || "";
  fontColorDropdown.innerHTML = FONT_COLORS.map(fc => {
    const c = fc.colors[theme] || fc.colors[""];
    const active = fc.id === currentId ? " active" : "";
    return `<div class="theme-option font-color-option${active}" data-color="${fc.id}">
      <span class="color-dot" style="background:${c.primary}"></span> ${fc.label}
    </div>`;
  }).join("");
}

function setFontColor(id) {
  document.body.dataset.fontColor = id;
  chrome.storage.local.set({ fontColor: id });
  applyColors();
  renderSwatches();
}

function applyColors() {
  const theme = document.body.className || "";
  const colorId = document.body.dataset.fontColor || "default";
  const fc = FONT_COLORS.find(f => f.id === colorId);
  if (!fc) return;
  const c = fc.colors[theme] || fc.colors[""];
  if (c) {
    document.body.style.setProperty("--text-primary", c.primary);
    document.body.style.setProperty("--text-soft", c.soft);
  }
}

async function loadFontColor() {
  return new Promise((resolve) => {
    chrome.storage.local.get("fontColor", (result) => {
      const id = result.fontColor || "default";
      document.body.dataset.fontColor = id;
      applyColors();
      renderSwatches();
      resolve();
    });
  });
}

async function loadTheme() {
  return new Promise((resolve) => {
    chrome.storage.local.get("theme", (result) => {
      const theme = result.theme || "";
      document.body.className = theme;
      const current = THEMES.find(t => t.theme === theme) || THEMES[0];
      btnTheme.textContent = current.icon;
      resolve();
    });
  });
}

// View switching
function showList() {
  currentView = "list";
  document.querySelector(".header").classList.remove("hidden");
  document.querySelector(".search-bar").classList.remove("hidden");
  clippingsList.classList.remove("hidden");
  settingsPanel.classList.add("hidden");
  exportPanel.classList.add("hidden");
}

function showSettings() {
  currentView = "settings";
  document.querySelector(".header").classList.add("hidden");
  document.querySelector(".search-bar").classList.add("hidden");
  clippingsList.classList.add("hidden");
  settingsPanel.classList.remove("hidden");
  exportPanel.classList.add("hidden");
}

function showExport() {
  currentView = "export";
  document.querySelector(".header").classList.add("hidden");
  document.querySelector(".search-bar").classList.add("hidden");
  clippingsList.classList.add("hidden");
  settingsPanel.classList.add("hidden");
  exportPanel.classList.remove("hidden");
}

// Save API config
function saveConfig() {
  const apiKey = apiKeyInput.value.trim();
  const apiEndpoint = apiEndpointInput.value.trim() || "https://api.deepseek.com";
  const apiModel = apiModelInput.value.trim() || "deepseek-v4-flash";

  chrome.runtime.sendMessage({
    action: "saveConfig",
    apiKey,
    apiEndpoint,
    apiModel
  }, (response) => {
    if (response?.ok) {
      configStatus.textContent = "✅ 设置已保存";
      configStatus.className = "config-status success";
    } else {
      configStatus.textContent = "❌ 保存失败";
      configStatus.className = "config-status error";
    }
    setTimeout(() => { configStatus.textContent = ""; }, 2000);
  });
}

// Render clippings
function render() {
  const keyword = searchInput.value.trim().toLowerCase();
  let filtered = allClippings;

  if (keyword) {
    filtered = allClippings.filter(c =>
      c.rawText.toLowerCase().includes(keyword) ||
      c.pageTitle.toLowerCase().includes(keyword) ||
      c.annotation.toLowerCase().includes(keyword) ||
      c.summary.toLowerCase().includes(keyword)
    );
  }

  if (filtered.length === 0) {
    clippingsList.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  clippingsList.innerHTML = filtered.map(c => renderCard(c)).join("");
}

// Render single card
function renderCard(c) {
  const isLong = c.rawText.length > 100;
  const displayText = c.summary || (isLong ? "⏳ AI 总结生成中..." : c.rawText);
  const hasSummaryError = c.summary === "[AI 总结生成失败]";
  const isAiSummarized = isLong && displayText && !hasSummaryError && displayText !== "⏳ AI 总结生成中...";

  const timeStr = formatTime(c.timestamp);
  const rawPreview = c.rawText.length > 200 ? c.rawText.slice(0, 200) + "..." : c.rawText;

  const annotationHtml = c.annotation
    ? `<span class="annotation-label">📝 批注:</span> ${escapeHtml(c.annotation)}`
    : `<span class="annotation-label">📝 添加批注...</span>`;

  return `
    <div class="clipping-card" data-id="${c.id}">
      <div class="clipping-header">
        <div class="clipping-source">
          <div>${escapeHtml(c.pageTitle || "无标题")}</div>
          <div><a href="${escapeHtml(c.url)}" target="_blank" title="${escapeHtml(c.url)}">${shortenUrl(c.url)}</a></div>
          <div class="clipping-time">${timeStr}</div>
        </div>
        <div class="clipping-actions">
          <button class="action-btn copy" title="复制原文">📋</button>
          <button class="action-btn delete" title="删除">🗑️</button>
        </div>
      </div>

      <div class="clipping-summary">
        ${isAiSummarized ? `<span class="summary-label">AI</span>` : ""}
        ${hasSummaryError
          ? `<span class="summary-error">⚠️ AI 总结失败，点击重试</span>`
          : escapeHtml(displayText)
        }
      </div>

      ${isLong ? `
        <div class="clipping-raw">
          <button class="raw-toggle">▼ 查看原文</button>
          <div class="raw-text">${escapeHtml(c.rawText)}</div>
        </div>
      ` : ""}

      <div class="clipping-annotation">
        <div class="annotation-display">${annotationHtml}</div>
        <textarea class="annotation-input" style="display:none" placeholder="输入批注...">${escapeHtml(c.annotation)}</textarea>
      </div>
    </div>
  `;
}

// Export JSON
function exportJSON() {
  chrome.runtime.sendMessage({ action: "exportData" }, (response) => {
    if (!response?.clippings) return;
    const data = JSON.stringify(response.clippings, null, 2);
    downloadFile(data, "文摘-抄录导出.json", "application/json");
  });
}

// Export Markdown
function exportMarkdown() {
  chrome.runtime.sendMessage({ action: "exportData" }, (response) => {
    if (!response?.clippings) return;
    let md = `# 文摘 - 抄录导出\n\n导出时间: ${new Date().toLocaleString("zh-CN")}\n\n---\n\n`;
    response.clippings.forEach((c, i) => {
      md += `## ${i + 1}. ${c.pageTitle || "无标题"}\n\n`;
      md += `- **来源**: [${c.url}](${c.url})\n`;
      md += `- **时间**: ${new Date(c.timestamp).toLocaleString("zh-CN")}\n`;
      if (c.summary && c.summary !== "[AI 总结生成失败]") {
        md += `- **总结**: ${c.summary}\n`;
      }
      if (c.annotation) {
        md += `- **批注**: ${c.annotation}\n`;
      }
      md += `\n`;
      md += `> ${c.rawText.replace(/\n/g, "\n> ")}\n\n`;
      md += `---\n\n`;
    });
    downloadFile(md, "文摘-抄录导出.md", "text/markdown");
  });
}

// Helpers
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `今天 ${time}`;
  if (isYesterday) return `昨天 ${time}`;
  return `${d.toLocaleDateString("zh-CN")} ${time}`;
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 20) + (u.pathname.length > 20 ? "..." : "") : "");
  } catch {
    return url;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
