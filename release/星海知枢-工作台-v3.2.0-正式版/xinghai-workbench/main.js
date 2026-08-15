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
  dailyFolder: "",
  weeklyFolder: "",
  defaultFocusMinutes: 25,
  focusTarget: "整理今日三件事",
  focus: null,
  focusSecondsByDay: {},
  contentMappings: {},
  mappingConfigured: false,
  mappingPromptDismissed: false,
  sidebarRestoreState: null,
};

const CAPTURE_TYPES = {
  inspiration: {
    label: "偶发灵感记录",
    frontmatterType: "idea",
    keywords: ["灵感", "闪念", "随记", "收件箱", "inbox", "idea", "capture"],
  },
  task: {
    label: "工作任务",
    frontmatterType: "task",
    keywords: ["任务", "待办", "工作", "项目", "todo", "task", "project"],
    canAddToToday: true,
  },
  project: {
    label: "进行中的项目",
    frontmatterType: "project",
    keywords: ["项目", "工作流", "project", "projects"],
  },
  article: {
    label: "外部文章知识采集",
    frontmatterType: "article",
    keywords: ["文章", "剪藏", "采集", "微信", "clipping", "clip", "article", "readwise"],
  },
  knowledge: {
    label: "主题知识笔记",
    frontmatterType: "knowledge-note",
    keywords: ["主题", "知识", "笔记", "原子", "knowledge", "note", "zettel"],
  },
  review: {
    label: "复盘沉淀记录",
    frontmatterType: "review",
    keywords: ["复盘", "沉淀", "回顾", "日记", "review", "reflection", "journal"],
  },
  custom: {
    label: "自定义记录",
    frontmatterType: "capture",
    keywords: [],
  },
};

const REQUIRED_CAPTURE_MAPPINGS = ["inspiration", "task", "article"];

const CONSTELLATION_CENTER = { x: 50, y: 52 };

const SOLAR_TERMS = [
  "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
  "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
];

const SOLAR_TERM_MINUTES = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
  263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
];

const KEYWORD_STOP_WORDS = new Set([
  "文章", "记录", "笔记", "内容", "外部文章", "文章验收", "验收", "知识采集", "未命名", "摘录", "转载",
  "article", "notes", "note", "capture", "clipping",
]);

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

function solarTermForDate(date = new Date()) {
  const year = date.getFullYear();
  const base = Date.UTC(1900, 0, 6, 2, 5);
  for (let index = 0; index < SOLAR_TERMS.length; index += 1) {
    const moment = new Date(base + 31556925974.7 * (year - 1900) + SOLAR_TERM_MINUTES[index] * 60000);
    if (moment.getUTCMonth() === date.getMonth() && moment.getUTCDate() === date.getDate()) return SOLAR_TERMS[index];
  }
  return "";
}

function normalizeKeyword(value) {
  const keyword = String(value || "")
    .replace(/^#+/u, "")
    .replace(/^\d{4}[-_/]\d{1,2}[-_/]\d{1,2}(?:[-_ ]\d{4,6})?[-_ ]*/u, "")
    .replace(/[\[\]{}()（）<>《》“”"'`]/gu, "")
    .replace(/[\s#]+/gu, "")
    .replace(/^(?:本文|文章|讨论|关于|围绕)/u, "")
    .trim();
  if (!keyword || KEYWORD_STOP_WORDS.has(keyword.toLowerCase())) return "";
  if (keyword.length < 2 || keyword.length > 10) return "";
  return keyword;
}

function extractArticleKeywords({ title = "", content = "", frontmatter = {}, tags = [] } = {}) {
  const scored = new Map();
  const push = (value, score) => {
    const keyword = normalizeKeyword(value);
    if (!keyword) return;
    scored.set(keyword, Math.max(score, scored.get(keyword) || 0));
  };
  const explicit = Array.isArray(frontmatter.keywords)
    ? frontmatter.keywords
    : String(frontmatter.keywords || "").split(/[,，、]/u);
  explicit.forEach((value) => push(value, 100));
  tags.forEach((value) => push(value, 88));

  String(title || frontmatter.title || "")
    .replace(/^\d{4}[-_/]\d{1,2}[-_/]\d{1,2}(?:[-_ ]\d{4,6})?[-_ ]*/u, "")
    .split(/[：:—–|｜/\\·\s]+/u)
    .forEach((value) => push(value, 72));

  const headingMatches = String(content || "").match(/^#{1,3}\s+(.+)$/gmu) || [];
  headingMatches.slice(0, 4).forEach((heading, index) => {
    heading.replace(/^#{1,3}\s+/u, "")
      .split(/[：:—–|｜/\\·\s]+/u)
      .forEach((value) => push(value, 56 - index));
  });
  String(content || "")
    .replace(/^---\n[\s\S]*?\n---\s*/u, "")
    .split(/\n+/u)
    .filter((line) => line.trim() && !/^#{1,3}\s+/u.test(line))
    .slice(0, 6)
    .flatMap((line) => line.replace(/^[-*]>?\s*/u, "").split(/[。！？!?；;：:，,、]/u))
    .forEach((value) => push(value, 42));

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 2)
    .map(([keyword]) => keyword);
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
  if (total > 0 && total < 60) return `${total}秒`;
  return `${minutes}分钟`;
}

function orbitPositions(count, radiusX, radiusY, startDegrees) {
  if (!count) return [];
  if (count === 1) {
    const angle = -135 * Math.PI / 180;
    return [{
      x: CONSTELLATION_CENTER.x + Math.cos(angle) * radiusX,
      y: CONSTELLATION_CENTER.y + Math.sin(angle) * radiusY,
    }];
  }
  return Array.from({ length: count }, (_, index) => {
    const angle = (startDegrees + index * 360 / count) * Math.PI / 180;
    return {
      x: CONSTELLATION_CENTER.x + Math.cos(angle) * radiusX,
      y: CONSTELLATION_CENTER.y + Math.sin(angle) * radiusY,
    };
  });
}

function buildConstellationNodes(paths) {
  const natural = (a, b) => a.localeCompare(b, "zh-CN", { numeric: true });
  const topLevel = [...new Set(paths.filter((path) => path && !path.includes("/")))].sort(natural);
  if (!topLevel.length) return [];
  const hub = topLevel.find((folder) => /(?:^|[-_\s])00(?:[-_\s]|$)|wiki|入口|首页|home/i.test(folder)) || topLevel[0];
  const orbitPaths = topLevel.filter((folder) => folder !== hub);
  const positioned = [];

  if (orbitPaths.length <= 9) {
    const radiusX = orbitPaths.length <= 5 ? 31 : 34;
    const radiusY = orbitPaths.length <= 5 ? 28 : 31;
    orbitPositions(orbitPaths.length, radiusX, radiusY, orbitPaths.length === 4 ? -135 : -150)
      .forEach((position, index) => positioned.push({ path: orbitPaths[index], position, tier: 1 }));
  } else {
    const innerCount = Math.ceil(orbitPaths.length / 2);
    const outerCount = orbitPaths.length - innerCount;
    orbitPositions(innerCount, 27, 24, -150)
      .forEach((position, index) => positioned.push({ path: orbitPaths[index], position, tier: 1 }));
    orbitPositions(outerCount, 41, 36, -150 + (outerCount ? 180 / outerCount : 0))
      .forEach((position, index) => positioned.push({ path: orbitPaths[innerCount + index], position, tier: 2 }));
  }

  return [{
    ...CONSTELLATION_CENTER,
    center: true,
    connectTo: null,
    label: hub.split("/").pop(),
    path: hub,
    tier: 0,
  }, ...positioned.map(({ path, position, tier }, index) => ({
    ...position,
    connectTo: 0,
    dense: orbitPaths.length > 9,
    label: path.split("/").pop(),
    labelSide: position.x >= 60 ? "right" : position.x <= 40 ? "left" : "center",
    path,
    small: tier > 1,
    tier,
  }))];
}

function countTextUnits(content) {
  const plain = String(content || "")
    .replace(/^---\n[\s\S]*?\n---\s*/u, " ")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/!\[\[[^\]]+\]\]/gu, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/gu, "$2")
    .replace(/\[\[([^\]]+)\]\]/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/https?:\/\/\S+/gu, " ")
    .replace(/[#>*_~|=-]+/gu, " ");
  const han = plain.match(/\p{Script=Han}/gu) || [];
  const nonHanWords = plain
    .replace(/\p{Script=Han}/gu, " ")
    .match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  return {
    characters: (plain.match(/[^\s]/gu) || []).length,
    words: han.length + nonHanWords.length,
  };
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

function countTodaySectionTasks(content) {
  const lines = content.split("\n");
  const heading = lines.findIndex((line) => /^##\s+今日三件事\s*$/.test(line));
  if (heading < 0) return 0;
  let end = lines.length;
  for (let index = heading + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return parseTasks(lines.slice(heading + 1, end).join("\n")).length;
}

function displayTaskText(text) {
  return text
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, (_, path) => path.split("/").pop())
    .replace(/<!--\s*xh-task:[^>]+-->/g, "")
    .trim();
}

function extractTaskRecordPath(text) {
  const match = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  if (!match || !match[1].includes("/任务/")) return "";
  return normalizePath(`${match[1].replace(/\.md$/i, "")}.md`);
}

function sanitizeTaskSlug(value) {
  const slug = value
    .replace(/[\\/:*?"<>|#^\[\]？：｜＜＞＊＃＾【】]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
  return slug || "未命名任务";
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
  const heading = element(header, "h2", "xh-module-heading");
  const iconEl = element(heading, "span", "xh-module-icon");
  setIcon(iconEl, icon);
  element(heading, "span", "", title);
  if (meta) element(header, "span", "xh-module-meta", meta);
  return header;
}

class CaptureModal extends Modal {
  constructor(app, plugin, onSubmit, initialCaptureType = "task") {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
    this.content = "";
    this.captureType = CAPTURE_TYPES[initialCaptureType] ? initialCaptureType : "task";
    this.targetFolder = plugin.getMappedFolder(this.captureType);
    this.time = "";
    this.sourceUrl = "";
    this.addToToday = false;
    this.rememberFolder = true;
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("xh-capture-dialog");
    contentEl.addClass("xh-modal");
    contentEl.addClass("xh-capture-modal");
    element(contentEl, "h2", "", this.captureType === "project" ? "新增项目" : "新增内容");
    element(contentEl, "p", "xh-muted", this.captureType === "project"
      ? "首行填写项目名称，其余内容作为项目目标；保存目录由你在下方确认。"
      : "选择内容类型后，插件会按当前知识库的目录与文章关系映射保存；本次也可以改用其他目录。");
    let contentInput;
    let folderSelect;
    let timeInput;
    let submit;
    const formError = element(contentEl, "p", "xh-form-error");
    formError.id = "xh-capture-form-error";
    formError.setAttr("role", "alert");
    formError.setAttr("aria-live", "polite");
    formError.hidden = true;
    const clearError = () => {
      formError.hidden = true;
      formError.textContent = "";
      contentInput?.removeAttribute("aria-invalid");
      folderSelect?.removeAttribute("aria-invalid");
      timeInput?.removeAttribute("aria-invalid");
    };
    const showError = (message, input) => {
      formError.textContent = message;
      formError.hidden = false;
      input?.setAttribute("aria-invalid", "true");
      input?.setAttribute("aria-describedby", formError.id);
      input?.focus();
    };
    const updateSubmitState = () => {
      if (submit) submit.disabled = !this.content;
    };
    const contentSetting = new Setting(contentEl)
      .setName("记录内容")
      .setDesc("首行作为标题，其余内容写入正文")
      .addTextArea((text) => {
        contentInput = text.inputEl;
        contentInput.setAttribute("required", "");
        contentInput.setAttribute("aria-required", "true");
        text.setPlaceholder(this.captureType === "project" ? "项目名称\n项目目标（可选）" : "输入任务、灵感或文章摘要…")
          .onChange((value) => {
            this.content = value.trim();
            clearError();
            updateSubmitState();
          });
      });
    contentSetting.settingEl.addClass("xh-capture-content-setting");

    let folderDropdown;
    const mappingHint = element(contentEl, "p", "xh-capture-mapping-hint");
    const typeSetting = new Setting(contentEl)
      .setName("内容类型")
      .addDropdown((dropdown) => {
        Object.entries(CAPTURE_TYPES).forEach(([key, definition]) => dropdown.addOption(key, definition.label));
        dropdown.setValue(this.captureType).onChange((value) => {
          this.captureType = value;
          const mapped = this.plugin.getMappedFolder(value);
          this.targetFolder = mapped;
          if (folderDropdown) folderDropdown.setValue(mapped || "");
          this.updateConditionalFields(mappingHint, timeSetting, sourceSetting, todaySetting, rememberSetting);
        });
      });
    typeSetting.settingEl.addClass("xh-capture-type-setting");

    new Setting(contentEl)
      .setName("保存目录")
      .setDesc("来自智能映射；可对本次记录单独调整")
      .addDropdown((dropdown) => {
        folderDropdown = dropdown;
        folderSelect = dropdown.selectEl;
        dropdown.addOption("", "请选择文档目录");
        this.plugin.getFolderPaths().forEach((folder) => dropdown.addOption(folder, folder));
        dropdown.setValue(this.targetFolder || "").onChange((value) => { this.targetFolder = value; });
      });
    const rememberSetting = new Setting(contentEl)
      .setName("设为该类型默认目录")
      .setDesc("仅在该类型尚未建立映射时显示")
      .addToggle((toggle) => toggle.setValue(true).onChange((value) => { this.rememberFolder = value; }));

    const timeSetting = new Setting(contentEl)
      .setName("时间（可选）")
      .addText((text) => {
        timeInput = text.inputEl;
        text.setPlaceholder("09:30").onChange((value) => {
          this.time = value.trim();
          clearError();
        });
      });
    const sourceSetting = new Setting(contentEl)
      .setName("来源链接（可选）")
      .setDesc("用于外部文章采集，保存为 source 属性")
      .addText((text) => text.setPlaceholder("https://example.com/article").onChange((value) => { this.sourceUrl = value.trim(); }));
    const todaySetting = new Setting(contentEl)
      .setName("加入今日三件事")
      .setDesc("仅工作任务可选；今日最多三项")
      .addToggle((toggle) => toggle.setValue(false).onChange((value) => { this.addToToday = value; }));
    this.updateConditionalFields(mappingHint, timeSetting, sourceSetting, todaySetting, rememberSetting);

    const actions = element(contentEl, "div", "xh-modal-actions");
    const cancel = element(actions, "button", "", "取消");
    cancel.addEventListener("click", () => this.close());
    const configure = element(actions, "button", "", "配置映射");
    configure.addEventListener("click", () => {
      this.close();
      this.plugin.openContentMappingModal();
    });
    submit = element(actions, "button", "mod-cta", "创建记录");
    submit.disabled = true;
    submit.addEventListener("click", async () => {
      if (!this.content) {
        showError("请输入记录内容。", contentInput);
        return;
      }
      if (!this.targetFolder) {
        showError("该类型尚未建立映射，请选择保存目录。", folderSelect);
        return;
      }
      if (this.captureType === "task" && this.time && !/^\d{1,2}:\d{2}$/.test(this.time)) {
        showError("时间格式应为 HH:mm，例如 09:30。", timeInput);
        return;
      }
      clearError();
      submit.disabled = true;
      submit.textContent = "正在创建…";
      try {
        await this.onSubmit({
          content: this.content,
          captureType: this.captureType,
          targetFolder: this.targetFolder,
          time: this.captureType === "task" ? this.time : "",
          sourceUrl: this.captureType === "article" ? this.sourceUrl : "",
          addToToday: this.captureType === "task" && this.addToToday,
          rememberFolder: this.rememberFolder,
        });
        this.close();
      } catch (error) {
        console.error("星海知枢创建内容失败", error);
        showError("创建记录失败，请稍后重试。", contentInput);
        submit.disabled = false;
        submit.textContent = "创建记录";
      }
    });
  }

  updateConditionalFields(mappingHint, timeSetting, sourceSetting, todaySetting, rememberSetting) {
    const definition = CAPTURE_TYPES[this.captureType];
    const mapped = this.plugin.getMappedFolder(this.captureType);
    mappingHint.textContent = mapped
      ? `${definition.label} 已映射到：${mapped}`
      : `${definition.label} 尚未建立默认映射，本次必须选择保存目录。`;
    timeSetting.settingEl.toggleClass("is-hidden", this.captureType !== "task");
    todaySetting.settingEl.toggleClass("is-hidden", this.captureType !== "task");
    sourceSetting.settingEl.toggleClass("is-hidden", this.captureType !== "article");
    rememberSetting.settingEl.toggleClass("is-hidden", Boolean(mapped));
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ContentMappingModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.mappings = { ...plugin.suggestContentMappings(), ...plugin.settings.contentMappings };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("xh-modal");
    contentEl.addClass("xh-mapping-modal");
    element(contentEl, "h2", "", "建立知识库内容映射");
    element(contentEl, "p", "xh-muted", "插件已根据一级目录、文件路径、Properties、标签和文章链接关系生成建议。请确认每类内容写入哪里；以后可在设置中修改。");
    const folders = this.plugin.getFolderPaths();
    Object.entries(CAPTURE_TYPES).filter(([key]) => key !== "custom").forEach(([key, definition]) => {
      new Setting(contentEl)
        .setName(definition.label)
        .setDesc(this.mappings[key] ? `智能建议：${this.mappings[key]}` : "未找到可靠关系，请手动选择")
        .addDropdown((dropdown) => {
          dropdown.addOption("", "暂不映射");
          folders.forEach((folder) => dropdown.addOption(folder, folder));
          dropdown.setValue(this.mappings[key] || "").onChange((value) => { this.mappings[key] = value; });
        });
    });
    const actions = element(contentEl, "div", "xh-modal-actions");
    const ignore = element(actions, "button", "", "暂时忽略");
    ignore.addEventListener("click", async () => {
      this.plugin.settings.mappingPromptDismissed = true;
      await this.plugin.saveSettings();
      new Notice("已暂时忽略；新建未映射类型时会要求选择保存目录");
      this.close();
    });
    const save = element(actions, "button", "mod-cta", "保存映射");
    save.addEventListener("click", async () => {
      this.plugin.settings.contentMappings = Object.fromEntries(Object.entries(this.mappings).filter(([, folder]) => folder));
      const reviewFolder = this.plugin.settings.contentMappings.review || "";
      if (!this.plugin.settings.dailyFolder && reviewFolder) {
        this.plugin.settings.dailyFolder = this.plugin.getFolderPaths().find((folder) => folder.startsWith(`${reviewFolder}/`) && /日记|daily|journal/i.test(folder)) || reviewFolder;
      }
      if (!this.plugin.settings.weeklyFolder && reviewFolder) {
        this.plugin.settings.weeklyFolder = this.plugin.getFolderPaths().find((folder) => folder.startsWith(`${reviewFolder}/`) && /周复盘|weekly|week/i.test(folder)) || reviewFolder;
      }
      this.plugin.settings.mappingConfigured = this.plugin.hasRequiredMappings();
      this.plugin.settings.mappingPromptDismissed = false;
      await this.plugin.saveSettings();
      new Notice(this.plugin.settings.mappingConfigured ? "内容映射已建立" : "已保存部分映射；缺失类型新建时仍需选择目录");
      this.plugin.refreshAll();
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class DailyNoteConfirmModal extends Modal {
  constructor(app, key, onConfirm) {
    super(app);
    this.key = key;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("xh-modal");
    element(contentEl, "h2", "", "该日期暂无日记");
    element(contentEl, "p", "xh-muted", `${this.key} 还没有日记。只有确认后才会创建 Markdown 文件。`);
    const actions = element(contentEl, "div", "xh-modal-actions");
    const cancel = element(actions, "button", "", "取消");
    cancel.addEventListener("click", () => this.close());
    const confirm = element(actions, "button", "mod-cta", "创建并打开");
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      confirm.textContent = "正在创建…";
      try {
        await this.onConfirm();
        this.close();
      } catch (error) {
        console.error("星海知枢创建日记失败", error);
        new Notice("创建日记失败，请稍后重试");
        confirm.disabled = false;
        confirm.textContent = "创建并打开";
      }
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
    const hours = this.containerEl.querySelector("[data-xh-clock-hours]");
    const minutes = this.containerEl.querySelector("[data-xh-clock-minutes]");
    if (hours) hours.textContent = pad(now.getHours());
    if (minutes) minutes.textContent = pad(now.getMinutes());
    const clock = this.containerEl.querySelector("[data-xh-clock]");
    if (clock) clock.setAttr("aria-label", `当前时间 ${pad(now.getHours())}:${pad(now.getMinutes())}`);
    const date = this.containerEl.querySelector("[data-xh-date]");
    if (date) date.textContent = dateKey(now).replaceAll("-", "/");
    const solarTerm = this.containerEl.querySelector("[data-xh-solar-term]");
    if (solarTerm) {
      const value = solarTermForDate(now);
      solarTerm.textContent = value;
      solarTerm.toggleClass("is-hidden", !value);
    }

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
    root.style.setProperty("--xh-constellation-dark", `url("${this.plugin.assetUrl("assets/xinghai-constellation-dark.png")}")`);
    root.style.setProperty("--xh-constellation-light", `url("${this.plugin.assetUrl("assets/xinghai-constellation-light.png")}")`);
    root.style.setProperty("--xh-shadow-planet-dark", `url("${this.plugin.assetUrl("assets/xinghai-shadow-planet-dark.png")}")`);
    root.style.setProperty("--xh-shadow-planet-light", `url("${this.plugin.assetUrl("assets/xinghai-shadow-planet-light.png")}")`);

    const tabs = element(root, "nav", "xh-mobile-tabs");
    tabs.setAttr("aria-label", "工作台视图");
    tabs.setAttr("role", "tablist");
    const tabDefinitions = [
      ["constellation", "orbit", "星图"],
      ["workbench", "layout-dashboard", "工作台"],
      ["calendar", "calendar-days", "日历"],
      ["related", "waypoints", "关联"],
    ];
    tabDefinitions.forEach(([id, icon, label], index) => {
      const button = element(tabs, "button", this.mobileTab === id ? "is-active" : "");
      button.setAttr("role", "tab");
      button.setAttr("aria-controls", `xh-panel-${id}`);
      button.setAttr("aria-selected", String(this.mobileTab === id));
      button.setAttr("tabindex", this.mobileTab === id ? "0" : "-1");
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
        this.updateMobileTabs(tabs, id);
      });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...tabs.querySelectorAll('[role="tab"]')];
        const targetIndex = event.key === "Home" ? 0
          : event.key === "End" ? buttons.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[targetIndex]?.focus();
        buttons[targetIndex]?.click();
      });
    });

    const widthNotice = element(root, "div", "xh-width-notice");
    widthNotice.setAttr("role", "status");
    element(widthNotice, "span", "", "当前工作区过窄，收起侧栏可获得完整操作空间。");
    const collapse = element(widthNotice, "button", "", "收起侧栏");
    collapse.addEventListener("click", () => this.plugin.collapseWorkspaceSidebars());

    const restore = element(root, "button", "xh-sidebar-restore");
    restore.setAttr("aria-label", "恢复收起前的侧栏");
    restore.setAttr("title", "恢复收起前的侧栏");
    const restoreIcon = element(restore, "span", "");
    setIcon(restoreIcon, "panel-left-open");
    element(restore, "span", "", "恢复侧栏");
    restore.toggleClass("is-visible", Boolean(this.plugin.settings.sidebarRestoreState));
    restore.addEventListener("click", () => this.plugin.restoreWorkspaceSidebars());

    root.setAttr("data-mobile-tab", this.mobileTab);
    this.renderConstellation(root);
    await this.renderDashboard(root);
    if (this.mobileTab === "calendar" || this.mobileTab === "related") await this.renderMobileInfo(root, this.mobileTab);
    this.updateLiveElements();
  }

  renderConstellation(root) {
    const hero = element(root, "section", "xh-constellation");
    hero.id = "xh-panel-constellation";
    hero.setAttr("role", "tabpanel");
    hero.setAttr("data-xh-section", "constellation");
    const topbar = element(hero, "div", "xh-constellation-topbar");
    const home = element(topbar, "button", "xh-constellation-home");
    home.setAttr("aria-label", "返回星海知枢主页");
    home.setAttr("title", "返回星海知枢主页");
    const homeLogo = element(home, "img", "xh-constellation-home-logo");
    homeLogo.src = this.plugin.assetUrl("assets/xinghai-logo-reference.png");
    homeLogo.alt = "";
    element(home, "span", "xh-constellation-home-title", "星海知枢");
    home.addEventListener("click", () => this.plugin.activateWorkbench());
    const canvas = element(hero, "canvas", "xh-constellation-lines");
    const shadowPlanet = element(hero, "div", "xh-shadow-planet");
    shadowPlanet.setAttr("aria-hidden", "true");
    const constellation = this.plugin.getConstellationNodes();
    hero.toggleClass("is-dense", constellation.length > 10);
    constellation.forEach((node) => {
      const button = element(hero, "button", `xh-star-node${node.center ? " is-center" : ""}${node.small ? " is-small" : ""}${node.dense ? " is-dense" : ""}${node.labelSide ? ` is-${node.labelSide}-side` : ""}`);
      button.style.left = `${node.x}%`;
      button.style.setProperty("--xh-node-x", `${node.x}%`);
      button.style.top = `${node.y}%`;
      button.dataset.path = node.path;
      const orb = element(button, "span", "xh-node-orb");
      if (!node.center) setIcon(orb, node.small ? "circle" : "sparkle");
      element(button, "span", "xh-node-label", node.label);
      button.addEventListener("click", () => this.plugin.openConstellationTarget(node.path));
    });

    const draw = () => {
      this.drawConstellation(hero, canvas, constellation);
      root.toggleClass("is-ultra-narrow", root.clientWidth < 520);
    };
    window.requestAnimationFrame(draw);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = new ResizeObserver(draw);
    this.resizeObserver.observe(hero);
    this.resizeObserver.observe(root);
  }

  drawConstellation(hero, canvas, constellation) {
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
    const center = constellation[0];
    if (!center) return;
    const cx = rect.width * center.x / 100;
    const cy = rect.height * center.y / 100;
    const computed = getComputedStyle(hero);
    const lineColor = computed.getPropertyValue("--xh-line").trim() || "rgba(186,170,255,.75)";
    const accent = computed.getPropertyValue("--xh-accent").trim() || "#8a63f5";
    const accent2 = computed.getPropertyValue("--xh-accent-2").trim() || "#65cfe6";
    context.setLineDash([]);
    context.lineCap = "round";
    context.lineJoin = "round";

    context.save();
    context.globalAlpha = 0.18;
    context.lineWidth = 0.8;
    context.strokeStyle = lineColor;
    context.shadowColor = accent;
    context.shadowBlur = 8;
    [1, 1.32].forEach((scale, index) => {
      context.beginPath();
      context.ellipse(cx, cy, 58 * scale, 38 * scale, -0.08, 0, Math.PI * 2);
      context.stroke();
      if (index === 0) {
        [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((angle) => {
          const x = cx + Math.cos(angle) * 58;
          const y = cy + Math.sin(angle) * 38;
          context.beginPath();
          context.arc(x, y, 1.6, 0, Math.PI * 2);
          context.fillStyle = accent2;
          context.fill();
        });
      }
    });
    context.restore();

    const orbitNodes = constellation.slice(1).sort((a, b) => (
      Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x)
    ));
    if (orbitNodes.length > 2) {
      orbitNodes.forEach((node, index) => {
        const next = orbitNodes[(index + 1) % orbitNodes.length];
        const startX = rect.width * node.x / 100;
        const startY = rect.height * node.y / 100;
        const endX = rect.width * next.x / 100;
        const endY = rect.height * next.y / 100;
        const middleX = (startX + endX) / 2;
        const middleY = (startY + endY) / 2;
        const outwardX = middleX + (middleX - cx) * 0.12;
        const outwardY = middleY + (middleY - cy) * 0.12;
        const networkGradient = context.createLinearGradient(startX, startY, endX, endY);
        networkGradient.addColorStop(0, accent);
        networkGradient.addColorStop(0.5, accent2);
        networkGradient.addColorStop(1, accent);
        context.globalAlpha = node.tier > 1 || next.tier > 1 ? 0.1 : 0.16;
        context.lineWidth = 0.62;
        context.strokeStyle = networkGradient;
        context.shadowBlur = 0;
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(outwardX, outwardY, endX, endY);
        context.stroke();
      });
    }

    constellation.slice(1).forEach((node, index) => {
      const target = constellation[node.connectTo ?? 0] || center;
      const startX = rect.width * target.x / 100;
      const startY = rect.height * target.y / 100;
      const endX = rect.width * node.x / 100;
      const endY = rect.height * node.y / 100;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const direction = index % 2 === 0 ? 1 : -1;
      const bend = Math.min(38, distance * 0.13) * direction * (0.72 + (index % 3) * 0.12);
      const controlX = (startX + endX) / 2 - deltaY / distance * bend;
      const controlY = (startY + endY) / 2 + deltaX / distance * bend;

      const trackGradient = context.createLinearGradient(startX, startY, endX, endY);
      trackGradient.addColorStop(0, accent);
      trackGradient.addColorStop(0.48, accent2);
      trackGradient.addColorStop(1, lineColor);

      context.globalAlpha = node.tier > 1 ? 0.1 : 0.16;
      context.lineWidth = node.tier > 1 ? 3 : 4.2;
      context.strokeStyle = trackGradient;
      context.shadowColor = accent;
      context.shadowBlur = 12;
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(controlX, controlY, endX, endY);
      context.stroke();

      context.globalAlpha = node.tier > 1 ? 0.42 : 0.66;
      context.lineWidth = node.tier > 1 ? 0.8 : 1.15;
      context.strokeStyle = trackGradient;
      context.shadowBlur = 3;
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(controlX, controlY, endX, endY);
      context.stroke();

      [0.3, 0.56, 0.78].forEach((progress, particleIndex) => {
        const inverse = 1 - progress;
        const x = inverse * inverse * startX + 2 * inverse * progress * controlX + progress * progress * endX;
        const y = inverse * inverse * startY + 2 * inverse * progress * controlY + progress * progress * endY;
        const tangentX = 2 * inverse * (controlX - startX) + 2 * progress * (endX - controlX);
        const tangentY = 2 * inverse * (controlY - startY) + 2 * progress * (endY - controlY);
        const tangentLength = Math.max(1, Math.hypot(tangentX, tangentY));
        const normalX = -tangentY / tangentLength;
        const normalY = tangentX / tangentLength;
        context.globalAlpha = (node.tier > 1 ? 0.3 : 0.48) + particleIndex * 0.05;
        context.fillStyle = particleIndex === 1 ? accent2 : lineColor;
        context.beginPath();
        context.arc(x, y, particleIndex === 1 ? 1.8 : 1.25, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha *= 0.74;
        context.lineWidth = 0.7;
        context.strokeStyle = particleIndex === 1 ? accent2 : lineColor;
        context.beginPath();
        context.moveTo(x - normalX * 4.2, y - normalY * 4.2);
        context.lineTo(x + normalX * 4.2, y + normalY * 4.2);
        context.stroke();
      });
    });
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  }

  async renderDashboard(root) {
    const dashboard = element(root, "section", "xh-dashboard");
    dashboard.id = "xh-panel-workbench";
    dashboard.setAttr("role", "tabpanel");
    dashboard.setAttr("data-xh-section", "workbench");
    const header = element(dashboard, "header", "xh-dashboard-header");
    const brandGroup = element(header, "div", "xh-dashboard-brand");
    const brandCopy = element(brandGroup, "div", "xh-dashboard-brand-copy");
    const titleLine = element(brandCopy, "div", "xh-title-line");
    element(titleLine, "h1", "", "今日工作台");
    const date = element(titleLine, "span", "xh-accent-text", dateKey().replaceAll("-", "/"));
    date.dataset.xhDate = "";
    const solarTerm = element(titleLine, "span", "xh-solar-term", solarTermForDate());
    solarTerm.dataset.xhSolarTerm = "";
    solarTerm.toggleClass("is-hidden", !solarTerm.textContent);
    element(brandCopy, "p", "xh-brand-tagline", "穿行知识星海，连接思考与行动");

    const clock = element(header, "div", "xh-flip-clock");
    clock.dataset.xhClock = "";
    clock.setAttr("role", "timer");
    const hours = element(clock, "span", "xh-flip-card", pad(new Date().getHours()));
    hours.dataset.xhClockHours = "";
    element(clock, "span", "xh-flip-separator", ":");
    const minutes = element(clock, "span", "xh-flip-card", pad(new Date().getMinutes()));
    minutes.dataset.xhClockMinutes = "";
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
    const header = moduleHeader(card, "focus", "当前专注", `今日已专注 ${formatDuration(this.plugin.getTodayFocusSeconds())}`);
    const total = header.querySelector(".xh-module-meta");
    if (total) total.dataset.xhFocusTotal = "";
    const target = element(card, "div", "xh-focus-target", this.plugin.settings.focusTarget || "整理今日三件事");
    target.setAttr("title", "在今日任务或项目中点击靶心图标可切换专注目标");
    const countdown = element(card, "div", "xh-countdown");
    countdown.dataset.xhCountdown = "";
    countdown.setAttr("role", "timer");
    countdown.setAttr("aria-label", "专注剩余时间");
    const progressTrack = element(card, "div", "xh-progress-track");
    const progressBar = element(progressTrack, "span", "xh-progress-bar");
    const snapshot = this.plugin.getFocusSnapshot();
    progressBar.style.width = `${snapshot.active ? snapshot.progress : 0}%`;

    const controls = element(card, "div", "xh-focus-controls");
    const durationGroup = element(controls, "div", "xh-segmented");
    durationGroup.setAttr("role", "group");
    durationGroup.setAttr("aria-label", "专注时长");
    [25, 50].forEach((minutes) => {
      const button = element(durationGroup, "button", this.plugin.settings.defaultFocusMinutes === minutes ? "is-active" : "", `${minutes} 分钟`);
      button.setAttr("aria-pressed", String(this.plugin.settings.defaultFocusMinutes === minutes));
      button.disabled = snapshot.active;
      button.addEventListener("click", async () => {
        this.plugin.settings.defaultFocusMinutes = minutes;
        await this.plugin.saveSettings();
        this.plugin.refreshAll();
      });
    });
    const start = element(controls, "button", "xh-focus-button", snapshot.active ? "结束专注" : "开始专注");
    start.setAttr("aria-pressed", String(snapshot.active));
    start.addEventListener("click", () => this.plugin.toggleFocus());
  }

  async renderProjectsModule(grid) {
    const projects = await this.plugin.getActiveProjects();
    const card = element(grid, "article", "xh-module");
    const header = moduleHeader(card, "folder-kanban", "进行中的项目", `${projects.length} 个`);
    const addProject = iconButton(header, "plus", "新增项目", "xh-module-action");
    addProject.addEventListener("click", () => this.plugin.openProjectModal());
    const list = element(card, "div", "xh-project-list");
    if (!projects.length) {
      this.renderEmpty(list, "folder-plus", "暂无进行中的项目", "点击右上角“新增项目”创建项目笔记");
      return;
    }
    projects.slice(0, 3).forEach((project) => {
      const row = element(list, "div", "xh-project-row");
      const open = element(row, "button", "xh-project-main");
      element(open, "span", "xh-project-dot");
      const texts = element(open, "span", "xh-project-texts");
      element(texts, "strong", "", project.file.basename);
      element(texts, "small", "", project.summary || `${project.done}/${project.total} 项完成`);
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
      if (task.completed) setIcon(toggle, "check");
      toggle.setAttr("aria-label", task.completed ? "标记为未完成" : "标记为完成");
      const status = element(row, "span", "xh-task-status");
      toggle.addEventListener("click", async () => {
        if (row.hasClass("is-pending")) return;
        row.addClass("is-pending");
        toggle.disabled = true;
        toggle.setAttr("aria-busy", "true");
        status.textContent = "保存中…";
        setIcon(toggle, "loader-circle");
        try {
          const result = await this.plugin.toggleTask(daily, task.lineNumber);
          new Notice(result.completed ? "任务已完成" : "任务已恢复为待办");
        } catch (error) {
          console.error("星海知枢任务写回失败", error);
          row.removeClass("is-pending");
          row.addClass("has-error");
          toggle.disabled = false;
          toggle.removeAttribute("aria-busy");
          toggle.empty();
          if (task.completed) setIcon(toggle, "check");
          status.textContent = "保存失败";
          new Notice("任务保存失败，请稍后重试");
          window.setTimeout(() => {
            row.removeClass("has-error");
            status.textContent = "";
          }, 1800);
        }
      });
      const taskLabel = displayTaskText(task.text);
      const text = element(row, "button", "xh-task-text", taskLabel);
      text.addEventListener("click", () => this.plugin.openTaskFromDaily(task.text, daily));
      const focusLabel = taskLabel.replace(/^\d{1,2}:\d{2}\s+/, "");
      const focus = iconButton(row, "crosshair", `专注：${focusLabel}`, "xh-task-focus");
      focus.addEventListener("click", () => this.plugin.setFocusTarget(focusLabel));
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
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      element(row, "span", "xh-recent-title", frontmatter?.title || file.basename);
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
    panel.id = `xh-panel-${tab}`;
    panel.setAttr("role", "tabpanel");
    panel.setAttr("data-xh-section", tab);
    const title = element(panel, "div", "xh-mobile-info-title");
    const iconEl = element(title, "span", "");
    setIcon(iconEl, tab === "calendar" ? "calendar-days" : "waypoints");
    element(title, "h2", "", tab === "calendar" ? "日历与时间线" : "关联笔记与标签");
    const sidebar = new SidebarRenderer(this.plugin, panel);
    if (tab === "calendar") await sidebar.renderCalendarAndTimeline();
    else await sidebar.renderRelatedAndTags();
  }

  updateMobileTabs(tabs, activeId) {
    tabs.querySelectorAll('[role="tab"]').forEach((item) => {
      const isActive = item.getAttribute("aria-controls") === `xh-panel-${activeId}`;
      item.toggleClass("is-active", isActive);
      item.setAttr("aria-selected", String(isActive));
      item.setAttr("tabindex", isActive ? "0" : "-1");
    });
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
    const section = element(this.container, "section", "xh-side-section xh-calendar-section");
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
    ["日", "一", "二", "三", "四", "五", "六"].forEach((day) => element(calendar, "span", "xh-weekday", day));
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const offset = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - offset);
    for (let index = 0; index < 42; index += 1) {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + index);
      const key = dateKey(current);
      const button = element(calendar, "button", "xh-calendar-day", String(current.getDate()));
      const isToday = key === dateKey();
      const isSelected = key === this.plugin.selectedDate;
      const hasNote = this.plugin.hasDailyNote(key);
      if (current.getMonth() !== monthDate.getMonth()) button.addClass("is-outside");
      if (isToday) button.addClass("is-today");
      if (isSelected) button.addClass("is-selected");
      if (hasNote) button.addClass("has-note");
      button.setAttr("aria-label", `${key}${isToday ? "，今天" : ""}${hasNote ? "，有日记" : "，无日记"}`);
      button.setAttr("aria-pressed", String(isSelected));
      if (isToday) button.setAttr("aria-current", "date");
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
      items.slice(0, 5).forEach((item) => {
        const row = element(timeline, "button", "xh-timeline-row");
        element(row, "span", "xh-timeline-dot");
        element(row, "time", "", item.time);
        element(row, "span", "", item.text);
        row.addEventListener("click", () => this.plugin.openFile(note));
      });
    }
  }

  async renderRelatedAndTags() {
    const relatedSection = element(this.container, "section", "xh-side-section xh-related-section");
    const relatedHeader = element(relatedSection, "div", "xh-side-subheading");
    const relatedIcon = element(relatedHeader, "span", "");
    setIcon(relatedIcon, "waypoints");
    element(relatedHeader, "h3", "", "关联笔记");
    const graph = element(relatedSection, "div", "xh-related-graph");
    const related = this.plugin.getRelatedNotes();
    const center = element(graph, "button", "xh-related-center");
    center.setAttr("aria-label", related.center || "星海知枢");
    center.setAttr("title", related.center || "星海知枢");
    if (related.file) center.addEventListener("click", () => this.plugin.openFile(related.file));
    const graphItems = [...related.items];
    const fallback = this.plugin.getGraphFallbackNotes(related.file, graphItems, 6);
    fallback.forEach((file) => {
      if (graphItems.length < 6 && !graphItems.some((item) => item.path === file.path) && file.path !== related.file?.path) graphItems.push(file);
    });
    if (!graphItems.length) {
      element(graph, "div", "xh-side-empty", "打开一篇含双链的笔记后显示关联");
    } else {
      const positions = [
        { x: 50, y: 12, className: "is-north" },
        { x: 72, y: 30, className: "is-east" },
        { x: 72, y: 70, className: "is-east" },
        { x: 50, y: 88, className: "is-south" },
        { x: 28, y: 70, className: "is-west" },
        { x: 28, y: 30, className: "is-west" },
      ];
      graphItems.slice(0, 6).forEach((file, index) => {
        const position = positions[index];
        const button = element(graph, "button", `xh-related-node ${position.className}`);
        element(button, "span", "xh-related-node-label", file.basename);
        button.setAttr("aria-label", file.basename);
        button.setAttr("title", file.basename);
        const { x, y } = position;
        const line = element(graph, "span", "xh-related-line");
        const dx = x - 50;
        const dy = y - 50;
        line.style.width = `${Math.hypot(dx, dy)}%`;
        line.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
        button.style.setProperty("--xh-node-x", `${x}%`);
        button.style.setProperty("--xh-node-y", `${y}%`);
        button.addEventListener("click", () => this.plugin.openFile(file));
      });
    }

    const tagsSection = element(this.container, "section", "xh-side-section xh-tags-section");
    const tagsHeader = element(tagsSection, "div", "xh-side-subheading");
    const tagsIcon = element(tagsHeader, "span", "");
    setIcon(tagsIcon, "tags");
    element(tagsHeader, "h3", "", "标签");
    const tags = element(tagsSection, "div", "xh-tags");
    const tagItems = await this.plugin.getTopTags();
    if (!tagItems.length) element(tags, "span", "xh-side-empty", "暂无标签");
    tagItems.slice(0, 30).forEach(({ tag, count, categories }) => {
      const button = element(tags, "button", "xh-tag", `${tag} ${count}`);
      button.setAttr("title", `${count} 篇 · ${categories.join(" / ")}`);
      button.addEventListener("click", () => this.plugin.openTagSearch(tag));
    });
    if (tagItems.length > 30) element(tags, "span", "xh-tag xh-tag-more", `+${tagItems.length - 30}`);
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
    const mappingCount = Object.keys(this.plugin.settings.contentMappings || {}).length;
    new Setting(containerEl)
      .setName("内容写入映射")
      .setDesc(`已配置 ${mappingCount} 类；映射来自当前知识库目录、Properties、标签与链接关系，可随时重新扫描。`)
      .addButton((button) => button.setButtonText("扫描并配置").onClick(() => this.plugin.openContentMappingModal()));
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
    this.vaultSummaryCache = new Map();
    this.keywordSummaryCache = new Map();
    this.vaultSummaryTimer = null;
    this.vaultSummaryRun = 0;
    this.vaultSummaryEl = this.addStatusBarItem();
    this.vaultSummaryEl.addClass("xh-vault-summary");
    this.vaultSummaryEl.setAttr("aria-label", "整个知识库汇总信息");
    element(this.vaultSummaryEl, "span", "xh-vault-summary-loading", "正在统计知识库…");

    this.registerView(WORKBENCH_VIEW, (leaf) => new XinghaiWorkbenchView(leaf, this));
    this.registerView(SIDEBAR_VIEW, (leaf) => new XinghaiSidebarView(leaf, this));
    const homeRibbon = this.addRibbonIcon("home", "返回星海知枢主页", () => this.activateWorkbench());
    homeRibbon.addClass("xh-home-ribbon");
    this.addCommand({ id: "open-xinghai-workbench", name: "打开星海知枢工作台", callback: () => this.activateWorkbench() });
    this.addCommand({ id: "add-today-task", name: "新增今日任务", callback: () => this.openTaskModal() });
    this.addCommand({ id: "add-active-project", name: "新增进行中的项目", callback: () => this.openProjectModal() });
    this.addCommand({ id: "open-weekly-review", name: "打开本周复盘", callback: () => this.openWeeklyReview() });
    this.addSettingTab(new XinghaiSettingTab(this.app, this));

    const refresh = () => {
      this.scheduleRefresh();
      this.scheduleVaultSummary();
    };
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (file instanceof TFile) this.lastContextFile = file;
      this.scheduleRefresh();
      this.scheduleGlobalHomeBrand();
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      this.scheduleGlobalHomeBrand(leaf);
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      this.scheduleGlobalHomeBrand();
    }));
    this.registerInterval(window.setInterval(() => {
      const snapshot = this.getFocusSnapshot();
      if (snapshot.completed) this.completeFocusSession();
    }, 1000));

    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.getLeavesOfType("backlink").forEach((leaf) => leaf.detach());
      if (!this.app.workspace.getLeavesOfType(WORKBENCH_VIEW).length) this.activateWorkbench(false);
      this.updateVaultSummary();
      this.mountGlobalHomeBrand();
      if (!this.hasRequiredMappings() && !this.settings.mappingPromptDismissed) {
        window.setTimeout(() => this.openContentMappingModal(), 700);
      }
    });
  }

  onunload() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    if (this.vaultSummaryTimer) window.clearTimeout(this.vaultSummaryTimer);
    document.body.style.removeProperty("--xh-runtime-starfield-dark");
    document.body.style.removeProperty("--xh-runtime-starfield-light");
    document.querySelectorAll(".xh-global-home-banner").forEach((item) => item.remove());
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.focusSecondsByDay = this.settings.focusSecondsByDay || {};
    this.settings.contentMappings = this.settings.contentMappings || {};
  }

  assetUrl(relativePath) {
    const path = normalizePath(`.obsidian/plugins/${this.manifest.id}/${relativePath}`);
    return this.app.vault.adapter.getResourcePath(path);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  scheduleGlobalHomeBrand(preferredLeaf = null) {
    [80, 320, 900].forEach((delay) => {
      window.setTimeout(() => this.mountGlobalHomeBrand(preferredLeaf), delay);
    });
  }

  mountGlobalHomeBrand(preferredLeaf = null) {
    let leafEl = preferredLeaf?.containerEl?.closest?.(".workspace-leaf") || null;
    const root = document.querySelector(".workspace-split.mod-root") || document.querySelector(".mod-root");
    if (!leafEl || !root?.contains(leafEl)) leafEl = root?.querySelector(".workspace-leaf.mod-active") || null;
    const tabs = leafEl?.closest(".workspace-tabs") || root?.querySelector(".workspace-tabs.mod-active") || root?.querySelector(".workspace-tabs");
    const header = tabs?.querySelector(".workspace-tab-header-container");
    if (!header) return;
    document.querySelectorAll(".xh-global-home-banner").forEach((item) => item.remove());
    const banner = element(header, "div", "xh-global-home-banner");
    const button = element(banner, "button", "xh-global-home-brand");
    button.setAttr("aria-label", "返回星海知枢主页");
    button.setAttr("title", "返回星海知枢主页");
    const logo = element(button, "img", "xh-global-home-logo");
    logo.src = this.assetUrl("assets/xinghai-logo-reference.png");
    logo.alt = "";
    element(button, "span", "xh-global-home-title", "星海知枢");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.activateWorkbench();
    });
  }

  async collapseWorkspaceSidebars() {
    const { leftSplit, rightSplit } = this.app.workspace;
    const restoreState = {
      left: Boolean(leftSplit && !leftSplit.collapsed),
      right: Boolean(rightSplit && !rightSplit.collapsed),
    };
    if (!restoreState.left && !restoreState.right) {
      new Notice("左右侧栏已经处于收起状态");
      return;
    }
    this.settings.sidebarRestoreState = restoreState;
    await this.saveSettings();
    if (restoreState.left && typeof leftSplit.collapse === "function") leftSplit.collapse();
    if (restoreState.right && typeof rightSplit.collapse === "function") rightSplit.collapse();
    await this.refreshAll();
  }

  async restoreWorkspaceSidebars() {
    const restoreState = this.settings.sidebarRestoreState;
    if (!restoreState) return;
    const { leftSplit, rightSplit } = this.app.workspace;
    if (restoreState.left && leftSplit?.collapsed && typeof leftSplit.expand === "function") leftSplit.expand();
    if (restoreState.right && rightSplit?.collapsed && typeof rightSplit.expand === "function") rightSplit.expand();
    this.settings.sidebarRestoreState = null;
    await this.saveSettings();
    await this.refreshAll();
  }

  getFolderPaths() {
    const folders = [];
    const walk = (folder) => {
      (folder?.children || []).forEach((child) => {
        if (!Array.isArray(child.children) || child.path.startsWith(".")) return;
        folders.push(normalizePath(child.path));
        walk(child);
      });
    };
    walk(this.app.vault.getRoot?.());
    return folders.sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
  }

  getMappedFolder(captureType) {
    const folder = normalizePath(String(this.settings.contentMappings?.[captureType] || "").trim());
    if (!folder) return "";
    return this.getFolderPaths().includes(folder) ? folder : "";
  }

  hasRequiredMappings() {
    return REQUIRED_CAPTURE_MAPPINGS.every((type) => Boolean(this.getMappedFolder(type)));
  }

  suggestContentMappings() {
    const folders = this.getFolderPaths();
    const folderCorpus = new Map(folders.map((folder) => [folder, folder.toLowerCase()]));
    this.app.vault.getMarkdownFiles().forEach((file) => {
      const cache = this.app.metadataCache.getFileCache(file) || {};
      const metadata = JSON.stringify({
        frontmatter: cache.frontmatter || {},
        tags: getAllTags(cache) || [],
        links: this.app.metadataCache.resolvedLinks?.[file.path] || {},
      }).toLowerCase();
      const segments = file.path.split("/").slice(0, -1);
      segments.forEach((_, index) => {
        const folder = segments.slice(0, index + 1).join("/");
        if (folderCorpus.has(folder)) folderCorpus.set(folder, `${folderCorpus.get(folder)} ${file.basename.toLowerCase()} ${metadata}`);
      });
    });

    const suggestions = {};
    Object.entries(CAPTURE_TYPES).filter(([key]) => key !== "custom").forEach(([key, definition]) => {
      let best = { folder: "", score: 0 };
      folders.forEach((folder) => {
        const basename = folder.split("/").pop().toLowerCase();
        const pathText = folder.toLowerCase();
        const corpus = folderCorpus.get(folder) || pathText;
        let score = 0;
        definition.keywords.forEach((keyword) => {
          const term = keyword.toLowerCase();
          if (basename.includes(term)) score += 12;
          else if (pathText.includes(term)) score += 7;
          if (corpus.includes(term)) score += 2;
        });
        score -= Math.max(0, folder.split("/").length - 2) * 0.5;
        if (score > best.score || (score === best.score && folder.length < best.folder.length)) best = { folder, score };
      });
      if (best.score > 0) suggestions[key] = best.folder;
    });
    return suggestions;
  }

  getConstellationNodes() {
    const topLevel = this.getFolderPaths().filter((folder) => !folder.includes("/"));
    return buildConstellationNodes(topLevel);
  }

  openContentMappingModal() {
    new ContentMappingModal(this.app, this).open();
  }

  scheduleRefresh() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refreshAll(), 180);
  }

  scheduleVaultSummary() {
    if (this.vaultSummaryTimer) window.clearTimeout(this.vaultSummaryTimer);
    this.vaultSummaryTimer = window.setTimeout(() => this.updateVaultSummary(), 420);
  }

  async getVaultSummary() {
    const notes = this.app.vault.getMarkdownFiles();
    const activePaths = new Set(notes.map((file) => file.path));
    [...this.vaultSummaryCache.keys()].forEach((path) => {
      if (!activePaths.has(path)) this.vaultSummaryCache.delete(path);
    });

    const textStats = await Promise.all(notes.map(async (file) => {
      const cached = this.vaultSummaryCache.get(file.path);
      if (cached?.mtime === file.stat.mtime) return cached;
      try {
        const value = countTextUnits(await this.app.vault.cachedRead(file));
        const next = { ...value, mtime: file.stat.mtime };
        this.vaultSummaryCache.set(file.path, next);
        return next;
      } catch (error) {
        console.error(`星海知枢无法统计 ${file.path}`, error);
        return { words: 0, characters: 0, mtime: file.stat.mtime };
      }
    }));

    const propertyKeys = new Set();
    notes.forEach((file) => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      Object.keys(frontmatter).forEach((key) => propertyKeys.add(key));
    });
    return textStats.reduce((summary, item) => ({
      ...summary,
      words: summary.words + item.words,
      characters: summary.characters + item.characters,
    }), { properties: propertyKeys.size, words: 0, characters: 0 });
  }

  renderVaultSummary(summary) {
    if (!this.vaultSummaryEl) return;
    const formatter = new Intl.NumberFormat("zh-CN");
    this.vaultSummaryEl.empty();
    [
      ["list-tree", "笔记属性", summary.properties],
      ["whole-word", "词", summary.words],
      ["text-cursor-input", "字符", summary.characters],
    ].forEach(([icon, label, value]) => {
      const item = element(this.vaultSummaryEl, "span", "xh-vault-summary-item");
      const iconEl = element(item, "span", "xh-vault-summary-icon");
      setIcon(iconEl, icon);
      element(item, "span", "", `${formatter.format(value)} 个${label}`);
    });
    this.vaultSummaryEl.setAttr(
      "title",
      `整个知识库：${formatter.format(summary.properties)} 个笔记属性，${formatter.format(summary.words)} 个词，${formatter.format(summary.characters)} 个字符`,
    );
  }

  async updateVaultSummary() {
    const run = ++this.vaultSummaryRun;
    const summary = await this.getVaultSummary();
    if (run !== this.vaultSummaryRun) return;
    this.renderVaultSummary(summary);
  }

  refreshAll() {
    return Promise.all(Array.from(this.views, (view) => Promise.resolve(view.refresh())
      .catch((error) => console.error("星海知枢刷新失败", error))));
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
    if (!this.settings.dailyFolder) return "";
    return normalizePath(`${this.settings.dailyFolder}/${key}.md`);
  }

  async getDailyNote(create = false) {
    return this.getDailyNoteByKey(dateKey(), create);
  }

  async getDailyNoteByKey(key, create = false) {
    const path = this.dailyPath(key);
    if (!path) {
      if (create) throw new Error("尚未配置日记目录");
      return null;
    }
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    if (!create) return null;
    await this.ensureFolder(this.settings.dailyFolder);
    return this.app.vault.create(path, `---\ntype: daily\ndate: ${key}\n---\n\n# ${key}\n\n## 今日三件事\n\n## 时间线\n`);
  }

  hasDailyNote(key) {
    const path = this.dailyPath(key);
    return Boolean(path) && this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  async appendTodayTask(task, time = "", recordPath = "") {
    const file = await this.getDailyNote(true);
    const content = await this.app.vault.read(file);
    if (countTodaySectionTasks(content) >= 3) return false;
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
    const recordLink = recordPath
      ? `[[${recordPath.replace(/\.md$/i, "")}|${task}]]`
      : task;
    lines.splice(insertAt, 0, `- [ ] ${prefix}${recordLink}`);
    await this.app.vault.modify(file, lines.join("\n"));
    return true;
  }

  openTaskModal() {
    new CaptureModal(this.app, this, (payload) => this.createCapture(payload)).open();
  }

  openProjectModal() {
    new CaptureModal(this.app, this, (payload) => this.createCapture(payload), "project").open();
  }

  findRelationNote(folder) {
    const directFiles = this.app.vault.getMarkdownFiles().filter((file) => file.parent?.path === folder);
    return directFiles.sort((a, b) => {
      const rank = (file) => /索引|index|readme|入口|首页/i.test(file.basename) ? -1 : 0;
      return rank(a) - rank(b) || a.basename.localeCompare(b.basename, "zh-CN", { numeric: true });
    })[0] || null;
  }

  async createCapture({ content: rawContent, captureType, targetFolder, time = "", sourceUrl = "", addToToday = false, rememberFolder = false }) {
    const definition = CAPTURE_TYPES[captureType];
    if (!definition) throw new Error("内容类型无效");
    const contentText = String(rawContent || "").trim();
    const contentLines = contentText.split("\n");
    const titleIndex = contentLines.findIndex((line) => line.trim());
    const title = (titleIndex >= 0 ? contentLines[titleIndex] : definition.label).trim();
    const details = contentLines.slice(titleIndex + 1).join("\n").trim();
    const folder = normalizePath(String(targetFolder || "").trim());
    if (!folder || !this.getFolderPaths().includes(folder)) throw new Error("保存目录不存在");
    const now = new Date();
    const stamp = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const baseName = `${dateKey(now)}-${stamp}-${sanitizeTaskSlug(title)}`;
    let path = normalizePath(`${folder}/${baseName}.md`);
    let suffix = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${folder}/${baseName}-${suffix}.md`);
      suffix += 1;
    }

    let includeToday = captureType === "task" && addToToday;
    if (includeToday) {
      const daily = await this.getDailyNote(false);
      if (!daily || countTodaySectionTasks(await this.app.vault.read(daily)) >= 3) includeToday = false;
    }
    const titleValue = JSON.stringify(title);
    const timeLine = time ? `time: ${JSON.stringify(time)}\n` : "";
    const scheduledLine = includeToday ? `scheduled: ${dateKey(now)}\n` : "";
    const sourceLine = sourceUrl ? `source: ${JSON.stringify(sourceUrl)}\n` : "";
    const articleKeywords = captureType === "article"
      ? extractArticleKeywords({ title, content: contentText })
      : [];
    const keywordLine = articleKeywords.length ? `keywords: ${JSON.stringify(articleKeywords)}\n` : "";
    const relation = this.findRelationNote(folder);
    const relationLine = relation ? `related: ${JSON.stringify(`[[${relation.path.replace(/\.md$/i, "")}]]`)}\n` : "";
    const status = captureType === "project" ? "active" : captureType === "task" ? "todo" : "captured";
    const body = captureType === "project"
      ? `## 项目目标\n\n${details || "待补充"}\n\n## 项目任务\n\n- [ ] 补充项目任务\n`
      : captureType === "task"
      ? `## 任务内容\n\n- [ ] ${title}${details ? `\n\n${details}` : ""}\n`
      : captureType === "article"
        ? `## 文章摘要\n\n${contentText}\n\n${sourceUrl ? `- 来源：[打开原文](${sourceUrl})\n` : "- 来源：待补充\n"}\n## 知识提炼\n`
        : `## 内容\n\n${contentText}\n`;
    const relationBody = relation ? `- 关联入口：[[${relation.path.replace(/\.md$/i, "")}]]\n` : "";
    const content = `---\ntype: ${definition.frontmatterType}\ncaptureType: ${captureType}\nstatus: ${status}\ntitle: ${titleValue}\ntargetFolder: ${JSON.stringify(folder)}\ncreated: ${dateKey(now)}\n${scheduledLine}${timeLine}${sourceLine}${keywordLine}${relationLine}---\n\n# ${title}\n\n${body}\n## 归档关系\n\n- 保存目录：${folder}\n${relationBody}- 创建日期：${dateKey(now)}\n`;
    const record = await this.app.vault.create(path, content);
    const addedToday = includeToday ? await this.appendTodayTask(title, time, record.path) : false;
    if (rememberFolder && !this.getMappedFolder(captureType)) {
      this.settings.contentMappings[captureType] = folder;
      this.settings.mappingConfigured = this.hasRequiredMappings();
      await this.saveSettings();
    }
    if (captureType === "project") {
      new Notice(`项目已创建并保存到 ${folder}`);
    } else if (addToToday && !addedToday) {
      new Notice(`记录已保存到 ${folder}；日记未配置或今日三件事已满，未加入今日`);
    } else if (addedToday) {
      new Notice(`工作任务已保存到 ${folder}，并加入今日三件事`);
    } else {
      new Notice(`${definition.label}已保存到 ${folder}`);
    }
    await this.refreshAll();
    return record;
  }

  async openTaskFromDaily(text, fallbackFile) {
    const path = extractTaskRecordPath(text);
    const record = path ? this.app.vault.getAbstractFileByPath(path) : null;
    await this.openFile(record instanceof TFile ? record : fallbackFile);
  }

  async syncTaskRecordStatus(path, completed) {
    if (!path) return;
    const record = this.app.vault.getAbstractFileByPath(path);
    if (!(record instanceof TFile)) throw new Error("关联任务记录不存在");
    const original = await this.app.vault.read(record);
    let updated = original.replace(/^status:\s*.*$/m, `status: ${completed ? "done" : "todo"}`);
    if (completed) updated = updated.replace(/^\s*[-*]\s+\[ \]\s+/m, "- [x] ");
    else updated = updated.replace(/^\s*[-*]\s+\[[xX]\]\s+/m, "- [ ] ");
    await this.app.vault.modify(record, updated);
  }

  async toggleTask(file, lineNumber) {
    if (!(file instanceof TFile)) throw new Error("任务所属日记不存在");
    const original = await this.app.vault.read(file);
    const lines = original.split("\n");
    if (!lines[lineNumber]) throw new Error("任务行不存在");
    let completed;
    if (/\[ \]/.test(lines[lineNumber])) {
      lines[lineNumber] = lines[lineNumber].replace("[ ]", "[x]");
      completed = true;
    } else if (/\[[xX]\]/.test(lines[lineNumber])) {
      lines[lineNumber] = lines[lineNumber].replace(/\[[xX]\]/, "[ ]");
      completed = false;
    } else {
      throw new Error("目标行不是任务");
    }
    await this.app.vault.modify(file, lines.join("\n"));
    try {
      await this.syncTaskRecordStatus(extractTaskRecordPath(lines[lineNumber]), completed);
    } catch (error) {
      await this.app.vault.modify(file, original);
      throw error;
    }
    await this.refreshAll();
    return { completed };
  }

  async openWeeklyReview() {
    if (!this.settings.weeklyFolder) {
      new Notice("尚未配置周复盘目录，请先在插件设置中建立内容映射");
      this.openContentMappingModal();
      return;
    }
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
    this.scheduleGlobalHomeBrand(leaf);
  }

  async openConstellationTarget(path) {
    const direct = this.app.vault.getAbstractFileByPath(`${path}.md`);
    if (direct instanceof TFile) return this.openFile(direct);
    const candidates = this.app.vault.getMarkdownFiles()
      .filter((file) => file.path.startsWith(`${path}/`))
      .sort((a, b) => {
        const rank = (file) => {
          if (/(?:^|\/)(?:00-|README|.*索引|index)/i.test(file.path)) return -2;
          if (file.path.split("/").length === 2) return -1;
          if (file.path.includes("/任务/")) return 2;
          return 0;
        };
        return rank(a) - rank(b) || a.path.localeCompare(b.path, "zh-CN");
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
      const summary = String(frontmatter.summary || frontmatter.goal || frontmatter.description || "").trim();
      const order = Number.isFinite(Number(frontmatter.order)) ? Number(frontmatter.order) : Number.MAX_SAFE_INTEGER;
      projects.push({ file, done, total, progress: total ? Math.round(done / total * 100) : 0, summary, order });
    }
    return projects.sort((a, b) => a.order - b.order || b.file.stat.mtime - a.file.stat.mtime);
  }

  getRecentNotes() {
    const dailyPrefix = this.settings.dailyFolder ? `${normalizePath(this.settings.dailyFolder)}/` : "";
    return this.app.vault.getMarkdownFiles()
      .filter((file) => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        const type = String(frontmatter.type || "").toLowerCase();
        return type !== "daily" && type !== "template" && (!dailyPrefix || !file.path.startsWith(dailyPrefix));
      })
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  getGraphFallbackNotes(centerFile, existing = [], limit = 6) {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const excluded = new Set(existing.map((file) => file.path));
    if (centerFile instanceof TFile) excluded.add(centerFile.path);
    return this.app.vault.getMarkdownFiles()
      .filter((file) => !excluded.has(file.path))
      .map((file) => {
        const cache = this.app.metadataCache.getFileCache(file) || {};
        const type = String(cache.frontmatter?.type || "").toLowerCase();
        if (type === "daily" || type === "template") return { file, score: -1 };
        const outbound = Object.keys(resolved[file.path] || {}).length;
        const inbound = Object.values(resolved).reduce((total, targets) => total + (targets[file.path] || 0), 0);
        const isEntry = /入口|索引|index|readme|home/i.test(file.basename) ? 4 : 0;
        const recency = Math.max(0, 1 - (Date.now() - file.stat.mtime) / 604800000);
        return { file, score: outbound + inbound * 2 + isEntry + recency };
      })
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || b.file.stat.mtime - a.file.stat.mtime)
      .slice(0, limit)
      .map((item) => item.file);
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
      new Notice(snapshot.completed
        ? `本次专注已完成，共 ${formatDuration(snapshot.elapsed)}`
        : `专注已结束，本次 ${formatDuration(snapshot.elapsed)}，已计入今日`);
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
    new Notice(`专注完成，本次 ${formatDuration(snapshot.elapsed)}，欢迎回到星海知枢`);
    this.refreshAll();
  }

  changeCalendarMonth(delta) {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + delta, 1);
    this.refreshAll();
  }

  async selectCalendarDate(key) {
    this.selectedDate = key;
    this.refreshAll();
    const file = await this.getDailyNoteByKey(key, false);
    if (file) {
      await this.openFile(file);
      return;
    }
    new DailyNoteConfirmModal(this.app, key, async () => {
      const created = await this.getDailyNoteByKey(key, true);
      new Notice(`已创建 ${key} 日记`);
      this.refreshAll();
      await this.openFile(created);
    }).open();
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

  async getTopTags() {
    if (!this.keywordSummaryCache) this.keywordSummaryCache = new Map();
    const notes = this.app.vault.getMarkdownFiles();
    const activePaths = new Set(notes.map((file) => file.path));
    [...this.keywordSummaryCache.keys()].forEach((path) => {
      if (!activePaths.has(path)) this.keywordSummaryCache.delete(path);
    });
    const summaries = new Map();
    const add = (rawTag, category) => {
      const keyword = normalizeKeyword(rawTag);
      if (!keyword) return;
      const tag = `#${keyword}`;
      const current = summaries.get(tag) || { tag, count: 0, categories: new Set() };
      current.count += 1;
      current.categories.add(category || "未分类");
      summaries.set(tag, current);
    };

    for (const file of notes) {
      const cache = this.app.metadataCache.getFileCache(file) || {};
      const frontmatter = cache.frontmatter || {};
      const category = file.path.includes("/") ? file.path.split("/")[0] : "根目录";
      const fileKeywords = new Set((getAllTags(cache) || []).map((tag) => normalizeKeyword(tag)).filter(Boolean));
      const type = String(frontmatter.type || frontmatter.captureType || "").toLowerCase();
      const isArticle = type === "article"
        || String(frontmatter.captureType || "").toLowerCase() === "article"
        || /(?:^|\/)(?:clippings?|微信公众号文章|文章|剪藏)(?:\/|$)/i.test(file.path);
      if (isArticle) {
        let extracted = this.keywordSummaryCache.get(file.path);
        if (!extracted || extracted.mtime !== file.stat.mtime) {
          const content = await this.app.vault.cachedRead(file);
          extracted = {
            mtime: file.stat.mtime,
            keywords: extractArticleKeywords({
              title: frontmatter.title || file.basename,
              content,
              frontmatter,
              tags: [...fileKeywords],
            }),
          };
          this.keywordSummaryCache.set(file.path, extracted);
        }
        extracted.keywords.forEach((keyword) => fileKeywords.add(keyword));
      }
      fileKeywords.forEach((keyword) => add(keyword, category));
    }
    return [...summaries.values()]
      .map((item) => ({ ...item, categories: [...item.categories].sort((a, b) => a.localeCompare(b, "zh-CN")) }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
  }

  async openTagSearch(tag) {
    const leaf = this.app.workspace.getLeaf("tab");
    const keyword = String(tag || "").replace(/^#/u, "");
    await leaf.setViewState({ type: "search", active: true, state: { query: `tag:#${keyword} OR "${keyword}"` } });
  }
};
