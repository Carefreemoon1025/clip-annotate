# 文摘 (clip-annotate) 优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复代码质量问题、优化 UI 风格并加速 AI 总结

**Architecture:** 三文件改动：background.js（service worker）修复并发逻辑、抽取辅助函数、AI 加速；sidepanel.js 改用事件委托提升渲染性能；styles.css 调整为简约精致风格

**Tech Stack:** Chrome Extension (Manifest V3), Vanilla JS, CSS3

---

### Task 1: 重构 background.js — 抽取辅助函数 + 修复并发 Bug

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\background.js`

- [ ] **Step 1: 在 background.js 顶部添加通用 storage 辅助函数**

在 `chrome.runtime.onInstalled` 监听之后、`saveClipping` 函数之前，添加：

```javascript
// Storage helpers
function getClippings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ clippings: [] }, (result) => {
      resolve(result.clippings);
    });
  });
}

function saveClippings(clippings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ clippings }, resolve);
  });
}
```

- [ ] **Step 2: 重写 saveClipping 合并短文本逻辑，消除并发 bug**

将整个 `saveClipping` 函数替换为：

```javascript
// 保存抄录
async function saveClipping(text, url, pageTitle) {
  if (!text || !text.trim()) return;

  const clipping = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    rawText: text,
    summary: text.length <= 100 ? text : "",
    url: url || "",
    pageTitle: pageTitle || "",
    timestamp: Date.now(),
    annotation: ""
  };

  const clippings = await getClippings();
  clippings.unshift(clipping);
  await saveClippings(clippings);

  chrome.runtime.sendMessage({ action: "clippingSaved", clippingId: clipping.id }).catch(() => {});

  // 长文本异步调用 AI 总结
  if (text.length > 100) {
    generateSummary(clipping.id, text);
  }
}
```

关键改动：先同步构造 clipping 对象（短文本直接赋值 summary），一次 `getClippings` + 一次 `setClippings` 完成，消除并发窗口。

- [ ] **Step 3: 用辅助函数重写 updateAnnotation/deleteClipping/retrySummary**

将这三个函数全部替换为基于 `getClippings`/`saveClippings` 的版本：

```javascript
// 更新批注
async function updateAnnotation(clippingId, annotation) {
  const clippings = await getClippings();
  const idx = clippings.findIndex(c => c.id === clippingId);
  if (idx !== -1) {
    clippings[idx].annotation = annotation;
    await saveClippings(clippings);
  }
}

// 删除抄录
async function deleteClipping(clippingId) {
  const clippings = await getClippings();
  const filtered = clippings.filter(c => c.id !== clippingId);
  await saveClippings(filtered);
}

// 重试 AI 总结
async function retrySummary(clippingId) {
  const clippings = await getClippings();
  const clipping = clippings.find(c => c.id === clippingId);
  if (clipping && clipping.rawText.length > 100) {
    generateSummary(clippingId, clipping.rawText);
  }
}
```

- [ ] **Step 4: 重写 generateSummary 内部也使用辅助函数**

替换 `generateSummary` 中 success 和 error 回调里的 `storage.get/set` 为 `getClippings`/`saveClippings`：

```javascript
if (summary) {
  const clippings = await getClippings();
  const idx = clippings.findIndex(c => c.id === clippingId);
  if (idx !== -1) {
    clippings[idx].summary = summary;
    await saveClippings(clippings);
    chrome.runtime.sendMessage({ action: "summaryReady", clippingId }).catch(() => {});
  }
}
```

```javascript
} catch (err) {
  console.error("AI summary error:", err);
  const clippings = await getClippings();
  const idx = clippings.findIndex(c => c.id === clippingId);
  if (idx !== -1) {
    clippings[idx].summary = "[AI 总结生成失败]";
    await saveClippings(clippings);
  }
}
```

注意：`generateSummary` 已经是 async 函数，所以可以直接用 await。

---

### Task 2: 模型名可配置

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\background.js`
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.html`
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.js`

- [ ] **Step 1: background.js 消息路由增加 getConfig/saveConfig 支持 apiModel 字段**

修改 `case "getConfig"` 和 `case "saveConfig"` 分支：

```javascript
case "getConfig":
  chrome.storage.local.get(["apiKey", "apiEndpoint", "apiModel"], (result) => {
    sendResponse({
      apiKey: result.apiKey || "",
      apiEndpoint: result.apiEndpoint || "https://api.deepseek.com",
      apiModel: result.apiModel || "deepseek-v4-flash"
    });
  });
  return true;
case "saveConfig":
  chrome.storage.local.set({
    apiKey: request.apiKey,
    apiEndpoint: request.apiEndpoint || "https://api.deepseek.com",
    apiModel: request.apiModel || "deepseek-v4-flash"
  }, () => {
    sendResponse({ ok: true });
  });
  return true;
```

- [ ] **Step 2: background.js generateSummary 从 storage 读取 apiModel**

修改 `generateSummary` 函数的 storage 读取：

```javascript
const result = await chrome.storage.local.get(["apiKey", "apiEndpoint", "apiModel"]);
const apiKey = result.apiKey || "";
const apiEndpoint = (result.apiEndpoint || "https://api.deepseek.com").replace(/\/+$/, "");
const apiModel = result.apiModel || "deepseek-v4-flash";
```

然后修改 API 请求体中的 model 字段：

```javascript
body: JSON.stringify({
  model: apiModel,
  // ...
})
```

- [ ] **Step 3: sidepanel.html 设置面板增加模型名输入框**

在 apiEndpointInput 后面增加：

```html
<div class="form-group">
  <label for="apiModelInput">模型名称</label>
  <input type="text" id="apiModelInput" placeholder="deepseek-v4-flash" />
</div>
```

- [ ] **Step 4: sidepanel.js 加载和保存模型名**

在 `configStatus` 声明后增加 `apiModelInput` 引用：

```javascript
const apiModelInput = $("apiModelInput");
```

在 `saveConfig` 函数中增加 apiModel：

```javascript
const apiModel = apiModelInput.value.trim() || "deepseek-v4-flash";
// 消息中增加：
apiModel,
```

在 `setupEventListeners` 的 load config 响应中增加：

```javascript
apiModelInput.value = response.apiModel || "deepseek-v4-flash";
```

---

### Task 3: AI 总结加速

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\background.js`

- [ ] **Step 1: 优化 generateSummary 中的 prompt 和参数**

将 prompt 从：
```javascript
const prompt = `请用一句话（不超过 50 字）总结以下文字的核心内容：\n\n${text.slice(0, 3000)}`;
```
改为：
```javascript
const prompt = `一句话总结（≤20字）：${text.slice(0, 2000)}`;
```

并将 `max_tokens` 从 100 改为 60：

```javascript
body: JSON.stringify({
  model: apiModel,
  messages: [{ role: "user", content: prompt }],
  max_tokens: 60,
  temperature: 0.3
})
```

---

### Task 4: sidepanel.js 事件委托重构

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.js`

- [ ] **Step 1: 删除 render() 中遍历绑定事件的 forEach 代码块**

删除 `render()` 函数中从 `// Attach event listeners to card elements` 开始到 forEach 结束的全部代码（约第 143-222 行）。

- [ ] **Step 2: 在 setupEventListeners 中添加事件委托**

在 `setupEventListeners` 函数尾部新增：

```javascript
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
});

// 事件委托: annotation 编辑（使用 focusout 替代 blur）
clippingsList.addEventListener("focusout", (e) => {
  if (e.target.closest(".annotation-input")) {
    const input = e.target.closest(".annotation-input");
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
  }
});

// 事件委托: 点击 annotation-display 切换到编辑模式
clippingsList.addEventListener("click", (e) => {
  const display = e.target.closest(".annotation-display");
  if (!display) return;
  const card = display.closest(".clipping-card");
  if (!card) return;
  const input = card.querySelector(".annotation-input");
  if (input) {
    display.style.display = "none";
    input.style.display = "block";
    input.focus();
  }
});

// 事件委托: annotation input 回车保存
clippingsList.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && e.target.closest(".annotation-input")) {
    e.preventDefault();
    e.target.blur();
  }
});
```

---

### Task 5: UI 优化（简约精致）

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\styles.css`
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.html`
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.js`

- [ ] **Step 1: 重写 styles.css 为简约精致风格**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
  font-size: 14px;
  color: #1e293b;
  background: #f1f5f9;
  line-height: 1.6;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo {
  font-size: 17px;
  font-weight: 700;
  color: #4f46e5;
  letter-spacing: -0.3px;
}

.header-actions {
  display: flex;
  gap: 2px;
}

.icon-btn {
  background: none;
  border: none;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 16px;
  color: #64748b;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: #f1f5f9;
  color: #4f46e5;
  transform: scale(1.05);
}

/* Search */
.search-bar {
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.search-bar input {
  width: 100%;
  padding: 8px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
  background: #f8fafc;
}

.search-bar input::placeholder {
  color: #94a3b8;
}

.search-bar input:focus {
  border-color: #4f46e5;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

/* Clippings list */
.clippings-list {
  padding: 10px;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 60px 24px;
  color: #94a3b8;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 14px;
  color: #94a3b8;
}

.empty-hint {
  font-size: 12px;
  margin-top: 10px;
  color: #cbd5e1;
  line-height: 1.6;
}

.empty-hint kbd {
  padding: 2px 7px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  font-size: 11px;
  font-family: inherit;
  color: #64748b;
}

/* Clipping card */
.clipping-card {
  background: #fff;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 10px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.clipping-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  border-color: #e2e8f0;
}

.clipping-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.clipping-source {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  min-width: 0;
}

.clipping-source > div:first-child {
  font-weight: 500;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clipping-source a {
  color: #4f46e5;
  text-decoration: none;
  font-size: 11px;
}

.clipping-source a:hover {
  text-decoration: underline;
}

.clipping-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

/* Summary text */
.clipping-summary {
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 10px;
  line-height: 1.6;
  word-break: break-word;
}

.clipping-summary .summary-label {
  font-size: 10px;
  color: #4f46e5;
  background: #eef2ff;
  padding: 1px 7px;
  border-radius: 4px;
  margin-right: 6px;
  font-weight: 600;
  vertical-align: middle;
}

/* Expandable raw text */
.clipping-raw {
  margin-bottom: 10px;
}

.raw-toggle {
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.15s ease;
}

.raw-toggle:hover {
  color: #4f46e5;
}

.raw-text {
  font-size: 13px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  display: none;
  line-height: 1.6;
}

.raw-text.visible {
  display: block;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Annotation area */
.clipping-annotation {
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.annotation-display {
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  transition: color 0.15s ease;
  padding: 2px 0;
}

.annotation-display:hover {
  color: #4f46e5;
}

.annotation-label {
  color: #94a3b8;
  font-size: 12px;
  white-space: nowrap;
}

.annotation-input {
  width: 100%;
  padding: 8px 12px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  resize: vertical;
  min-height: 44px;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.annotation-input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

/* Card actions */
.clipping-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
  color: #94a3b8;
  transition: all 0.2s ease;
  line-height: 1;
}

.action-btn:hover {
  background: #f1f5f9;
  color: #475569;
  transform: scale(1.1);
}

.action-btn.delete:hover {
  color: #ef4444;
  background: #fef2f2;
}

.action-btn.copy:hover {
  color: #4f46e5;
  background: #eef2ff;
}

/* Settings panel */
.settings-panel {
  padding: 20px 16px;
}

.settings-panel h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1e293b;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 9px 12px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-group input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.btn {
  width: 100%;
  padding: 10px 16px;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.15s ease;
}

.btn:hover {
  background: #4338ca;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
}

.btn:active {
  transform: translateY(0);
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #1e293b;
  box-shadow: none;
  transform: none;
}

.config-status {
  font-size: 12px;
  margin-top: 8px;
  text-align: center;
}

.config-status.success {
  color: #16a34a;
}

.config-status.error {
  color: #dc2626;
}

/* Hidden utility */
.hidden {
  display: none !important;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 5px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Summary error */
.summary-error {
  color: #dc2626;
  font-size: 13px;
  cursor: pointer;
}

.summary-error:hover {
  text-decoration: underline;
}
```

- [ ] **Step 2: 修改 sidepanel.html 中空状态文本样式微调**

将空的 `<kbd>Alt+C</kbd>` 标签部分（可选优化，不必须改动）。

- [ ] **Step 3: 在 sidepanel.js 中 renderCard 使用事件委托（已有），只需确认删除旧的 forEach 事件绑定代码**

此步骤已在 Task 4 中完成。

---

## 执行顺序

1. Task 1 (background.js 辅助函数 + 并发修复) — 独立性最高，优先
2. Task 2 (模型名可配置) — 依赖 Task 1 的辅助函数模式，第二
3. Task 3 (AI 总结加速) — 纯 background.js 改动，第三
4. Task 4 (事件委托) — sidepanel.js 重构，第四
5. Task 5 (UI 优化) — styles.css 覆盖，最后

注意：Task 1-3 都改动 background.js，建议按顺序一次完成避免冲突。
