const sharp = require("/Users/machaelle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const dir = "/Users/machaelle/AIProject/obsidian主题/qa/tech-constellation-header-tags-2026-08-02";
const before = `${dir}/before-light-1229x768.png`;
const after = `${dir}/after-light-1229x768.png`;

async function join(output, region = null) {
  const left = region ? await sharp(before).extract(region).png().toBuffer() : await sharp(before).png().toBuffer();
  const right = region ? await sharp(after).extract(region).png().toBuffer() : await sharp(after).png().toBuffer();
  const metadata = await sharp(left).metadata();
  await sharp({
    create: {
      width: metadata.width * 2,
      height: metadata.height,
      channels: 4,
      background: "#10121d",
    },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: metadata.width, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toFile(output);
}

Promise.all([
  join(`${dir}/compare-before-after-light.jpg`),
  join(`${dir}/compare-constellation-header-light.jpg`, { left: 263, top: 0, width: 744, height: 452 }),
  join(`${dir}/compare-sidebar-light.jpg`, { left: 1007, top: 0, width: 222, height: 744 }),
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
