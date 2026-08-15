const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const theme = JSON.parse(fs.readFileSync(path.join(root, "星海知枢/manifest.json"), "utf8"));
const isCandidate = process.argv.includes("--candidate");
const releaseName = `星海知枢-工作台-v${theme.version}${isCandidate ? "-候选版" : "-正式版"}`;
const target = path.join(root, "release", releaseName);
const archive = `${target}.zip`;

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

function copyRuntimeFile(relative) {
  const destination = path.join(target, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, relative), destination);
}

const runtimeFiles = [
  "README.md",
  "INSTALL.md",
  "xinghai-workbench/main.js",
  "xinghai-workbench/manifest.json",
  "xinghai-workbench/styles.css",
  "xinghai-workbench/assets/xinghai-constellation-dark.png",
  "xinghai-workbench/assets/xinghai-constellation-light.png",
  "xinghai-workbench/assets/xinghai-logo-reference.png",
  "xinghai-workbench/assets/xinghai-shadow-planet-dark.png",
  "xinghai-workbench/assets/xinghai-shadow-planet-light.png",
  "xinghai-workbench/assets/xinghai-starfield-dark.png",
  "xinghai-workbench/assets/xinghai-starfield-light.png",
  "星海知枢/manifest.json",
  "星海知枢/theme.css",
  "星海知枢/assets/xinghai-starfield-dark.png",
  "星海知枢/assets/xinghai-starfield-light.png",
  "工作台/appearance-xinghai.json",
  "工作台/graph-xinghai.json",
  "工作台/workspace-xinghai.json",
];
runtimeFiles.forEach(copyRuntimeFile);
for (const document of ["星海知枢-macOS与Windows安装指导说明.docx", "星海知枢-产品操作手册.docx"]) {
  fs.copyFileSync(path.join(root, "docs", document), path.join(target, document));
}
fs.rmSync(archive, { force: true });
execFileSync("zip", ["-r", "-X", archive, releaseName], { cwd: path.join(root, "release") });
console.log(`release: ${path.relative(root, target)}`);
console.log(`archive: ${path.relative(root, archive)}`);
