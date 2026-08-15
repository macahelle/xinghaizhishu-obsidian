# 星海知枢星图轨迹与独立暗面星球 QA

> 2026-08-15 状态更新：用户体验审计中的发布包漂移、窄屏裁切、表单错误恢复和无障碍语义等 P0/P1/P2 已整改并完成桌面实机回归，详见 `qa/user-ux-remediation-2026-08-15/remediation-report.md`。真实移动端设备证据尚缺，因此综合发布 QA 仍为 `blocked`。

## 对照信息

- source visual truth path：`qa/constellation-orbit-remediation-2026-08-02/user-reference.png`
- before implementation path：`qa/constellation-orbit-remediation-2026-08-02/before-light-1229x768.png`
- implementation screenshot path：`qa/constellation-orbit-remediation-2026-08-02/after-light-1229x768.png`
- dark regression screenshot path：`qa/constellation-orbit-remediation-2026-08-02/after-dark-1229x768.png`
- viewport：1229 × 768
- source pixels：用户局部参考为 2590 × 798；整改前后实机截图均为 1229 × 768
- focused region：星图区统一裁切 `744 × 368 @ (263, 0)`，按同坐标检查顶部栏、节点、星轨和暗面星球
- state：`test-vault` 工作台主页；浅色为主验收，深色为回归状态
- textual override：星图整体下移，中央顶部增加贯穿栏；连接不使用直虚线；暗面星球与一级目录解耦并优化浅色效果

## Full-view comparison evidence

- 浅色整改前后全屏并排：`qa/constellation-orbit-remediation-2026-08-02/before-vs-after-light-full.png`
- 最终浅色：`qa/constellation-orbit-remediation-2026-08-02/after-light-1229x768.png`
- 最终深色：`qa/constellation-orbit-remediation-2026-08-02/after-dark-1229x768.png`
- 结果：星图下移后工作台仍从原位置开始，四宫格、右侧日历和底部全库汇总均完整；没有引入重叠或裁切。

## Focused region comparison evidence

- 浅色整改前后星图区并排：`qa/constellation-orbit-remediation-2026-08-02/before-vs-after-light-constellation.png`
- 最终深浅星图区并排：`qa/constellation-orbit-remediation-2026-08-02/light-vs-dark-constellation.png`
- 结果：中央顶部出现 38px 连续栏，左侧与窗口工具栏同高、右端在日历边界停止；中心和外围目录节点整体下移。
- 结果：全部连接从机械直虚线改为带不同弯曲方向的连续星轨，拥有低透明柔光外轨、细内轨和少量星点，不再出现规则点划节奏。
- 结果：暗面星球位于左上独立装饰层；`10-主题知识`拥有自己的普通紫色目录节点，二者没有共用容器、标签或点击区域。

## Required fidelity surfaces

- 字体与排版：目录标签字体、字号、字重、截断和中心标题未修改；下移后文字无碰撞或裁切。
- 间距与布局：38px 顶栏贯穿中央星图并在日历边界结束；中心纵坐标由 43% 调整为 52%，下方工作台几何保持不变。
- 颜色与视觉令牌：顶栏沿用 Obsidian 深浅标题栏背景；浅色星轨为低饱和蓝紫，深色为弱发光紫蓝，均保持足够对比但不压过中心星球。
- 图像质量与资产：暗面星球使用从参考局部提取的 150 × 140 RGBA 位图，深浅主题分别使用独立材质；实机缩放清晰，透明边缘无方形底。
- 文案与内容：目录名称、中心标题、工作台内容和按钮文案均未修改。
- 交互与可访问性：目录节点仍为原生按钮；独立星球为 `aria-hidden`、无 `data-path` 和点击事件。实机打开 `10-主题知识` 后可通过 Ribbon 返回主页。
- 响应与边界：1229 × 768 深浅主题均完成实机检查；移动端隐藏新增顶栏，移动端实机截图仍属于正式发布门禁。

## Comparison history

1. P1：整改前星图从中央视图顶边直接开始，中心纵坐标为 43%，缺少与左侧窗口工具栏贯通的顶部栏。
   - 修复：增加 38px 顶栏，并把运行时星图中心及所有轨道节点整体下移到 52%。
   - 复核：浅色前后并排显示顶部留白完整，右端与日历边界衔接，工作台位置未改变。
2. P1：整改前 Canvas 使用 `[3, 4]` 固定直虚线从中心连接全部目录，视觉机械。
   - 修复：按节点序号生成交替曲率的二次贝塞尔曲线，使用柔光外轨、细实线内轨和三个稀疏轨道星点。
   - 复核：深浅主题星轨均为连续弧线，不存在规则直虚线。
3. P1：整改前 `shadowPlanet: index === 0` 把暗面星球绑定到排序后的第一个目录，当前恰好是 `10-主题知识`。
   - 修复：移除该数据字段和目录特殊样式，新增独立 `aria-hidden` 装饰层并使用深浅 RGBA 星球资产。
   - 复核：浅色图中暗面星球和 `10-主题知识` 普通节点明显分离；实机目录打开和主页返回闭环通过。
4. 首次整改后截图阶段曾被 macOS 锁屏阻断，QA 保持 `blocked`；解锁后重新加载并重新捕获全部证据，本报告未沿用锁屏前结论。

## Findings

- [已通过] 顶部贯穿栏、星图整体下移、自然弧形星轨和独立暗面星球符合本轮明确要求。
- [已通过] 浅色暗面星球具有暗部渐变、边缘背光、外环和伴星层次，未退化成无质感黑圆。
- [已通过] 深色回归无接缝、重叠、裁切或可读性问题。
- [已通过] `10-主题知识` 点击进入和 Ribbon 返回主页闭环正常。
- [P3] 无本轮遗留视觉项。

## Validation evidence

- `node --check xinghai-workbench/main.js`：通过。
- `node --check test-vault/.obsidian/plugins/xinghai-workbench/main.js`：通过。
- `node --test tests/plugin-core.test.js`：55 项断言通过。
- `node tests/validate-package.js`：8 个 JSON、2 个 CSS 和 11 条测试库路径通过。
- 插件源码与 `test-vault` 的 JS、CSS、深浅星球资产逐字节一致。
- Obsidian 1.13.4 可访问性树仍识别全部一级目录节点；暗面星球不产生额外按钮或目录标签。

## Implementation Checklist

- [x] 保存用户参考和整改前 1229 × 768 浅色基线
- [x] 顶部贯穿栏与星图下移实现
- [x] 直虚线替换为自然弧形星轨
- [x] 暗面星球与动态一级目录解耦
- [x] 生成并同步深浅主题透明星球资产
- [x] 浅色前后同坐标并排检查
- [x] 深色主题全屏与局部回归
- [x] 目录打开与主页返回交互验证
- [x] 语法、55 项断言、包结构和同步检查
- [ ] 移动端实机截图仍是正式发布门禁

component visual result: passed

overall product/release result: blocked（仅剩真实移动端设备证据门禁）
