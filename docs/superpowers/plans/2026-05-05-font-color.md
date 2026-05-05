# 字体颜色选择功能实现计划

**Goal:** 在设置面板添加 6 色字体选择，适配三个主题模式

**Architecture:** JS 数据驱动 + CSS 变量覆盖 + storage 持久化

**Tech Stack:** Chrome Extension, Vanilla JS, CSS3

---

### Task 1: sidepanel.js 补齐字体颜色逻辑

**Files:**
- Modify: `C:\Users\Sleep\clip-annotate\sidepanel.js`

已添加 FONT_COLORS 数据，需补齐：

1. `init()` 中调用 `loadFontColor()` + `renderSwatches()`
2. `renderSwatches()` — 生成 6 个彩色圆点插入 `#colorSwatches`
3. `setFontColor(id)` — 设 body `data-font-color` + 调用 `applyColors()` + 存 storage
4. `applyColors()` — 根据当前 body 类名（主题）和 data-font-color 找到对应色值，设 CSS 变量
5. `loadFontColor()` — 从 storage 读取并应用
6. 主题切换时联动：`setTheme()` 末尾调用 `applyColors()`

### Task 2: styles.css 已有 swatch 样式

已添加，无需改动。

### Task 3: sidepanel.html 已有 #colorSwatches 容器

已添加，无需改动。
