# 星海知枢 Obsidian 主题与工作台安装说明

本 ZIP 同时包含“星海知枢”主题 `3.2.0` 和“星海知枢工作台”插件 `1.2.6`。它不是独立应用，macOS 与 Windows 使用同一份安装包。

## 安装前

1. 确认 Obsidian 版本不低于 1.9.0。
2. 备份知识库中的 `.obsidian/appearance.json`。
3. 升级用户另行备份 `.obsidian/plugins/xinghai-workbench/data.json`，其中包含目录映射和专注状态。
4. 完全退出 Obsidian。

## macOS

1. 解压 `星海知枢-Obsidian主题-v3.2.0.zip`。
2. 在 Finder 中打开知识库；看不到 `.obsidian` 时按 `Command + Shift + .`。
3. 将 `星海知枢` 文件夹复制到 `知识库/.obsidian/themes/星海知枢/`。
4. 将 `xinghai-workbench` 文件夹复制到 `知识库/.obsidian/plugins/xinghai-workbench/`。
5. 启动 Obsidian，在“设置 → 外观 → 主题”中选择“星海知枢”。
6. 在“设置 → 社区插件”中启用“星海知枢工作台”。

## Windows

1. 解压 `星海知枢-Obsidian主题-v3.2.0.zip`。
2. 在资源管理器中开启“查看 → 显示 → 隐藏的项目”。
3. 将 `星海知枢` 文件夹复制到 `知识库\.obsidian\themes\星海知枢\`。
4. 将 `xinghai-workbench` 文件夹复制到 `知识库\.obsidian\plugins\xinghai-workbench\`。
5. 启动 Obsidian，在“设置 → 外观 → 主题”中选择“星海知枢”。
6. 在“设置 → 社区插件”中启用“星海知枢工作台”。

不需要管理员权限，也不要复制到 Obsidian 程序安装目录或 `%APPDATA%`。

## 首次使用

1. 点击左侧 Ribbon 的主页图标，或运行命令“打开星海知枢工作台”。
2. 按提示设置任务、知识、文章、复盘等内容目录映射。
3. 验证“新增任务”“新增项目”“本周复盘”和 25/50 分钟专注功能。
4. 收起左右侧栏后，确认窗口左上角和右上角分别出现可执行的展开入口。

## 升级

1. 完全退出 Obsidian。
2. 备份旧插件目录中的 `data.json`。
3. 用新版 `星海知枢` 和 `xinghai-workbench` 文件覆盖对应旧目录，但保留原 `data.json`。
4. 重新打开 Obsidian，确认主题为 `3.2.0`、插件为 `1.2.6`。

## 卸载与回滚

1. 在社区插件设置中停用“星海知枢工作台”，并在外观设置中切换其他主题。
2. 完全退出 Obsidian。
3. 删除 `.obsidian/plugins/xinghai-workbench/` 和 `.obsidian/themes/星海知枢/`。
4. 重新打开 Obsidian。

卸载不会自动删除已创建的 Markdown 笔记；如需清理笔记，请由用户自行确认具体文件后操作。

## 常见问题

- 主题未出现：检查 `manifest.json` 是否直接位于 `星海知枢` 文件夹内。
- 插件未出现：检查 `main.js`、`manifest.json`、`styles.css` 是否直接位于 `xinghai-workbench` 文件夹内，然后重新加载 Obsidian。
- 工作台目录为空：进入插件设置重新配置内容目录映射。
- 更新后仍是旧版本：完全退出 Obsidian，再覆盖两个目录并重新启动。
