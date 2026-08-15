const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const theme = JSON.parse(fs.readFileSync(path.join(root, "星海知枢/manifest.json"), "utf8"));
const releaseName = `星海知枢-Obsidian主题-v${theme.version}`;
const target = path.join(root, "release", releaseName);
const archive = `${target}.zip`;

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

function copy(relative, destination = relative) {
  const output = path.join(target, destination);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(path.join(root, relative), output);
}

[
  "README.md",
  "INSTALL.md",
  "星海知枢/manifest.json",
  "星海知枢/theme.css",
  "星海知枢/assets/xinghai-starfield-dark.png",
  "星海知枢/assets/xinghai-starfield-light.png",
].forEach((relative) => copy(relative));

copy("docs/星海知枢-macOS与Windows安装指导说明.docx", "星海知枢-macOS与Windows安装指导说明.docx");
copy("docs/星海知枢-产品操作手册.docx", "星海知枢-主题操作手册.docx");

fs.rmSync(archive, { force: true });
execFileSync("zip", ["-r", "-X", archive, releaseName], { cwd: path.join(root, "release") });
console.log(`release: ${path.relative(root, target)}`);
console.log(`archive: ${path.relative(root, archive)}`);
