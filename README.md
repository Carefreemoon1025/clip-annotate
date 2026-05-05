# 文摘 - 网页划线抄录

快速抄录网页文字并添加批注的 Chrome 浏览器扩展，长文本自动调用 AI 生成一句话总结。

## 功能

- **选中即抄录**：右键菜单或快捷键 `Alt+C` 一键捕获选中文字
- **AI 自动总结**：超过 100 字的长文本自动调用 AI 生成 ≤20 字摘要
- **批注编辑**：每条抄录支持添加个人批注，点击即可编辑
- **全文搜索**：搜索原文、标题、摘要、批注
- **三套主题**：默认 / 护眼 / 黑暗模式，持久化偏好
- **字体颜色**：6 种字体配色，适配各主题
- **导出**：支持 JSON 和 Markdown 格式导出
- **本地存储**：所有数据存储在 `chrome.storage.local`，不上传任何服务器

## 安装

1. 下载或克隆本仓库
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目文件夹

## 使用

| 操作 | 方式 |
|------|------|
| 抄录选中文字 | 右键 → 抄录选中文字 |
| 快捷键抄录 | `Alt+C`（Mac: `MacCtrl+C`） |
| 查看/管理抄录 | 点击扩展图标打开侧边栏 |
| 搜索 | 侧边栏顶部搜索框 |
| 编辑批注 | 点击卡片底部的批注区域 |
| 删除抄录 | 卡片右侧 🗑️ 按钮 |
| 导出数据 | 侧边栏 📥 按钮 |

## AI 总结配置

1. 打开侧边栏，点击 ⚙️ 设置
2. 填入 API Key（支持 OpenAI 兼容接口）
3. 默认使用 DeepSeek API：`https://api.deepseek.com`
4. 可自定义 API 地址和模型名称

支持所有兼容 OpenAI Chat Completions 格式的 API。

## 技术架构

```
clip-annotate/
├── manifest.json     # Manifest V3 配置
├── background.js     # Service Worker：右键菜单、存储、AI 调用
├── content.js        # Content Script：获取页面选中文本
├── sidepanel.html    # 侧边栏 HTML
├── sidepanel.js      # 侧边栏逻辑：渲染、搜索、主题、导出
├── styles.css        # CSS 变量 + 三套主题 + 字体颜色
└── icons/            # 扩展图标
```

- **Manifest V3** 标准
- **零框架依赖**，纯 Vanilla JS + CSS3
- **事件委托**模式处理卡片交互
- **CSS 自定义属性**实现三套主题 + 六色字体动态切换
- **chrome.storage.local** 持久化所有数据

## 权限说明

| 权限 | 用途 |
|------|------|
| `contextMenus` | 右键菜单「抄录选中文字」 |
| `storage` | 本地存储抄录数据和设置 |
| `sidePanel` | 侧边栏展示抄录列表 |
| `clipboardWrite` | 复制原文到剪贴板 |

**不申请** `tabs` 或 `activeTab` —— 扩展只在用户主动选中文字并右键/快捷键时才读取选中内容。

## 与类似项目的区别

| 特性 | 文摘 | Blinko Smart Collector | FisherAI | oneClipper |
|------|------|------------------------|----------|------------|
| 独立运行 | ✅ 无需后端 | ❌ 需 Blinko 服务 | ✅ | ❌ 需 OneNote |
| 选中文字抄录 | ✅ | ✅ | ✅ | ✅ |
| 批注功能 | ✅ | ✅ (笔记) | ❌ | ❌ |
| AI 总结 | ✅ | ✅ | ✅ | ✅ |
| 零框架 | ✅ Vanilla JS | ❌ | ❌ | ❌ |
| 主题切换 | ✅ 3 套 | ✅ | ✅ | ❌ |
| 本地存储 | ✅ | ❌ | ✅ | ❌ |

## License

MIT
