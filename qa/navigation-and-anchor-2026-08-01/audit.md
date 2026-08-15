---
type: qa
status: blocked
updated: 2026-08-01
---
# 主页返回与视觉锚点复核

## 视觉基准

- 唯一基准：`assets/reference/obsidian-workbench-target-v2.png`。
- 用户本轮提供图片与基准文件 SHA-256 一致：`8048d9c009f8d66e1e0119fbc63bfa835f8811000efd88e3788ebc28912b4401`。
- Logo 位置和 Logo 资产未修改。

## 可测量结构

| 项目 | 参考结构 | 当前实现 | 结论 |
|---|---|---|---|
| 中心星球 | 独立正圆实体星球，文字居中 | 112 × 112 按钮包围 96 × 96 实体圆球，文字绝对居中 | DOM 与紧凑窗口可见结构通过，1229 × 768 待复核 |
| 翻页时钟 | 小时卡、独立冒号、分钟卡 | 两个 `.xh-flip-card` 与一个 `.xh-flip-separator` | DOM 与紧凑窗口可见结构通过，1229 × 768 待复核 |
| 主页返回 | 左侧 Ribbon 红圈位置，一键返回主页 | Ribbon 主操作区末位 `home` 图标，提示为“返回星海知枢主页” | 实机交互通过 |

## 实机证据

- `01-secondary-page-home-button.jpeg`：从中心星球进入 `00-Wiki入口` 二级笔记，主页图标仍可见。
- `02-returned-primary-workbench.jpeg`：点击主页图标后返回原有一级工作台。
- `04-light-contrast-fixed.jpeg`：浅色主题下中心星球标签对比度修正。
- `05-dark-final-workbench.jpeg`：深色主题最终紧凑窗口状态。

## 自动验证

- `node --check xinghai-workbench/main.js`：通过。
- `node tests/plugin-core.test.js`：9 项断言通过。
- `node tests/validate-package.js`：8 个 JSON、2 个 CSS、11 条测试库路径通过。
- 源码与测试库 `main.js`、`styles.css` 哈希一致。

## 阻断项

- 当前 Computer Use 截图窗口为 984 × 768，不能替代 1229 × 768 同视口截图。
- 移动端布局本轮未重新截图。
- 因以上两项，最终设计 QA 保持 `blocked`，不得生成新推荐安装包或安装到正式 Tmac。
