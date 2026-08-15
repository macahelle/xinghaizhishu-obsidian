const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const jsonFiles = [
  "xinghai-workbench/manifest.json",
  "星海知枢/manifest.json",
  "test-vault/.obsidian/appearance.json",
  "test-vault/.obsidian/app.json",
  "test-vault/.obsidian/community-plugins.json",
  "test-vault/.obsidian/core-plugins.json",
  "test-vault/.obsidian/daily-notes.json",
  "test-vault/.obsidian/workspace.json",
];

jsonFiles.forEach((file) => JSON.parse(fs.readFileSync(file, "utf8")));

const workspacePreset = JSON.parse(fs.readFileSync("工作台/workspace-xinghai.json", "utf8"));
function leafTypes(node) {
  if (!node || typeof node !== "object") return [];
  const current = node.type === "leaf" ? [node.state?.type] : [];
  return current.concat((node.children || []).flatMap(leafTypes));
}
assert.deepEqual(leafTypes(workspacePreset.main), ["xinghai-workbench-view"]);
assert.deepEqual(leafTypes(workspacePreset.right), ["xinghai-workbench-sidebar"]);
assert.doesNotMatch(JSON.stringify(workspacePreset), /"backlink"/);

for (const file of ["xinghai-workbench/styles.css", "星海知枢/theme.css"]) {
  const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const character of css) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    assert.ok(depth >= 0, `${file} has an unmatched closing brace`);
  }
  assert.equal(depth, 0, `${file} has unmatched braces`);
}

const requiredVaultPaths = [
  "00-Wiki入口",
  "10-主题知识",
  "20-工作流模板",
  "30-复盘沉淀",
  "80-系统资源",
  "90-资料收件箱",
  "微信公众号文章",
  "Clippings",
  "outputs",
  ".obsidian/plugins/xinghai-workbench/main.js",
  ".obsidian/themes/星海知枢/theme.css",
];

requiredVaultPaths.forEach((entry) => assert.ok(fs.existsSync(path.join("test-vault", entry)), `missing ${entry}`));

function filesUnder(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(folder, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertTreeMatches(sourceDir, targetDir, label) {
  assert.ok(fs.existsSync(targetDir), `${label}: missing ${targetDir}`);
  const sourceFiles = filesUnder(sourceDir);
  sourceFiles.forEach((sourceFile) => {
    const relative = path.relative(sourceDir, sourceFile);
    const targetFile = path.join(targetDir, relative);
    assert.ok(fs.existsSync(targetFile), `${label}: missing ${relative}`);
    assert.equal(digest(fs.readFileSync(targetFile)), digest(fs.readFileSync(sourceFile)), `${label}: stale ${relative}`);
  });
  return sourceFiles.length;
}

const themeManifest = JSON.parse(fs.readFileSync("星海知枢/manifest.json", "utf8"));
const releaseName = `星海知枢-工作台-v${themeManifest.version}-正式版`;
const releaseRoot = path.join("release", releaseName);
const pluginCount = assertTreeMatches("xinghai-workbench", "test-vault/.obsidian/plugins/xinghai-workbench", "test plugin");
const themeCount = assertTreeMatches("星海知枢", "test-vault/.obsidian/themes/星海知枢", "test theme");
const runtimeFiles = [
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
runtimeFiles.forEach((relative) => {
  assert.equal(
    digest(fs.readFileSync(path.join(releaseRoot, relative))),
    digest(fs.readFileSync(relative)),
    `release: stale ${relative}`,
  );
});
const releaseDocuments = [
  ["README.md", "README.md"],
  ["INSTALL.md", "INSTALL.md"],
  ["docs/星海知枢-macOS与Windows安装指导说明.docx", "星海知枢-macOS与Windows安装指导说明.docx"],
  ["docs/星海知枢-产品操作手册.docx", "星海知枢-产品操作手册.docx"],
];
for (const [source, packaged] of releaseDocuments) {
  assert.equal(digest(fs.readFileSync(path.join(releaseRoot, packaged))), digest(fs.readFileSync(source)), `release: stale ${packaged}`);
}
const archive = `${releaseRoot}.zip`;
assert.ok(fs.existsSync(archive), `missing ${archive}`);
const archiveEntries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
assert.doesNotMatch(archiveEntries, /(?:^|\/)__MACOSX(?:\/|$)|(?:^|\/)\._/m, "archive contains macOS metadata files");
const candidateFiles = filesUnder(releaseRoot);
const expectedCandidateFiles = [
  ...runtimeFiles,
  ...releaseDocuments.map(([, packaged]) => packaged),
].sort();
assert.deepEqual(
  candidateFiles.map((file) => path.relative(releaseRoot, file)).sort(),
  expectedCandidateFiles,
  "release contains a missing or non-runtime file",
);
candidateFiles.forEach((candidateFile) => {
  const relative = path.relative(releaseRoot, candidateFile);
  const archived = execFileSync("unzip", ["-p", archive, `${releaseName}/${relative}`], { maxBuffer: 64 * 1024 * 1024 });
  assert.equal(digest(archived), digest(fs.readFileSync(candidateFile)), `archive: stale ${relative}`);
});

console.log(`package: ${jsonFiles.length} JSON, 2 CSS, ${requiredVaultPaths.length} vault paths, ${pluginCount + themeCount} test files and ${candidateFiles.length} allowlisted release files passed`);
