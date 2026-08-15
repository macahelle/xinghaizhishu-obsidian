const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const theme = JSON.parse(fs.readFileSync(path.join(root, "星海知枢/manifest.json"), "utf8"));
const releaseName = `星海知枢-Obsidian主题-v${theme.version}`;
const target = path.join(root, "release", releaseName);
const archive = `${target}.zip`;

const themeFiles = [
  "星海知枢/manifest.json",
  "星海知枢/theme.css",
  "星海知枢/assets/xinghai-starfield-dark.png",
  "星海知枢/assets/xinghai-starfield-light.png",
];
const pluginFiles = [
  "xinghai-workbench/manifest.json",
  "xinghai-workbench/main.js",
  "xinghai-workbench/styles.css",
  "xinghai-workbench/assets/xinghai-constellation-dark.png",
  "xinghai-workbench/assets/xinghai-constellation-light.png",
  "xinghai-workbench/assets/xinghai-logo-reference.png",
  "xinghai-workbench/assets/xinghai-logo.png",
  "xinghai-workbench/assets/xinghai-shadow-planet-dark.png",
  "xinghai-workbench/assets/xinghai-shadow-planet-light.png",
  "xinghai-workbench/assets/xinghai-starfield-dark.png",
  "xinghai-workbench/assets/xinghai-starfield-light.png",
];

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
  ...themeFiles,
  ...pluginFiles,
].forEach((relative) => copy(relative));

copy("docs/星海知枢-macOS与Windows安装指导说明.docx", "星海知枢-macOS与Windows安装指导说明.docx");
copy("docs/星海知枢-产品操作手册.docx", "星海知枢-主题操作手册.docx");

fs.rmSync(archive, { force: true });
execFileSync("bsdtar", ["-a", "-cf", archive, releaseName], { cwd: path.join(root, "release") });
console.log(`release: ${path.relative(root, target)}`);
console.log(`archive: ${path.relative(root, archive)}`);
