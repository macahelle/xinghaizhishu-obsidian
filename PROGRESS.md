---
type: log
status: active
updated: 2026-08-15
---
# 项目进展

## 2026-08-15：产品边界纠正为纯主题

- 用户明确本次发布产品是 Obsidian 主题，不是工作台或社区插件。
- 已永久删除当前工作区中的 `xinghai-workbench/`、`工作台/`、`tests/`、`test-vault/`、旧工作台发布目录与 ZIP，以及主题未引用图片；未创建归档备份。
- 保留 `qa/` 和 `assets/reference/` 作为开发证据，但构建脚本不会把它们放入用户安装包。
- `theme.css` 已移除工作台视图选择器、插件运行时图片变量和强制左右侧栏宽度，避免主题干预工作台或日历布局。

## 2026-08-15：文档与发布包重建

- `README.md`、`INSTALL.md`、安装指导 DOCX 和主题操作手册 DOCX 已统一为纯主题说明。
- macOS 与 Windows 使用同一 ZIP，安装到知识库的 `.obsidian/themes/星海知枢`。
- 发布脚本改为 8 文件精确白名单，不包含插件、JavaScript、工作区、测试数据、QA 或归档内容。
- `node scripts/validate-theme.js` 通过；ZIP 使用 `unzip -t` 检查无损坏。
- 当前包：`release/星海知枢-Obsidian主题-v3.2.0.zip`。
- 当前 SHA-256：`765fc735a00449fc294bc6f23c1dd32d8b6cbd5db5535be8f4ace51fdabcfcea`。
- DOCX 已用 macOS Quick Look 做视觉确认；中文、标题、表格和正文可读。未进行新的 Obsidian 实机界面验收。

## 待完成

- 如用户要求从 Git 历史中彻底抹除旧工作台文件，需要另行确认并执行历史重写。

## 2026-08-15：GitHub 更新完成

- 拉取并核查了远程新增提交，确认用户已在 GitHub 手动删除 `AGENTS.md`、`MEMORY_INDEX.md`、`PROJECT_CONTEXT.md`、测试库、测试脚本和插件目录。
- 变基时保留这些远程删除，没有再次恢复用户删除的文件。
- 纯主题发布提交 `4963dc7` 已推送到 `origin/main`。
- 远程 `v3.2.0` 标签已从旧工作台提交校正到纯主题提交 `4963dc7`。
- GitHub API 核查显示当前没有独立的 `v3.2.0` Release 页面或旧附件；本次更新内容以仓库文件和 Git 标签发布。
