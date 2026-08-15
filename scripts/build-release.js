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

for (const entry of ["README.md", "INSTALL.md", "xinghai-workbench", "星海知枢", "工作台"]) {
  fs.cpSync(path.join(root, entry), path.join(target, entry), { recursive: true });
}
for (const document of ["星海知枢-macOS与Windows安装指导说明.docx", "星海知枢-产品操作手册.docx"]) {
  fs.copyFileSync(path.join(root, "docs", document), path.join(target, document));
}
fs.copyFileSync(path.join(root, "qa/release-status.md"), path.join(target, "QA-STATUS.md"));

fs.rmSync(archive, { force: true });
execFileSync("zip", ["-r", "-X", archive, releaseName], { cwd: path.join(root, "release") });
console.log(`release: ${path.relative(root, target)}`);
console.log(`archive: ${path.relative(root, archive)}`);
