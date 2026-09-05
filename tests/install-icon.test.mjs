import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");

assert.match(
  indexHtml,
  /<link\s+rel="manifest"\s+href="%BASE_URL%manifest\.webmanifest"\s*\/?>/,
  "index.html must link to the web-app manifest using Vite's base URL",
);
assert.match(
  indexHtml,
  /<link\s+rel="apple-touch-icon"\s+href="%BASE_URL%icons\/apple-touch-icon\.png"\s*\/?>/,
  "index.html must provide the Posting Art icon for iPhone and iPad shortcuts",
);

const manifestPath = resolve(root, "public/manifest.webmanifest");
assert.ok(existsSync(manifestPath), "public/manifest.webmanifest must exist");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.name, "Posting Art");
assert.equal(manifest.short_name, "Posting Art");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.display, "standalone");

const requiredIcons = new Map([
  ["icons/icon-192.png", "192x192"],
  ["icons/icon-512.png", "512x512"],
]);

function readPngSize(path) {
  const png = readFileSync(path);
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${path} must be a PNG file`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

for (const [src, sizes] of requiredIcons) {
  const icon = manifest.icons?.find((candidate) => candidate.src === src);
  assert.ok(icon, `manifest must reference ${src}`);
  assert.equal(icon.sizes, sizes);
  assert.equal(icon.type, "image/png");
  const iconPath = resolve(root, "public", src);
  assert.ok(existsSync(iconPath), `${src} must exist`);
  const [expectedWidth, expectedHeight] = sizes.split("x").map(Number);
  assert.deepEqual(readPngSize(iconPath), { width: expectedWidth, height: expectedHeight });
}

const appleTouchIconPath = resolve(root, "public/icons/apple-touch-icon.png");
assert.ok(existsSync(appleTouchIconPath), "Apple touch icon must exist");
assert.deepEqual(readPngSize(appleTouchIconPath), { width: 180, height: 180 });
