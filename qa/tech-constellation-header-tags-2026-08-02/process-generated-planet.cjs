const sharp = require("/Users/machaelle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const source = "/Users/machaelle/.codex/generated_images/019fbce2-0491-7aa3-b035-11222ea76723/exec-19fdec00-c785-4787-b063-d70fabbfca7c.png";
const root = "/Users/machaelle/AIProject/obsidian主题";
const outputSource = `${root}/qa/tech-constellation-header-tags-2026-08-02/shadow-planet-generated-source.png`;
const outputs = [
  [`${root}/xinghai-workbench/assets/xinghai-shadow-planet-light.png`, 0.82, 0.9],
  [`${root}/xinghai-workbench/assets/xinghai-shadow-planet-dark.png`, 0.58, 1.18],
  [`${root}/test-vault/.obsidian/plugins/xinghai-workbench/assets/xinghai-shadow-planet-light.png`, 0.82, 0.9],
  [`${root}/test-vault/.obsidian/plugins/xinghai-workbench/assets/xinghai-shadow-planet-dark.png`, 0.58, 1.18],
];

async function build() {
  await sharp(source).png().toFile(outputSource);
  const { data, info } = await sharp(source)
    .trim({ background: "#000000", threshold: 8 })
    .resize(228, 228, { fit: "contain", background: "#000000" })
    .extend({ top: 14, bottom: 14, left: 14, right: 14, background: "#000000" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = Buffer.alloc(info.width * info.height * 4);
  const cx = (info.width - 1) / 2;
  const cy = (info.height - 1) / 2;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const sourceIndex = (y * info.width + x) * 3;
      const targetIndex = (y * info.width + x) * 4;
      const red = data[sourceIndex];
      const green = data[sourceIndex + 1];
      const blue = data[sourceIndex + 2];
      const distance = Math.hypot(x - cx, y - cy);
      const peak = Math.max(red, green, blue);
      let alpha = 0;
      if (distance <= 93) alpha = 255;
      else if (distance <= 121) {
        const luminanceAlpha = Math.max(0, Math.min(255, (peak - 4) * 2.6));
        const radialFade = Math.max(0, Math.min(1, (121 - distance) / 9));
        alpha = Math.round(luminanceAlpha * (distance < 112 ? 1 : radialFade));
      }
      rgba[targetIndex] = red;
      rgba[targetIndex + 1] = green;
      rgba[targetIndex + 2] = blue;
      rgba[targetIndex + 3] = alpha;
    }
  }

  for (const [output, brightness, saturation] of outputs) {
    await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .modulate({ brightness, saturation })
      .resize(256, 256)
      .png({ compressionLevel: 9 })
      .toFile(output);
  }
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
