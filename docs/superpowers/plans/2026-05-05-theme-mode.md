# 主题模式实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or inline execution

**Goal:** 为文摘扩展增加护眼模式和黑暗模式主题切换

**Architecture:** CSS 自定义属性重构颜色，body 类名控制主题，chrome.storage 持久化偏好

**Tech Stack:** Chrome Extension, Vanilla JS, CSS3

---

### Task 1: styles.css 重构为 CSS 变量 + 主题定义

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\styles.css`

将 all 颜色值替换为 CSS 变量，在 `:root` 定义默认主题，新增 `.eye-care` 和 `.dark-mode` 主题块。

变量映射：

| 变量 | 默认 | 护眼 | 黑暗 |
|------|------|------|------|
| --bg-page | #f1f5f9 | #f5f0e8 | #0f172a |
| --bg-card | #fff | #faf6ef | #1e293b |
| --text-primary | #1e293b | #5c4b3a | #e2e8f0 |
| --text-secondary | #64748b | #8b7a6a | #94a3b8 |
| --accent | #4f46e5 | #b8914a | #818cf8 |
| --border | #e2e8f0 | #e8e0d0 | #334155 |
| --hover-bg | #f1f5f9 | #ede7db | #1e293b |
| --input-bg | #f8fafc | #f5f0e6 | #1e293b |
| --accent-light | #eef2ff | #f5edd6 | #1e1b4b |

### Task 2: sidepanel.html 添加主题下拉菜单

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.html`

在 `.header-actions` 中新增主题选择容器：

```html
<div class="theme-selector">
  <button class="icon-btn" id="btnTheme" title="切换主题">☀️</button>
  <div class="theme-dropdown hidden" id="themeDropdown">
    <div class="theme-option" data-theme="">☀️ 默认</div>
    <div class="theme-option" data-theme="eye-care">🌙 护眼</div>
    <div class="theme-option" data-theme="dark">🌑 黑暗</div>
  </div>
</div>
```

### Task 3: sidepanel.js 主题切换逻辑

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.js`

1. 主题切换函数 `setTheme(theme)`：设置 body.className + 存入 storage
2. 加载主题函数 `loadTheme()`：从 storage 读取上次主题并应用
3. 下拉菜单显隐控制
4. 选项点击切换主题 + 更新按钮图标
5. 点击外部关闭下拉菜单
