---
type: log
status: active
updated: 2026-08-15
---
# 重要决策

## D-001 产品只发布 Obsidian 主题

- 用户明确本次发布产品是 Obsidian 主题，不是工作台或社区插件。
- 产品运行文件仅为 `manifest.json`、`theme.css` 和 CSS 直接引用的图片。
- 已删除插件源码、工作区预设、测试知识库和工作台发布包；后续不得自行恢复。

## D-002 主题不承担功能插件职责

- 主题不创建项目、任务、专注、日历、时间线或反向链接视图。
- 主题不写入 Markdown/Properties，不读取用户内容，不包含 JavaScript。
- Obsidian 原生或其他插件提供的功能不属于本产品承诺。

## D-003 发布包采用八文件白名单

- 包根目录：`README.md`、`INSTALL.md`、安装指导 DOCX、主题操作手册 DOCX。
- 主题目录：`manifest.json`、`theme.css`、深色背景图、浅色背景图。
- 多文件或少文件均阻断发布；QA、参考图、脚本和项目记忆不进入安装包。

## D-004 跨平台交付方式

- macOS 与 Windows 使用同一个 ZIP，不生成 `.dmg`、`.pkg`、`.exe` 或 `.msi`。
- 安装位置是知识库内 `.obsidian/themes/星海知枢`，不是 Obsidian 应用程序目录。

## D-005 GitHub 更新原则

- GitHub 默认分支应反映当前纯主题项目边界。
- 版本标签必须指向与同版本主题包一致的提交；不得继续让 `v3.2.0` 指向旧工作台产品。
- Git 历史中的旧对象不等于当前版本内容；如需清除全部历史，必须单独执行受控的历史重写。
