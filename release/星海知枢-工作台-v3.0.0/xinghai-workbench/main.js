const {
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  getAllTags,
  normalizePath,
  setIcon,
} = require("obsidian");

const WORKBENCH_VIEW = "xinghai-workbench-view";
const SIDEBAR_VIEW = "xinghai-workbench-sidebar";

const DEFAULT_SETTINGS = {
  dailyFolder: "30-复盘沉淀/日记",
  weeklyFolder: "30-复盘沉淀/周复盘",
  defaultFocusMinutes: 25,
  focusTarget: "整理今日三件事",
  focus: null,
  focusSecondsByDay: {},
};

const CONSTELLATION = [
  { label: "00-Wiki入口", path: "00-Wiki入口", x: 50, y: 43, center: true },
  { label: "10-主题知识", path: "10-主题知识", x: 27, y: 23 },
  { label: "20-工作流模板", path: "20-工作流模板", x: 73, y: 23 },
  { label: "30-复盘沉淀", path: "30-复盘沉淀", x: 79, y: 69 },
  { label: "80-系统资源", path: "80-系统资源", x: 22, y: 66 },
  { label: "90-资料收件箱", path: "90-资料收件箱", x: 50, y: 79 },
  { label: "微信公众号文章", path: "微信公众号文章", x: 43, y: 91, small: true },
  { label: "Clippings", path: "Clippings", x: 57, y: 91, small: true },
  { label: "outputs", path: "outputs", x: 83, y: 82, small: true },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function displayDate(date = new Date()) {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function isoWeekKey(date = new Date()) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${pad(week)}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${minutes}分钟`;
}

function parseTasks(content) {
  return content.split("\n").map((line, lineNumber) => {
    const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (!match) return null;
    return { lineNumber, completed: match[1].toLowerCase() === "x", text: match[2].trim() };
  }).filter(Boolean);
}

function parseTodayTasks(content) {
  const lines = content.split("\n");
  let sectionStart = -1;
  let sectionEnd = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^##\s+今日三件事\s*$/.test(lines[index])) {
      sectionStart = index + 1;
      continue;
    }
    if (sectionStart >= 0 && /^#{1,2}\s+/.test(lines[index])) {
      sectionEnd = index;
      break;
    }
  }
  if (sectionStart < 0) return [];
  return parseTasks(lines.slice(sectionStart, sectionEnd).join("\n"))
    .map((task) => ({ ...task, lineNumber: task.lineNumber + sectionStart }))
    .slice(0, 3);
}

function parseTimeline(content) {
  return content.split("\n").map((line) => {
    const match = line.match(/^\s*(?:[-*]\s+(?:\[[ xX]\]\s*)?)?(\d{1,2}:\d{2})\s+(.+)$/);
    if (!match) return null;
    return { time: match[1].padStart(5, "0"), text: match[2].trim() };
  }).filter(Boolean).sort((a, b) => a.time.localeCompare(b.time));
}

function element(parent, tag, className, text) {
  const node = parent.createEl(tag, { cls: className || undefined, text: text || undefined });
  return node;
}

function iconButton(parent, icon, label, className = "") {
  const button = element(parent, "button", `xh-icon-button ${className}`.trim());
  setIcon(button, icon);
  button.setAttr("aria-label", label);
  button.setAttr("title", label);
  return button;
}

function moduleHeader(parent, icon, title, meta = "") {
  const header = element(parent, "div", "xh-module-header");
  const heading = element(header, "div", "xh-module-heading");
  const iconEl = element(heading, "span", "xh-module-icon");
  setIcon(iconEl, icon);
  element(heading, "span", "", title);
  if (meta) element(header, "span", "xh-module-meta", meta);
  return header;
}

class TaskModal extends Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.task = "";
    this.time = "";
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("xh-modal");
    element(contentEl, "h2", "", "新增任务");
    element(contentEl, "p", "xh-muted", "任务会写入今天的日记，前三项显示在“今日三件事”。");
    new Setting(contentEl)
      .setName("任务内容")
      .addText((text) => text.setPlaceholder("例如：整理工作流模板").onChange((value) => { this.task = value.trim(); }));
    new Setting(contentEl)
      .setName("时间（可选）")
      .addText((text) => text.setPlaceholder("09:30").onChange((value) => { this.time = value.trim(); }));
    const actions = element(contentEl, "div", "xh-modal-actions");
    const cancel = element(actions, "button", "", "取消");
    cancel.addEventListener("click", () => this.close());
    const submit = element(actions, "button", "mod-cta", "添加任务");
    submit.addEventListener("click", async () => {
      if (!this.task) {
        new Notice("请输入任务内容");
        return;
      }
      await this.onSubmit({ task: this.task, time: this.time });
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class XinghaiWorkbenchView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.clockTimer = null;
    this.resizeObserver = null;
    this.mobileTab = "workbench";
  }

  getViewType() { return WORKBENCH_VIEW; }
  getDisplayText() { return "星海知枢"; }
  getIcon() { return "orbit"; }

  async onOpen() {
    this.plugin.views.add(this);
    await this.render();
    this.clockTimer = window.setInterval(() => this.updateLiveElements(), 1000);
  }

  async onClose() {
    this.plugin.views.delete(this);
    if (this.clockTimer) window.clearInterval(this.clockTimer);
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  async refresh() {
    await this.render();
  }

  updateLiveElements() {
    const now = new Date();
    const clock = this.containerEl.querySelector("[data-xh-clock]");
    if (clock) clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const date = this.containerEl.querySelector("[data-xh-date]");
    if (date) date.textContent = dateKey(now).replaceAll("-", "/");

    const focus = this.plugin.getFocusSnapshot();
    const countdown = this.containerEl.querySelector("[data-xh-countdown]");
    if (countdown) {
      countdown.textContent = focus.active
        ? `${pad(Math.floor(focus.remaining / 60))}:${pad(focus.remaining % 60)}`
        : `${this.plugin.settings.defaultFocusMinutes}:00`;
    }
    const todayTotal = this.containerEl.querySelector("[data-xh-focus-total]");
    if (todayTotal) todayTotal.textContent = `今日已专注 ${formatDuration(this.plugin.getTodayFocusSeconds())}`;
    if (focus.completed) this.plugin.completeFocusSession();
  }

  async render() {
    const container = this.containerEl;
    container.empty();
    container.addClass("xh-view-container");
    const root = element(container, "div", "xh-workbench-root");
    root.style.setProperty("--xh-runtime-starfield-dark", `url("${this.plugin.assetUrl("assets/xinghai-starfield-dark.png")}")`);
    root.style.setProperty("--xh-runtime-starfield-light", `url("${this.plugin.assetUrl("assets/xinghai-starfield-light.png")}")`);

    const tabs = element(root, "nav", "xh-mobile-tabs");
    [
      ["constellation", "orbit", "星图"],
      ["workbench", "layout-dashboard", "工作台"],
      ["calendar", "calendar-days", "日历"],
      ["related", "waypoints", "关联"],
    ].forEach(([id, icon, label]) => {
      const button = element(tabs, "button", this.mobileTab === id ? "is-active" : "");
      const iconEl = element(button, "span", "");
      setIcon(iconEl, icon);
      element(button, "span", "", label);
      button.addEventListener("click", async () => {
        this.mobileTab = id;
        if (id === "calendar" || id === "related") {
          await this.renderMobileInfo(root, id);
        } else {
          root.setAttr("data-mobile-tab", id);
        }
        tabs.querySelectorAll("button").forEach((item) => item.removeClass("is-active"));
        button.addClass("is-active");
      });
    });

    root.setAttr("data-mobile-tab", this.mobileTab);
    this.renderConstellation(root);
    await this.renderDashboard(root);
    if (this.mobileTab === "calendar" || this.mobileTab === "related") await this.renderMobileInfo(root, this.mobileTab);
    this.updateLiveElements();
  }

  renderConstellation(root) {
    const hero = element(root, "section", "xh-constellation");
    hero.setAttr("data-xh-section", "constellation");
    const canvas = element(hero, "canvas", "xh-constellation-lines");
    CONSTELLATION.forEach((node) => {
      const button = element(hero, "button", `xh-star-node${node.center ? " is-center" : ""}${node.small ? " is-small" : ""}`);
      button.style.left = `${node.x}%`;
      button.style.top = `${node.y}%`;
      button.dataset.path = node.path;
      const orb = element(button, "span", "xh-node-orb");
      if (!node.center) setIcon(orb, node.small ? "circle" : "sparkle");
      element(button, "span", "xh-node-label", node.label);
      button.addEventListener("click", () => this.plugin.openConstellationTarget(node.path));
    });

    const draw = () => this.drawConstellation(hero, canvas);
    window.requestAnimationFrame(draw);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = new ResizeObserver(draw);
    this.resizeObserver.observe(hero);
  }

  drawConstellation(hero, canvas) {
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.clearRect(0, 0, rect.width, rect.height);
    const center = CONSTELLATION[0];
    const cx = rect.width * center.x / 100;
    const cy = rect.height * center.y / 100;
    context.setLineDash([2, 5]);
    context.lineWidth = 1;
    context.strokeStyle = getComputedStyle(hero).getPropertyValue("--xh-line").trim() || "rgba(186,170,255,.75)";
    CONSTELLATION.slice(1, 6).forEach((node) => {
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(rect.width * node.x / 100, rect.height * node.y / 100);
      context.stroke();
    });
    [[5, 6], [5, 7], [3, 8]].forEach(([from, to]) => {
      context.beginPath();
      context.moveTo(rect.width * CONSTELLATION[from].x / 100, rect.height * CONSTELLATION[from].y / 100);
      context.lineTo(rect.width * CONSTELLATION[to].x / 100, rect.height * CONSTELLATION[to].y / 100);
      context.stroke();
    });
  }

  async renderDashboard(root) {
    const dashboard = element(root, "section", "xh-dashboard");
    dashboard.setAttr("data-xh-section", "workbench");
    const header = element(dashboard, "header", "xh-dashboard-header");
    const brandGroup = element(header, "div", "xh-dashboard-brand");
    const logo = element(brandGroup, "img", "xh-dashboard-logo");
    logo.src = this.plugin.assetUrl("assets/xinghai-logo.png");
    logo.alt = "星海知枢";
    const brandCopy = element(brandGroup, "div", "xh-dashboard-brand-copy");
    const titleLine = element(brandCopy, "div", "xh-title-line");
    element(titleLine, "h1", "", "星海知枢");
    element(titleLine, "span", "xh-workbench-badge", "今日工作台");
    const date = element(titleLine, "span", "xh-accent-text", dateKey().replaceAll("-", "/"));
    date.dataset.xhDate = "";
    element(brandCopy, "p", "xh-brand-tagline", "穿行知识星海，连接思考与行动");

    const clock = element(header, "div", "xh-flip-clock");
    clock.dataset.xhClock = "";
    const actions = element(header, "div", "xh-dashboard-actions");
    const addTask = element(actions, "button", "xh-action-button", "新增任务");
    const addIcon = element(addTask, "span", "");
    setIcon(addIcon, "plus");
    addTask.addEventListener("click", () => this.plugin.openTaskModal());
    const review = element(actions, "button", "xh-action-button is-secondary", "本周复盘");
    const reviewIcon = element(review, "span", "");
    setIcon(reviewIcon, "calendar-check");
    review.addEventListener("click", () => this.plugin.openWeeklyReview());

    const grid = element(dashboard, "div", "xh-module-grid");
    await this.renderFocusModule(grid);
    await this.renderProjectsModule(grid);
    await this.renderTodayModule(grid);
    await this.renderRecentModule(grid);
  }

  async renderFocusModule(grid) {
    const card = element(grid, "article", "xh-module xh-focus-module");
    moduleHeader(card, "focus", "当前专注");
    const target = element(card, "div", "xh-focus-target", this.plugin.settings.focusTarget || "整理今日三件事");
    target.setAttr("title", "在今日任务或项目中点击靶心图标可切换专注目标");
    const countdown = element(card, "div", "xh-countdown");
    countdown.dataset.xhCountdown = "";
    const progressTrack = element(card, "div", "xh-progress-track");
    const progressBar = element(progressTrack, "span", "xh-progress-bar");
    const snapshot = this.plugin.getFocusSnapshot();
    progressBar.style.width = `${snapshot.active ? snapshot.progress : 0}%`;

    const controls = element(card, "div", "xh-focus-controls");
    const durationGroup = element(controls, "div", "xh-segmented");
    [25, 50].forEach((minutes) => {
      const button = element(durationGroup, "button", this.plugin.settings.defaultFocusMinutes === minutes ? "is-active" : "", `${minutes} 分钟`);
      button.disabled = snapshot.active;
      button.addEventListener("click", async () => {
        this.plugin.settings.defaultFocusMinutes = minutes;
        await this.plugin.saveSettings();
        this.plugin.refreshAll();
      });
    });
    const start = element(controls, "button", "xh-focus-button", snapshot.active ? "结束专注" : "开始专注");
    start.addEventListener("click", () => this.plugin.toggleFocus());
    const total = element(card, "div", "xh-focus-total");
    total.dataset.xhFocusTotal = "";
  }

  async renderProjectsModule(grid) {
    const projects = await this.plugin.getActiveProjects();
    const card = element(grid, "article", "xh-module");
    moduleHeader(card, "folder-kanban", "进行中的项目", `${projects.length} 个`);
    const list = element(card, "div", "xh-project-list");
    if (!projects.length) {
      this.renderEmpty(list, "folder-plus", "暂无进行中的项目", "为项目笔记添加 type: project 与 status: active");
      return;
    }
    projects.slice(0, 3).forEach((project) => {
      const row = element(list, "div", "xh-project-row");
      const open = element(row, "button", "xh-project-main");
      element(open, "span", "xh-project-dot");
      const texts = element(open, "span", "xh-project-texts");
      element(texts, "strong", "", project.file.basename);
      element(texts, "small", "", `${project.done}/${project.total} 项完成`);
      open.addEventListener("click", () => this.plugin.openFile(project.file));
      const meter = element(row, "div", "xh-project-meter");
      const track = element(meter, "span", "xh-mini-track");
      const fill = element(track, "span", "xh-mini-fill");
      fill.style.width = `${project.progress}%`;
      element(meter, "span", "xh-project-percent", `${project.progress}%`);
      const focus = iconButton(row, "crosshair", `专注：${project.file.basename}`, "xh-project-focus");
      focus.addEventListener("click", () => this.plugin.setFocusTarget(project.file.basename));
    });
  }

  async renderTodayModule(grid) {
    const daily = await this.plugin.getDailyNote(false);
    const tasks = daily ? parseTodayTasks(await this.app.vault.read(daily)) : [];
    const card = element(grid, "article", "xh-module");
    moduleHeader(card, "list-checks", "今日三件事", `${tasks.filter((task) => task.completed).length}/3`);
    const list = element(card, "div", "xh-task-list");
    if (!tasks.length) {
      this.renderEmpty(list, "circle-dashed", "今天还没有三件事", "点击“新增任务”写入今日日记");
      return;
    }
    tasks.forEach((task) => {
      const row = element(list, "div", `xh-task-row${task.completed ? " is-complete" : ""}`);
      const toggle = element(row, "button", "xh-task-check");
      setIcon(toggle, task.completed ? "check" : "circle");
      toggle.setAttr("aria-label", task.completed ? "标记为未完成" : "标记为完成");
      toggle.addEventListener("click", () => this.plugin.toggleTask(daily, task.lineNumber));
      const text = element(row, "button", "xh-task-text", task.text);
      text.addEventListener("click", () => this.plugin.openFile(daily));
      const focus = iconButton(row, "crosshair", `专注：${task.text}`, "xh-task-focus");
      focus.addEventListener("click", () => this.plugin.setFocusTarget(task.text.replace(/^\d{1,2}:\d{2}\s+/, "")));
    });
  }

  async renderRecentModule(grid) {
    const notes = this.plugin.getRecentNotes();
    const card = element(grid, "article", "xh-module");
    moduleHeader(card, "files", "最近笔记");
    const list = element(card, "div", "xh-recent-list");
    if (!notes.length) {
      this.renderEmpty(list, "file-plus-2", "暂无最近笔记", "创建第一篇 Markdown 笔记后会显示在这里");
      return;
    }
    notes.slice(0, 4).forEach((file) => {
      const row = element(list, "button", "xh-recent-row");
      const iconEl = element(row, "span", "xh-recent-icon");
      setIcon(iconEl, "file-text");
      element(row, "span", "xh-recent-title", file.basename);
      element(row, "time", "", this.plugin.formatRelativeTime(file.stat.mtime));
      row.addEventListener("click", () => this.plugin.openFile(file));
    });
  }

  renderEmpty(parent, icon, title, description) {
    const empty = element(parent, "div", "xh-empty-state");
    const iconEl = element(empty, "span", "xh-empty-icon");
    setIcon(iconEl, icon);
    const copy = element(empty, "div", "");
    element(copy, "strong", "", title);
    element(copy, "span", "", description);
  }

  async renderMobileInfo(root, tab) {
    let panel = root.querySelector(".xh-mobile-info");
    if (panel) panel.remove();
    panel = element(root, "section", "xh-mobile-info");
    panel.setAttr("data-xh-section", tab);
    const title = element(panel, "div", "xh-mobile-info-title");
    const iconEl = element(title, "span", "");
    setIcon(iconEl, tab === "calendar" ? "calendar-days" : "waypoints");
    element(title, "h2", "", tab === "calendar" ? "日历与时间线" : "关联笔记与标签");
    const sidebar = new SidebarRenderer(this.plugin, panel);
    if (tab === "calendar") await sidebar.renderCalendarAndTimeline();
    else await sidebar.renderRelatedAndTags();
  }
}

class SidebarRenderer {
  constructor(plugin, container) {
    this.plugin = plugin;
    this.container = container;
  }

  async renderAll() {
    this.container.empty();
    this.container.addClass("xh-sidebar-root");
    await this.renderCalendarAndTimeline();
    await this.renderRelatedAndTags();
  }

  async renderCalendarAndTimeline() {
    const section = element(this.container, "section", "xh-side-section");
    const header = element(section, "div", "xh-side-header");
    element(header, "h3", "", "日历");
    const navigation = element(header, "div", "xh-calendar-nav");
    const previous = iconButton(navigation, "chevron-left", "上个月");
    const next = iconButton(navigation, "chevron-right", "下个月");
    previous.addEventListener("click", () => this.plugin.changeCalendarMonth(-1));
    next.addEventListener("click", () => this.plugin.changeCalendarMonth(1));

    const monthDate = this.plugin.calendarMonth;
    element(section, "div", "xh-calendar-month", `${monthDate.getFullYear()}年 ${monthDate.getMonth() + 1}月`);
    const calendar = element(section, "div", "xh-calendar-grid");
    ["一", "二", "三", "四", "五", "六", "日"].forEach((day) => element(calendar, "span", "xh-weekday", day));
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - offset);
    for (let index = 0; index < 42; index += 1) {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + index);
      const key = dateKey(current);
      const button = element(calendar, "button", "xh-calendar-day", String(current.getDate()));
      if (current.getMonth() !== monthDate.getMonth()) button.addClass("is-outside");
      if (key === dateKey()) button.addClass("is-today");
      if (key === this.plugin.selectedDate) button.addClass("is-selected");
      if (this.plugin.hasDailyNote(key)) button.addClass("has-note");
      button.setAttr("aria-label", `${key} 日记`);
      button.addEventListener("click", () => this.plugin.selectCalendarDate(key));
    }

    const timelineSection = element(this.container, "section", "xh-side-section xh-timeline-section");
    const timelineHeader = element(timelineSection, "div", "xh-side-subheading");
    const timelineIcon = element(timelineHeader, "span", "");
    setIcon(timelineIcon, "clock-3");
    element(timelineHeader, "h3", "", "今日时间线");
    const timeline = element(timelineSection, "div", "xh-timeline");
    const note = await this.plugin.getDailyNoteByKey(this.plugin.selectedDate, false);
    const items = note ? parseTimeline(await this.plugin.app.vault.read(note)) : [];
    if (!items.length) {
      const empty = element(timeline, "div", "xh-side-empty", "日记中暂无带时间的事项");
      empty.setAttr("title", "示例：- [ ] 09:30 产品方案评审");
    } else {
      items.slice(0, 6).forEach((item) => {
        const row = element(timeline, "button", "xh-timeline-row");
        element(row, "span", "xh-timeline-dot");
        element(row, "time", "", item.time);
        element(row, "span", "", item.text);
        row.addEventListener("click", () => this.plugin.openFile(note));
      });
    }
  }

  async renderRelatedAndTags() {
    const relatedSection = element(this.container, "section", "xh-side-section");
    const relatedHeader = element(relatedSection, "div", "xh-side-subheading");
    const relatedIcon = element(relatedHeader, "span", "");
    setIcon(relatedIcon, "waypoints");
    element(relatedHeader, "h3", "", "关联笔记");
    const graph = element(relatedSection, "div", "xh-related-graph");
    const related = this.plugin.getRelatedNotes();
    const center = element(graph, "button", "xh-related-center", related.center || "星海知枢");
    if (related.file) center.addEventListener("click", () => this.plugin.openFile(related.file));
    const fallback = [
      "00-Wiki入口/00-Wiki入口.md",
      "10-主题知识/知识管理方法.md",
      "20-工作流模板/项目/知识库入口优化.md",
      "20-工作流模板/AI提示词/四步协作式简历优化与面试预演提示词.md",
      "30-复盘沉淀/周复盘/2026-W31-周复盘.md",
      "微信公众号文章/知识库设计参考.md",
      "Clippings/渐进式总结.md",
      "outputs/星海知枢功能验收.md",
    ].map((path) => this.plugin.app.vault.getAbstractFileByPath(path)).filter((file) => file instanceof TFile);
    const graphItems = [...related.items];
    fallback.forEach((file) => {
      if (graphItems.length < 6 && !graphItems.some((item) => item.path === file.path) && file.path !== related.file?.path) graphItems.push(file);
    });
    if (!graphItems.length) {
      element(graph, "div", "xh-side-empty", "打开一篇含双链的笔记后显示关联");
    } else {
      graphItems.slice(0, 6).forEach((file, index) => {
        const button = element(graph, "button", "xh-related-node", file.basename);
        const positions = [[50, 11], [82, 27], [82, 71], [50, 87], [18, 71], [18, 27]];
        const [x, y] = positions[index];
        const line = element(graph, "span", "xh-related-line");
        const dx = x - 50;
        const dy = y - 50;
        line.style.width = `${Math.hypot(dx, dy)}%`;
        line.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
        button.style.setProperty("--xh-node-x", `${positions[index][0]}%`);
        button.style.setProperty("--xh-node-y", `${positions[index][1]}%`);
        button.addEventListener("click", () => this.plugin.openFile(file));
      });
    }

    const tagsSection = element(this.container, "section", "xh-side-section");
    const tagsHeader = element(tagsSection, "div", "xh-side-subheading");
    const tagsIcon = element(tagsHeader, "span", "");
    setIcon(tagsIcon, "tags");
    element(tagsHeader, "h3", "", "标签");
    const tags = element(tagsSection, "div", "xh-tags");
    const tagItems = this.plugin.getTopTags();
    if (!tagItems.length) element(tags, "span", "xh-side-empty", "暂无标签");
    tagItems.slice(0, 8).forEach(([tag, count]) => {
      const button = element(tags, "button", "xh-tag", `${tag} ${count}`);
      button.addEventListener("click", () => this.plugin.openTagSearch(tag));
    });
  }
}

class XinghaiSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return SIDEBAR_VIEW; }
  getDisplayText() { return "星海信息栏"; }
  getIcon() { return "calendar-range"; }

  async onOpen() {
    this.plugin.views.add(this);
    await this.render();
  }

  async onClose() {
    this.plugin.views.delete(this);
  }

  async refresh() { await this.render(); }

  async render() {
    this.containerEl.empty();
    const renderer = new SidebarRenderer(this.plugin, this.containerEl);
    await renderer.renderAll();
  }
}

class XinghaiSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    element(containerEl, "h2", "", "星海知枢工作台");
    new Setting(containerEl)
      .setName("日记目录")
      .setDesc("今日三件事、日历和时间线的数据目录")
      .addText((text) => text.setValue(this.plugin.settings.dailyFolder).onChange(async (value) => {
        this.plugin.settings.dailyFolder = normalizePath(value.trim());
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("周复盘目录")
      .addText((text) => text.setValue(this.plugin.settings.weeklyFolder).onChange(async (value) => {
        this.plugin.settings.weeklyFolder = normalizePath(value.trim());
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("默认专注时长")
      .addDropdown((dropdown) => dropdown
        .addOption("25", "25 分钟")
        .addOption("50", "50 分钟")
        .setValue(String(this.plugin.settings.defaultFocusMinutes))
        .onChange(async (value) => {
          this.plugin.settings.defaultFocusMinutes = Number(value);
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        }));
  }
}

module.exports = class XinghaiWorkbenchPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    document.body.style.setProperty("--xh-runtime-starfield-dark", `url("${this.assetUrl("assets/xinghai-starfield-dark.png")}")`);
    document.body.style.setProperty("--xh-runtime-starfield-light", `url("${this.assetUrl("assets/xinghai-starfield-light.png")}")`);
    this.views = new Set();
    this.refreshTimer = null;
    this.calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    this.selectedDate = dateKey();
    this.lastContextFile = null;

    this.registerView(WORKBENCH_VIEW, (leaf) => new XinghaiWorkbenchView(leaf, this));
    this.registerView(SIDEBAR_VIEW, (leaf) => new XinghaiSidebarView(leaf, this));
    this.addRibbonIcon("orbit", "打开星海知枢", () => this.activateWorkbench());
    this.addCommand({ id: "open-xinghai-workbench", name: "打开星海知枢工作台", callback: () => this.activateWorkbench() });
    this.addCommand({ id: "add-today-task", name: "新增今日任务", callback: () => this.openTaskModal() });
    this.addCommand({ id: "open-weekly-review", name: "打开本周复盘", callback: () => this.openWeeklyReview() });
    this.addSettingTab(new XinghaiSettingTab(this.app, this));

    const refresh = () => this.scheduleRefresh();
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (file instanceof TFile) this.lastContextFile = file;
      this.scheduleRefresh();
    }));
    this.registerInterval(window.setInterval(() => {
      const snapshot = this.getFocusSnapshot();
      if (snapshot.completed) this.completeFocusSession();
    }, 1000));

    this.app.workspace.onLayoutReady(() => {
      if (!this.app.workspace.getLeavesOfType(WORKBENCH_VIEW).length) this.activateWorkbench(false);
    });
  }

  onunload() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    document.body.style.removeProperty("--xh-runtime-starfield-dark");
    document.body.style.removeProperty("--xh-runtime-starfield-light");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.focusSecondsByDay = this.settings.focusSecondsByDay || {};
  }

  assetUrl(relativePath) {
    const path = normalizePath(`.obsidian/plugins/${this.manifest.id}/${relativePath}`);
    return this.app.vault.adapter.getResourcePath(path);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  scheduleRefresh() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refreshAll(), 180);
  }

  refreshAll() {
    this.views.forEach((view) => {
      Promise.resolve(view.refresh()).catch((error) => console.error("星海知枢刷新失败", error));
    });
  }

  async activateWorkbench(reveal = true) {
    let leaf = this.app.workspace.getLeavesOfType(WORKBENCH_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: WORKBENCH_VIEW, active: true });
    }
    let sideLeaf = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW)[0];
    if (!sideLeaf && this.app.workspace.getRightLeaf) {
      sideLeaf = this.app.workspace.getRightLeaf(false);
      if (sideLeaf) await sideLeaf.setViewState({ type: SIDEBAR_VIEW, active: true });
    }
    if (reveal) {
      this.app.workspace.setActiveLeaf?.(leaf, { focus: true });
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  async ensureFolder(folderPath) {
    const normalized = normalizePath(folderPath);
    if (!normalized) return;
    const segments = normalized.split("/");
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }

  dailyPath(key = dateKey()) {
    return normalizePath(`${this.settings.dailyFolder}/${key}.md`);
  }

  async getDailyNote(create = false) {
    return this.getDailyNoteByKey(dateKey(), create);
  }

  async getDailyNoteByKey(key, create = false) {
    const path = this.dailyPath(key);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    if (!create) return null;
    await this.ensureFolder(this.settings.dailyFolder);
    return this.app.vault.create(path, `---\ntype: daily\ndate: ${key}\n---\n\n# ${key}\n\n## 今日三件事\n\n## 时间线\n`);
  }

  hasDailyNote(key) {
    return this.app.vault.getAbstractFileByPath(this.dailyPath(key)) instanceof TFile;
  }

  async appendTodayTask(task, time = "") {
    const file = await this.getDailyNote(true);
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    let heading = lines.findIndex((line) => /^##\s+今日三件事\s*$/.test(line));
    if (heading < 0) {
      lines.push("", "## 今日三件事", "");
      heading = lines.length - 2;
    }
    let insertAt = lines.length;
    for (let index = heading + 1; index < lines.length; index += 1) {
      if (/^#{1,2}\s+/.test(lines[index])) {
        insertAt = index;
        break;
      }
    }
    const prefix = /^\d{1,2}:\d{2}$/.test(time) ? `${time} ` : "";
    lines.splice(insertAt, 0, `- [ ] ${prefix}${task}`);
    await this.app.vault.modify(file, lines.join("\n"));
    new Notice("已写入今日三件事");
    this.refreshAll();
  }

  openTaskModal() {
    new TaskModal(this.app, ({ task, time }) => this.appendTodayTask(task, time)).open();
  }

  async toggleTask(file, lineNumber) {
    if (!(file instanceof TFile)) return;
    const lines = (await this.app.vault.read(file)).split("\n");
    if (!lines[lineNumber]) return;
    if (/\[ \]/.test(lines[lineNumber])) lines[lineNumber] = lines[lineNumber].replace("[ ]", "[x]");
    else if (/\[[xX]\]/.test(lines[lineNumber])) lines[lineNumber] = lines[lineNumber].replace(/\[[xX]\]/, "[ ]");
    await this.app.vault.modify(file, lines.join("\n"));
    this.refreshAll();
  }

  async openWeeklyReview() {
    const key = isoWeekKey();
    const path = normalizePath(`${this.settings.weeklyFolder}/${key}-周复盘.md`);
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      await this.ensureFolder(this.settings.weeklyFolder);
      file = await this.app.vault.create(path, `---\ntype: weekly-review\nweek: ${key}\n---\n\n# ${key} 本周复盘\n\n## 本周成果\n\n## 项目进展\n\n## 经验与问题\n\n## 下周三件事\n`);
    }
    await this.openFile(file);
  }

  async openFile(file) {
    if (!(file instanceof TFile)) return;
    this.lastContextFile = file;
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
  }

  async openConstellationTarget(path) {
    const direct = this.app.vault.getAbstractFileByPath(`${path}.md`);
    if (direct instanceof TFile) return this.openFile(direct);
    const candidates = this.app.vault.getMarkdownFiles()
      .filter((file) => file.path.startsWith(`${path}/`))
      .sort((a, b) => {
        const aIndex = /(?:^|\/)(?:00-|README|index)/i.test(a.path) ? -1 : 0;
        const bIndex = /(?:^|\/)(?:00-|README|index)/i.test(b.path) ? -1 : 0;
        return aIndex - bIndex || a.path.localeCompare(b.path, "zh-CN");
      });
    if (candidates[0]) return this.openFile(candidates[0]);
    new Notice(`“${path}”中还没有笔记`);
  }

  async getStats() {
    const notes = this.app.vault.getMarkdownFiles();
    let tasks = 0;
    for (const file of notes) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.listItems) tasks += cache.listItems.filter((item) => item.task === " ").length;
    }
    const links = Object.values(this.app.metadataCache.resolvedLinks || {})
      .reduce((total, targets) => total + Object.keys(targets).length, 0);
    return { notes: notes.length, links, tasks, focusSeconds: this.getTodayFocusSeconds() };
  }

  async getActiveProjects() {
    const projects = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      if (String(frontmatter.type || "").toLowerCase() !== "project") continue;
      if (String(frontmatter.status || "").toLowerCase() !== "active") continue;
      const tasks = parseTasks(await this.app.vault.cachedRead(file));
      const done = tasks.filter((task) => task.completed).length;
      const total = tasks.length;
      projects.push({ file, done, total, progress: total ? Math.round(done / total * 100) : 0 });
    }
    return projects.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
  }

  getRecentNotes() {
    const dailyPrefix = `${normalizePath(this.settings.dailyFolder)}/`;
    return this.app.vault.getMarkdownFiles()
      .filter((file) => !file.path.startsWith("工作台/") && !file.path.startsWith("80-系统资源/模板/") && !file.path.startsWith(dailyPrefix))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    const target = new Date(timestamp);
    if (dateKey(target) === dateKey()) return `今天 ${pad(target.getHours())}:${pad(target.getMinutes())}`;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateKey(target) === dateKey(yesterday)) return `昨天 ${pad(target.getHours())}:${pad(target.getMinutes())}`;
    return `${target.getMonth() + 1}/${target.getDate()} ${pad(target.getHours())}:${pad(target.getMinutes())}`;
  }

  async setFocusTarget(label) {
    this.settings.focusTarget = label;
    await this.saveSettings();
    this.refreshAll();
    new Notice(`当前专注：${label}`);
  }

  getFocusSnapshot() {
    const focus = this.settings.focus;
    if (!focus?.startedAt) return { active: false, completed: false, remaining: this.settings.defaultFocusMinutes * 60, progress: 0 };
    const duration = focus.durationMinutes * 60;
    const elapsed = Math.max(0, Math.floor((Date.now() - focus.startedAt) / 1000));
    return {
      active: elapsed < duration,
      completed: elapsed >= duration,
      elapsed: Math.min(elapsed, duration),
      remaining: Math.max(0, duration - elapsed),
      progress: Math.min(100, elapsed / duration * 100),
    };
  }

  getTodayFocusSeconds() {
    const stored = this.settings.focusSecondsByDay[dateKey()] || 0;
    const snapshot = this.getFocusSnapshot();
    return stored + (snapshot.active || snapshot.completed ? snapshot.elapsed : 0);
  }

  async toggleFocus() {
    const snapshot = this.getFocusSnapshot();
    if (this.settings.focus?.startedAt) {
      const key = dateKey(new Date(this.settings.focus.startedAt));
      this.settings.focusSecondsByDay[key] = (this.settings.focusSecondsByDay[key] || 0) + (snapshot.elapsed || 0);
      this.settings.focus = null;
      await this.saveSettings();
      new Notice(snapshot.completed ? "本次专注已完成" : "专注已结束，时长已记录");
    } else {
      this.settings.focus = {
        startedAt: Date.now(),
        durationMinutes: this.settings.defaultFocusMinutes,
        target: this.settings.focusTarget,
      };
      await this.saveSettings();
      new Notice(`开始 ${this.settings.defaultFocusMinutes} 分钟专注`);
    }
    this.refreshAll();
  }

  async completeFocusSession() {
    if (!this.settings.focus?.startedAt) return;
    const snapshot = this.getFocusSnapshot();
    if (!snapshot.completed) return;
    const key = dateKey(new Date(this.settings.focus.startedAt));
    this.settings.focusSecondsByDay[key] = (this.settings.focusSecondsByDay[key] || 0) + snapshot.elapsed;
    this.settings.focus = null;
    await this.saveSettings();
    new Notice("专注完成，欢迎回到星海知枢");
    this.refreshAll();
  }

  changeCalendarMonth(delta) {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + delta, 1);
    this.refreshAll();
  }

  async selectCalendarDate(key) {
    this.selectedDate = key;
    const file = await this.getDailyNoteByKey(key, true);
    this.refreshAll();
    await this.openFile(file);
  }

  getRelatedNotes() {
    const file = this.lastContextFile || this.app.workspace.getActiveFile();
    if (!(file instanceof TFile)) return { center: "星海知枢", file: null, items: [] };
    const targets = this.app.metadataCache.resolvedLinks?.[file.path] || {};
    const items = Object.keys(targets)
      .map((path) => this.app.vault.getAbstractFileByPath(path))
      .filter((item) => item instanceof TFile);
    return { center: file.basename, file, items };
  }

  getTopTags() {
    const counts = new Map();
    this.app.vault.getMarkdownFiles().forEach((file) => {
      const tags = getAllTags(this.app.metadataCache.getFileCache(file)) || [];
      tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  async openTagSearch(tag) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: "search", active: true, state: { query: `tag:${tag}` } });
  }
};
