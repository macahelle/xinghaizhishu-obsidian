# 侧栏恢复入口与品牌对齐 QA

## 修正范围

- “收起侧栏”记录左右侧栏各自的原始状态。
- 收起后提供独立常驻的“恢复侧栏”入口，仅还原原本展开的侧栏。
- 全局 Logo 与“星海知枢”使用固定 24px 对齐盒；1.2.2 像素测量确认 Logo 边界中心仍比文字低 1.5px，1.2.3 改为上移 3px 并重新验证。

## 验证

- `node --check xinghai-workbench/main.js`：通过。
- `node tests/plugin-core.test.js`：通过；包含只恢复原本展开侧栏的状态测试。
- `node tests/validate-package.js`：8 个 JSON、2 个 CSS、11 条测试库路径、43 个同步文件和 26 个 ZIP 文件通过。
- `unzip -t release/星海知枢-工作台-v3.2.0-候选版.zip`：通过，无压缩数据错误。
- Obsidian 1.13.7 独立测试库：点击“收起侧栏”后，“恢复侧栏”常驻可见；点击恢复后左右栏重新出现、入口消失，`sidebarRestoreState` 回写为 `null`。
- 全局品牌栏：1.2.3 中 Logo/文字边界中心差 0.5px，加权视觉重心差 0.06px；品牌组合横向中心与中央工作区中心差约 0.5px。
- 正式 Tmac：未修改。

## 证据

- `01-brand-alignment-light.jpeg`：首轮证据；用户复核后判定 Logo 仍偏低，不再作为通过依据。
- `02-restore-entry-visible.jpeg`：左右栏收起后，“恢复侧栏”入口可见。
- `03-sidebars-restored.jpeg`：点击恢复后左右栏重新出现。
- `04-brand-alignment-v1.2.2.jpeg`：插件 1.2.2 正常缩放整屏证据。
- `05-brand-alignment-v1.2.2-crop.jpeg`：1.2.2 品牌栏局部放大反例；Logo 边界中心比文字低 1.5px。
- `06-brand-alignment-v1.2.3.jpeg`：1.2.3 正常缩放整屏证据。
- `07-brand-alignment-v1.2.3-crop.jpeg`：1.2.3 局部像素复测证据；加权视觉重心差 0.06px。

## 发布状态

插件版本 1.2.3。Logo 对齐和真实移动端设备证据完成前，V3.2.0 仍为候选版。
