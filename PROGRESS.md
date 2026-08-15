---
type: log
status: active
updated: 2026-08-15
---
# 项目进展

## 2026-08-15：历史阶段——产品边界纠正为纯主题（已被后续整合发布取代）

- 用户明确本次发布产品是 Obsidian 主题，不是工作台或社区插件。
- 已永久删除当前工作区中的 `xinghai-workbench/`、`工作台/`、`tests/`、`test-vault/`、旧工作台发布目录与 ZIP，以及主题未引用图片；未创建归档备份。
- 保留 `qa/` 和 `assets/reference/` 作为开发证据，但构建脚本不会把它们放入用户安装包。
- `theme.css` 已移除工作台视图选择器、插件运行时图片变量和强制左右侧栏宽度，避免主题干预工作台或日历布局。

## 2026-08-15：历史阶段——纯主题文档与发布包（已被后续整合发布取代）

- `README.md`、`INSTALL.md`、安装指导 DOCX 和主题操作手册 DOCX 已统一为纯主题说明。
- macOS 与 Windows 使用同一 ZIP，安装到知识库的 `.obsidian/themes/星海知枢`。
- 发布脚本改为 8 文件精确白名单，不包含插件、JavaScript、工作区、测试数据、QA 或归档内容。
- `node scripts/validate-theme.js` 通过；ZIP 使用 `unzip -t` 检查无损坏。
- 当前包：`release/星海知枢-Obsidian主题-v3.2.0.zip`。
- 当前 SHA-256：`765fc735a00449fc294bc6f23c1dd32d8b6cbd5db5535be8f4ace51fdabcfcea`。
- DOCX 已用 macOS Quick Look 做视觉确认；中文、标题、表格和正文可读。未进行新的 Obsidian 实机界面验收。

## 非当前发布项

- 如用户要求从 Git 历史中彻底抹除旧工作台文件，需要另行确认并执行历史重写。

## 2026-08-15：GitHub 更新完成

- 拉取并核查了远程新增提交，确认用户已在 GitHub 手动删除 `AGENTS.md`、`MEMORY_INDEX.md`、`PROJECT_CONTEXT.md`、测试库、测试脚本和插件目录。
- 变基时保留这些远程删除，没有再次恢复用户删除的文件。
- 纯主题发布提交 `4963dc7` 已推送到 `origin/main`。
- 远程 `v3.2.0` 标签已从旧工作台提交校正到纯主题提交 `4963dc7`。
- GitHub API 核查显示当前没有独立的 `v3.2.0` Release 页面或旧附件；本次更新内容以仓库文件和 Git 标签发布。

## 2026-08-15：Tmac 工作台边栏兼容修复与同步来源

- 此项最初只修复 Tmac 本地插件；用户后续明确要求后，程序文件已作为 1.2.6 整合到当前 Git 和 ZIP。
- 左右侧栏展开时使用 Obsidian 原生收起按钮；仅在对应侧栏收起、原生入口消失后显示一个补位展开按钮，展开后自动隐藏，避免同一状态出现重复功能。
- 补位按钮监听 Obsidian `layout-change`，并在启动恢复阶段与定时更新中同步状态，解决双侧栏同时收起后入口消失的问题。
- 已在 Obsidian 1.13.7 验证“双侧同时收起显示两个展开入口 → 分别展开对应侧栏 → 补位入口自动隐藏”；安装源码通过 `node --check`。
- 已以 Tmac 安装版 `1.2.6` 为源，将 `main.js`、`styles.css`、`manifest.json` 和相同资源同步到本地项目 `xinghai-workbench/`；未复制用户运行配置 `data.json`。核心程序文件与 Tmac SHA-256 完全一致。
- 经用户明确要求，`xinghai-workbench/` 程序文件已纳入 Git 和整合 ZIP；`data.json` 继续忽略且不分发。

## 2026-08-15：主题与工作台整合发布

- 当前发布边界已更新为主题 3.2.0 + `xinghai-workbench` 1.2.6，同一个 ZIP 分别安装到主题目录和插件目录。
- `README.md`、`INSTALL.md`、需求基线、视觉规格、安装指导 DOCX 和产品操作手册 DOCX 已统一为整合产品口径。
- 两份 DOCX 已重新生成并逐页视觉确认：安装指导 4 页，产品手册 5 页；中文、表格、编号和路径均无截断或重叠。
- 发布包采用 19 文件精确白名单：4 个根文档、4 个主题文件和 11 个插件文件；不含 `data.json`、测试库、QA、归档或 macOS 附加文件。
- 构建改用 `bsdtar` 写入中文文件名 UTF-8 标记，避免 Windows 解压中文目录乱码；校验脚本同时检查该标记。
- `node scripts/validate-theme.js`、插件 JavaScript 语法检查和 ZIP 完整性检查均通过。
- 当前包：`release/星海知枢-Obsidian主题-v3.2.0.zip`。
- 当前 SHA-256：`68f862fc08c16835d2b87b535e2cab0fab4666a26a7ceb60ef7bcd8ab8c27ae6`。
