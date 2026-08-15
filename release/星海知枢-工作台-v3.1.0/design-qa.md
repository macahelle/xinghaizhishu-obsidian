# 星海知枢最终设计 QA

## 对照信息

- source visual truth path：`assets/reference/obsidian-workbench-target-v2.png`
- implementation screenshot path：`qa/iteration-2026-08-01/final-dark-1229x768.jpeg`
- light theme screenshot path：`qa/iteration-2026-08-01/final-light-1229x768.jpeg`
- viewport：1229 × 768 桌面窗口
- source pixels：1586 × 992；等比例归一化为 1229 × 768
- implementation pixels：1229 × 768
- CSS size / density：Obsidian 桌面窗口，应用缩放 83%；最终比较按同等 1229 × 768 像素密度归一化
- state：测试库、工作台主页、深色主题；浅色主题单独做可读性与同屏复核

## Full-view comparison evidence

- 最终并排图：`qa/iteration-2026-08-01/final-reference-dark-side-by-side.jpg`
- 深色实现：`qa/iteration-2026-08-01/final-dark-1229x768.jpeg`
- 浅色实现：`qa/iteration-2026-08-01/final-light-1229x768.jpeg`
- 结果：左侧原生文件树、中央知识星图、品牌头、四个工作模块、右侧日历/时间线/关联笔记/标签全部在单屏内；模块没有跨分栏覆盖或底部裁切。

## Focused region comparison evidence

- 品牌头与四模块：`qa/iteration-2026-08-01/final-focus-brand-focus.jpg`
- 目录星图：`qa/iteration-2026-08-01/final-focus-constellation.jpg`
- 右侧信息栏：`qa/iteration-2026-08-01/final-focus-right-rail.jpg`
- 这些局部图用于检查小字号、卡片间距、星图节点、关联图标签、复选框和右栏密度；无需继续拆分更小区域。

## Required fidelity surfaces

- 字体与排版：沿用 SF Pro Text / 苹方系统栈，品牌、模块标题、正文和小标签层级清楚；1229 × 768 下无异常换行和裁切。
- 间距与布局：维持 Obsidian 原生三栏，中央采用星图 + 工作台两行、四模块 2 × 2；比例与参考图接近且不跨栏叠压。
- 颜色与视觉令牌：深色使用紫蓝星海与半透明玻璃表面；浅色使用雾蓝星云和高对比白色卡片；成功、加载、错误状态均使用语义色。
- 图像与资产：深浅星空均使用项目真实位图资产；品牌使用插件现有星轨 Logo；没有用占位图或文本符号代替参考图中的可见资产。
- 文案与内容：固定文案与参考方向一致，项目、任务、最近笔记、时间线和标签均读取测试库真实数据。日期和时间为动态内容，因此不强制匹配参考图中的示例值。
- 图标与控件：使用 Obsidian/Lucide 图标体系；目录节点、按钮、日历、复选框、加载态和失败态均有一致的尺寸与对齐。
- 响应与可访问性：1229 × 768 深浅主题同屏通过；按钮有可访问名称，任务保存时提供 `aria-busy` 和禁用态；无日记日期通过确认弹窗避免误写入。

## Comparison history

1. 早期 P1/P2：中央有效宽度、字号和行高偏小，底部存在裁切风险。
   - 修复：重算中央网格密度，将“今日已专注”移入当前专注模块标题栏。
   - 证据：`qa/iteration-2026-08-01/01-central-width-after.jpeg`；最终深浅截图均完整显示四模块。
2. 早期 P1：星河横带位置偏低、遮挡工作台视觉重心。
   - 修复：将星空背景上移到 `-178px` 并调整深浅遮罩强度。
   - 证据：`qa/iteration-2026-08-01/02-galaxy-pass.jpeg`。
3. 早期 P1：右侧关联笔记使用胶囊文字，节点拥挤。
   - 修复：改为中心星核、六向节点与放射连线，移除胶囊表面。
   - 证据：`qa/iteration-2026-08-01/03-related-graph-pass.jpeg`。
4. 早期 P2：品牌头、项目摘要、任务复选框和右栏细节与参考图层级不一致。
   - 修复：补齐项目摘要/排序、原生方形复选框、五条时间线与五个标签。
   - 证据：`qa/iteration-2026-08-01/04-details-pass.jpeg`。
5. 早期 P2：目录星图连线过弱，`10-主题知识` 缺少轨道语义。
   - 修复：增强虚线连线和光晕，为主题知识节点增加开放轨道。
   - 证据：最终目录星图局部对照图。
6. 体验 P1/P2：空日期静默创建、任务写回无反馈、专注统计贴边。
   - 修复：空日期确认弹窗；任务保存中/成功/失败反馈及失败回滚；专注统计移入标题栏。
   - 证据：实机交互复核及最终 1229 × 768 截图。

## Findings

- 无待处理 P0 / P1 / P2 问题。
- [P3] 右栏极长真实笔记名在紧凑宽度下会省略显示；按钮保留完整 `title` / 可访问名称，属于单屏密度约束下的可接受行为。
- [P3] 当前专注使用已确认的 25/50 分钟计时器，而参考图展示静态 60% 进度；这是已冻结的产品功能差异，不是视觉缺失。
- [P3] 浅色主题没有独立参考图，当前仅依据同一布局、令牌映射、可读性和单屏约束验收。

## Open Questions

- 无阻塞问题。正式 Tmac 知识库仍按既定安全边界等待用户确认后再安装。

## Implementation Checklist

- [x] 同视口全屏并排对照
- [x] 品牌/四模块局部对照
- [x] 目录星图局部对照
- [x] 右侧信息栏局部对照
- [x] 深色主题 1229 × 768
- [x] 浅色主题 1229 × 768
- [x] 空日记确认、任务反馈、专注统计裁切复核
- [x] 核心逻辑、JavaScript 语法、JSON/CSS/路径验证

## Follow-up Polish

- 后续可在移动端实机中继续校准标签式布局；不影响本次桌面工作台交付。

final result: passed
