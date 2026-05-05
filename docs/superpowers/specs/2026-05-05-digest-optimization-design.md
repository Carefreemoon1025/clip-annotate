# 文摘 (clip-annotate) 优化设计

## 概述

对 Chrome 扩展"文摘"进行代码质量、UI 和性能优化。项目功能：网页划线抄录，自动 AI 总结，侧边栏管理。

## 改动范围

三个文件：`background.js`、`sidepanel.js`、`styles.css`

## 1. 代码修复

### 1.1 并发 Bug（background.js）
- **问题**：`saveClipping` 中短文本（≤100字）在 unshift 后另起一次 `storage.get/set`，两次异步操作间可能被其他写入覆盖
- **修复**：在同一个 `storage.get` 回调内完成 unshift + set + 短文本 summary 写入

### 1.2 事件委托（sidepanel.js）
- **问题**：`render()` 每次遍历 DOM 用 `querySelector` 逐个绑定事件，O(n) DOM 查询 + 重复绑定
- **修复**：在 `clippingsList` 容器上用事件委托处理 copy、delete、toggle raw、annotation click、retry summary

### 1.3 模型名可配置
- **问题**：`deepseek-v4-flash` 硬编码
- **修复**：设置面板增加模型名输入框，storage 存储，background 读取使用

### 1.4 抽取辅助函数（background.js）
- **问题**：updateAnnotation/deleteClipping/retrySummary 重复 `storage.get/set` 模式
- **修复**：抽取 `getClippings()` 和 `saveClippings()` 两个 Promise 封装函数

## 2. AI 总结加速

优化提示词缩短 + 降低 max_tokens：

| 项目 | 当前值 | 优化后 |
|------|--------|--------|
| prompt | "请用一句话（不超过 50 字）总结以下文字的核心内容：" | "一句话总结（≤20字）：" |
| max_tokens | 100 | 60 |
| 文本截取 | 3000 字 | 2000 字（减少传输量） |

## 3. UI 优化（简约精致）

- 颜色微调：主色从 `#3b82f6` 改为更柔和的 `#4f46e5` (indigo)，整体更温暖
- 卡片：更细腻的阴影，hover 动效，更大的圆角
- 字号层次调整：标题更突出，辅助信息更轻
- 搜索框：聚焦动效优化
- 按钮：微悬停缩放效果
- 批注区域：点击编辑的过渡动画
- 原文展开：增加平滑展开/收起动画
- 整体间距和留白优化
