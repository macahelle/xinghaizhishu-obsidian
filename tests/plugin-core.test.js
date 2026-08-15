const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("xinghai-workbench/main.js", "utf8")
  + "\nmodule.exports.__test = { dateKey, isoWeekKey, parseTasks, parseTodayTasks, countTodaySectionTasks, displayTaskText, extractTaskRecordPath, sanitizeTaskSlug, parseTimeline, formatDuration, buildConstellationNodes, countTextUnits, solarTermForDate, extractArticleKeywords };\n";
const styles = fs.readFileSync("xinghai-workbench/styles.css", "utf8");

class Stub {}
class Plugin extends Stub {}
class ItemView extends Stub {}
class Modal extends Stub {}
class PluginSettingTab extends Stub {}
class Setting extends Stub {}
class TFile extends Stub {}

const moduleStub = { exports: {} };
const context = {
  module: moduleStub,
  exports: moduleStub.exports,
  require(id) {
    if (id !== "obsidian") return require(id);
    return {
      ItemView,
      Modal,
      Notice: Stub,
      Plugin,
      PluginSettingTab,
      Setting,
      TFile,
      getAllTags: () => [],
      normalizePath: (path) => path.replace(/\\/g, "/").replace(/\/+/g, "/"),
      setIcon: () => {},
    };
  },
  console,
  Date,
  Math,
  Object,
  Promise,
  String,
  window: { setInterval, clearInterval, setTimeout, clearTimeout },
  ResizeObserver: class {},
};

vm.runInNewContext(source, context, { filename: "xinghai-workbench/main.js" });
const helpers = moduleStub.exports.__test;

assert.deepEqual(
  JSON.parse(JSON.stringify(helpers.parseTasks("- [x] 已完成\n- [ ] 未完成\n普通文字"))),
  [
    { lineNumber: 0, completed: true, text: "已完成" },
    { lineNumber: 1, completed: false, text: "未完成" },
  ],
);

const today = helpers.parseTodayTasks("# 日记\n\n## 今日三件事\n- [ ] 09:00 第一件\n- [x] 第二件\n- [ ] 第三件\n- [ ] 第四件\n\n## 时间线\n- 10:00 会议");
assert.equal(today.length, 3);
assert.equal(today[0].lineNumber, 3);
assert.equal(today[1].completed, true);
assert.equal(helpers.countTodaySectionTasks("## 今日三件事\n- [ ] 一\n- [ ] 二\n- [ ] 三\n- [ ] 四\n\n## 时间线"), 4);
assert.equal(helpers.displayTaskText("09:00 [[20-工作流模板/任务/记录|整理模板]]"), "09:00 整理模板");
assert.equal(helpers.extractTaskRecordPath("[[20-工作流模板/任务/记录|整理模板]]"), "20-工作流模板/任务/记录.md");
assert.equal(helpers.extractTaskRecordPath("[[普通笔记]]"), "");
assert.equal(helpers.sanitizeTaskSlug("  整理 / 模板？  "), "整理-模板");

assert.deepEqual(
  JSON.parse(JSON.stringify(helpers.parseTimeline("- 14:00 深度工作\n- [ ] 09:30 方案评审\n无时间"))),
  [
    { time: "09:30", text: "方案评审" },
    { time: "14:00", text: "深度工作" },
  ],
);

assert.equal(helpers.isoWeekKey(new Date("2026-08-01T12:00:00+08:00")), "2026-W31");
assert.equal(helpers.formatDuration(3720), "1小时2分钟");
assert.equal(helpers.formatDuration(19), "19秒");
assert.equal(helpers.formatDuration(0), "0分钟");
assert.equal(helpers.solarTermForDate(new Date(2026, 7, 7, 12, 0, 0)), "立秋");
assert.equal(helpers.solarTermForDate(new Date(2026, 7, 2, 12, 0, 0)), "");
assert.deepEqual(
  JSON.parse(JSON.stringify(helpers.extractArticleKeywords({
    title: "文章验收：知识库关系设计",
    content: "# 知识库关系设计\n\n讨论跨主题索引。",
    frontmatter: {},
    tags: [],
  }))),
  ["知识库关系设计", "跨主题索引"],
);

const adaptiveNodes = helpers.buildConstellationNodes([
  "00-入口", "10-主题", "20-项目", "30-复盘", "40-客户", "50-产品",
  "60-会议", "70-阅读", "80-系统", "90-收件箱", "Clippings", "outputs",
]);
assert.equal(adaptiveNodes.length, 12);
assert.equal(adaptiveNodes[0].path, "00-入口");
assert.equal(new Set(adaptiveNodes.map((node) => node.path)).size, 12);
assert.ok(adaptiveNodes.slice(1).every((node) => node.connectTo === 0));
assert.ok(adaptiveNodes.some((node) => node.tier === 2));
assert.ok(adaptiveNodes.every((node) => !Object.prototype.hasOwnProperty.call(node, "shadowPlanet")));

assert.deepEqual(
  JSON.parse(JSON.stringify(helpers.countTextUnits("---\ntype: note\n---\n# 标题\nHello world\n[[文档|链接]]"))),
  { words: 6, characters: 14 },
);

assert.match(source, /dataset\.xhClockHours\s*=\s*""/);
assert.match(source, /dataset\.xhClockMinutes\s*=\s*""/);
assert.match(source, /addRibbonIcon\("home",\s*"返回星海知枢主页"/);
assert.match(source, /addStatusBarItem\(\)/);
assert.doesNotMatch(source, /CONSTELLATION_LAYOUT/);
assert.match(source, /CONSTELLATION_CENTER\s*=\s*\{\s*x:\s*50,\s*y:\s*52\s*\}/);
assert.match(source, /element\(hero,\s*"div",\s*"xh-shadow-planet"\)/);
assert.match(source, /quadraticCurveTo\(/);
assert.match(source, /createLinearGradient\(/);
assert.match(source, /context\.ellipse\(/);
assert.doesNotMatch(source, /setLineDash\(\[3,\s*4\]\)/);
assert.match(source, /xh-constellation-home-title",\s*"星海知枢"/);
assert.match(source, /element\(titleLine,\s*"h1",\s*"",\s*"今日工作台"\)/);
assert.match(source, /dataset\.xhSolarTerm\s*=\s*""/);
assert.match(source, /element\(header,\s*"h2",\s*"xh-module-heading"\)/);
assert.match(source, /aria-selected/);
assert.match(source, /aria-pressed/);
assert.match(source, /aria-current",\s*"date"/);
assert.match(source, /xh-capture-form-error/);
assert.match(source, /xh-sidebar-restore/);
assert.match(source, /collapseWorkspaceSidebars\(\)/);
assert.match(source, /restoreWorkspaceSidebars\(\)/);
assert.match(source, /sidebarRestoreState/);
assert.match(source, /submit\.disabled\s*=\s*true/);
assert.match(source, /label:\s*"工作任务"/);
assert.doesNotMatch(source, /"仅查看日期"/);
assert.match(source, /mountGlobalHomeBrand\(/);
assert.match(source, /element\(header,\s*"div",\s*"xh-global-home-banner"\)/);
assert.match(source, /keywords:\s*\$\{JSON\.stringify\(articleKeywords\)\}/);
assert.match(styles, /\.theme-light\s+\.xh-flip-separator\s*{[^}]*color:\s*#11131b/s);
assert.match(styles, /\.xh-module-grid\s*>\s*\.xh-module\s*{[^}]*min-height:\s*0/s);
assert.match(styles, /\.status-bar-item\.xh-vault-summary/);
assert.match(styles, /\.xh-constellation\s*{[^}]*background-size:\s*100% 100%,\s*cover/s);
assert.match(styles, /\.theme-light\s+\.xh-constellation\s*{[^}]*background-size:\s*cover/s);
assert.doesNotMatch(styles, /\.xh-action-button\.is-secondary\s*{/);
assert.match(styles, /\.xh-constellation-topbar\s*{[^}]*height:\s*38px/s);
assert.match(styles, /\.xh-sidebar-root\s*{[^}]*grid-template-rows:/s);
assert.match(styles, /\.xh-tags\s*{[^}]*overflow-y:\s*auto/s);
assert.match(styles, /\.xh-global-home-banner\s*{[^}]*inset:\s*0[^}]*pointer-events:\s*none/s);
assert.match(styles, /\.theme-light\s+\.xh-shadow-planet\s*{[^}]*--xh-shadow-planet-light|\.theme-light\s+\.xh-shadow-planet\s*{[^}]*background-image:\s*var\(--xh-shadow-planet-light\)/s);
assert.match(styles, /\.xh-workbench-root\.is-ultra-narrow\s+\.xh-width-notice/);
assert.match(styles, /button:focus-visible/);
assert.match(styles, /\.xh-form-error/);
assert.match(styles, /\.xh-sidebar-restore\.is-visible/);
assert.match(styles, /transform:\s*translateY\(-3px\)/);
assert.match(source, /root\.toggleClass\("is-ultra-narrow",\s*root\.clientWidth\s*<\s*520\)/);
assert.match(source, /\["constellation",\s*"orbit",\s*"星图"\][\s\S]*\["workbench",\s*"layout-dashboard",\s*"工作台"\][\s\S]*\["calendar",\s*"calendar-days",\s*"日历"\][\s\S]*\["related",\s*"waypoints",\s*"关联"\]/);
assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
assert.match(styles, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.xh-mobile-tabs button\s*{[^}]*min-height:\s*44px/s);
assert.match(styles, /\.xh-workbench-root\.is-ultra-narrow\s*{[^}]*overflow-x:\s*hidden/s);
assert.match(styles, /\.xh-workbench-root\.is-ultra-narrow\s+\.xh-module-grid\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
assert.match(styles, /\.xh-workbench-root\.is-ultra-narrow\s+\.xh-star-node:not\(\.is-center\)\s*{[^}]*clamp\(/s);

async function verifyLinkedTaskSync() {
  const PluginClass = moduleStub.exports;
  const plugin = Object.create(PluginClass.prototype);
  const daily = new TFile();
  daily.path = "30-复盘沉淀/日记/2026-08-01.md";
  const record = new TFile();
  record.path = "20-工作流模板/任务/记录.md";
  const contents = new Map([
    [daily.path, "## 今日三件事\n- [ ] 09:30 [[20-工作流模板/任务/记录|分类任务]]\n"],
    [record.path, "---\ntype: task\nstatus: todo\n---\n\n- [ ] 分类任务\n"],
  ]);
  plugin.app = {
    vault: {
      read: async (file) => contents.get(file.path),
      modify: async (file, value) => contents.set(file.path, value),
      getAbstractFileByPath: (path) => path === record.path ? record : null,
    },
  };
  plugin.refreshAll = async () => {};

  await plugin.toggleTask(daily, 1);
  assert.match(contents.get(daily.path), /- \[x\] 09:30/);
  assert.match(contents.get(record.path), /^status: done$/m);
  assert.match(contents.get(record.path), /- \[x\] 分类任务/);

  await plugin.toggleTask(daily, 1);
  assert.match(contents.get(daily.path), /- \[ \] 09:30/);
  assert.match(contents.get(record.path), /^status: todo$/m);
  assert.match(contents.get(record.path), /- \[ \] 分类任务/);
}

async function verifySidebarRestore() {
  const PluginClass = moduleStub.exports;
  const plugin = Object.create(PluginClass.prototype);
  const leftSplit = {
    collapsed: false,
    collapse() { this.collapsed = true; },
    expand() { this.collapsed = false; },
  };
  const rightSplit = {
    collapsed: true,
    collapse() { this.collapsed = true; },
    expand() { this.collapsed = false; },
  };
  plugin.app = { workspace: { leftSplit, rightSplit } };
  plugin.settings = { sidebarRestoreState: null };
  plugin.saveSettings = async () => {};
  plugin.refreshAll = async () => {};

  await plugin.collapseWorkspaceSidebars();
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.settings.sidebarRestoreState)), { left: true, right: false });
  assert.equal(leftSplit.collapsed, true);
  assert.equal(rightSplit.collapsed, true);

  await plugin.restoreWorkspaceSidebars();
  assert.equal(leftSplit.collapsed, false);
  assert.equal(rightSplit.collapsed, true);
  assert.equal(plugin.settings.sidebarRestoreState, null);
}

verifyLinkedTaskSync()
  .then(async () => {
    await verifySidebarRestore();
    const PluginClass = moduleStub.exports;
    const plugin = Object.create(PluginClass.prototype);
    const folder = (path, children = []) => ({ path, children });
    const workTasks = folder("Work/Tasks");
    const researchArticles = folder("Research/Articles");
    plugin.app = {
      vault: {
        getRoot: () => folder("", [
          folder("Home"),
          folder("Ideas"),
          folder("Work", [workTasks]),
          folder("Research", [researchArticles]),
          folder("Archive"),
        ]),
        getMarkdownFiles: () => [],
      },
      metadataCache: { getFileCache: () => ({}), resolvedLinks: {} },
    };
    plugin.settings = { contentMappings: { task: "Work/Tasks" } };
    assert.deepEqual(JSON.parse(JSON.stringify(plugin.getFolderPaths())), ["Archive", "Home", "Ideas", "Research", "Research/Articles", "Work", "Work/Tasks"]);
    const suggestions = plugin.suggestContentMappings();
    assert.equal(suggestions.inspiration, "Ideas");
    assert.equal(suggestions.task, "Work/Tasks");
    assert.equal(suggestions.article, "Research/Articles");
    assert.equal(plugin.getMappedFolder("task"), "Work/Tasks");
    const nodes = plugin.getConstellationNodes();
    assert.equal(nodes[0].path, "Home");
    assert.deepEqual(JSON.parse(JSON.stringify(nodes.map((node) => node.path).sort())), ["Archive", "Home", "Ideas", "Research", "Work"]);

    const noteA = { path: "Work/a.md", stat: { mtime: 1 } };
    const noteB = { path: "Ideas/b.md", stat: { mtime: 2 } };
    plugin.vaultSummaryCache = new Map();
    plugin.app.vault.getMarkdownFiles = () => [noteA, noteB];
    plugin.app.vault.cachedRead = async (file) => file === noteA ? "---\ntype: task\nstatus: todo\n---\n工作 task" : "灵感 idea";
    plugin.app.metadataCache.getFileCache = (file) => ({
      frontmatter: file === noteA ? { type: "task", status: "todo" } : { type: "idea", source: "manual" },
    });
    plugin.app.metadataCache.resolvedLinks = {
      "Work/a.md": { "Ideas/b.md": 2 },
      "Ideas/b.md": { "Work/a.md": 1 },
    };
    const summary = await plugin.getVaultSummary();
    assert.equal(summary.backlinks, 3);
    assert.equal(summary.properties, 3);
    assert.equal(summary.words, 6);
    assert.equal(summary.characters, 12);
    console.log("plugin-core: all assertions passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
