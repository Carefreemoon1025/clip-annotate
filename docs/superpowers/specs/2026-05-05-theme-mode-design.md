# 文摘 - 主题模式（护眼/黑暗）设计

## 概述

为 Chrome 扩展"文摘"增加护眼模式和黑暗模式，通过 CSS 自定义属性实现三套主题切换。

## 方案

CSS 自定义属性重构全部颜色，body 类名控制主题，chrome.storage 持久化偏好。

## 色板

| CSS 变量 | 默认（light） | 护眼（eye-care） | 黑暗（dark） |
|----------|-------------|-----------------|-------------|
| `--bg-page` | #f1f5f9 | #f5f0e8 | #0f172a |
| `--bg-card` | #fff | #faf6ef | #1e293b |
| `--text-primary` | #1e293b | #5c4b3a | #e2e8f0 |
| `--text-secondary` | #64748b | #8b7a6a | #94a3b8 |
| `--accent` | #4f46e5 | #b8914a | #818cf8 |
| `--border` | #e2e8f0 | #e8e0d0 | #334155 |
| `--hover-bg` | #f1f5f9 | #ede7db | #1e293b |
| `--input-bg` | #f8fafc | #f5f0e6 | #1e293b |

## 交互

- 头部新增主题下拉按钮（☀️ 图标）
- 点击展开三个选项：☀️ 默认 / 🌙 护眼 / 🌑 黑暗
- 选择后切换 body.className + 存入 chrome.storage
- 打开侧边栏时自动恢复主题

## 改动文件

- `styles.css` — 颜色全部改为 var()，新增 .eye-care / .dark-mode 主题块
- `sidepanel.html` — 头部增加主题下拉菜单
- `sidepanel.js` — 主题切换逻辑 + 存储读写
