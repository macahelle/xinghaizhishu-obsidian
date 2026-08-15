const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "星海知枢/manifest.json"), "utf8"));
const releaseName = `星海知枢-Obsidian主题-v${manifest.version}`;
const releaseRoot = path.join(root, "release", releaseName);
const archive = `${releaseRoot}.zip`;
const expected = [
  "INSTALL.md",
  "README.md",
  "星海知枢-macOS与Windows安装指导说明.docx",
  "星海知枢-主题操作手册.docx",
  "星海知枢/assets/xinghai-starfield-dark.png",
  "星海知枢/assets/xinghai-starfield-light.png",
  "星海知枢/manifest.json",
  "星海知枢/theme.css",
].sort();

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function filesUnder(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(folder, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

assert.equal(manifest.name, "星海知枢");
assert.equal(manifest.version, "3.2.0");
const css = fs.readFileSync(path.join(root, "星海知枢/theme.css"), "utf8");
assert.match(css, /xinghai-starfield-dark\.png/);
assert.match(css, /xinghai-starfield-light\.png/);
assert.doesNotMatch(css, /xinghai-workbench|main\.js/);
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const braceBalance = [...cssWithoutComments].reduce((balance, character) => {
  const next = character === "{" ? balance + 1 : character === "}" ? balance - 1 : balance;
  assert.ok(next >= 0, "theme.css 存在多余的右花括号");
  return next;
}, 0);
assert.equal(braceBalance, 0, "theme.css 花括号不平衡");
for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  if (/^(data:|https?:)/.test(match[1])) continue;
  assert.ok(fs.existsSync(path.join(root, "星海知枢", match[1])), `CSS 资源不存在：${match[1]}`);
}

const actual = filesUnder(releaseRoot).map((file) => path.relative(releaseRoot, file)).sort();
assert.deepEqual(actual, expected, "主题安装包含有缺失或非主题文件");
for (const relative of expected) {
  const packaged = path.join(releaseRoot, relative);
  const source = relative === "星海知枢-主题操作手册.docx"
    ? path.join(root, "docs/星海知枢-产品操作手册.docx")
    : relative.startsWith("星海知枢-")
      ? path.join(root, "docs", relative)
      : path.join(root, relative);
  assert.equal(digest(packaged), digest(source), `发布文件不同步：${relative}`);
}

const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" });
assert.doesNotMatch(entries, /xinghai-workbench|test-vault|tests\/|工作台|QA-STATUS|__MACOSX|\/\._/);
for (const relative of expected) {
  const archived = execFileSync("unzip", ["-p", archive, `${releaseName}/${relative}`], { maxBuffer: 64 * 1024 * 1024 });
  assert.equal(crypto.createHash("sha256").update(archived).digest("hex"), digest(path.join(releaseRoot, relative)));
}

console.log(`theme package: ${expected.length} allowlisted files passed`);
