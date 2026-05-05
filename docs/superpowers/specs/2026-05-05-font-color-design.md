# 文摘 - 字体颜色选择功能设计

## 概述

在设置面板中增加字体颜色选择器，6 种色号适配三个主题模式，通过 CSS 变量覆盖实现即时切换。

## 配色方案

| 色号 | 默认主题 | 护眼主题 | 黑暗主题 |
|------|---------|---------|---------|
| 默认 | #1e293b / #475569 | #5c4b3a / #7a6a5a | #e2e8f0 / #cbd5e1 |
| 石板蓝 | #334155 / #52637a | #5a6a7a / #6b7a8a | #cbd5e1 / #94a3b8 |
| 琥珀 | #92400e / #a16207 | #8b6914 / #a07d3a | #fcd34d / #fbbf24 |
| 墨绿 | #065f46 / #047857 | #5c7a5a / #6b8a6a | #6ee7b7 / #34d399 |
| 玫瑰 | #9f1239 / #be123c | #8b4a5a / #9a5a6a | #fda4af / #fb7185 |
| 紫罗兰 | #5b21b6 / #6d28d9 | #6b5a8b / #7a6a9a | #c4b5fd / #a78bfa |

每格 = primary / soft 两个色值。

## 交互

- 设置面板新增「字体颜色」区域，6 个彩色圆点 swatch
- 点击圆点 → `setFontColor(id)` → body 设 `data-font-color` → JS 读取当前主题 + 字体色 → 设置 `--text-primary` 和 `--text-soft` CSS 变量
- 切换主题时，`applyColors()` 根据当前主题重新选取对应色值
- 偏好存入 `chrome.storage.local`

## 改动文件

- `sidepanel.html` — 设置面板增加颜色选择器
- `styles.css` — 增加 swatch 样式，active 态
- `sidepanel.js` — FONT_COLORS 数据、setFontColor/applyColors 函数、存储读写
