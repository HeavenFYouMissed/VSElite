// Rasterizes the V brand SVGs into the PNG/ICO sizes the app needs.
// Run from vselite/:  node brand-assets/generate-icons.mjs
// Requires the repo's bundled `sharp` (already in node_modules) for SVG->PNG.
// The .ico / .icns containers are assembled by brand-assets/assemble-icons.py (Pillow).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const appIcon = join(here, 'app-icon.svg'); // dark bg + V, for window/taskbar icons
const logo = join(here, 'vselite-logo.svg'); // transparent colored V

const out = (p) => { mkdirSync(dirname(p), { recursive: true }); return p; };
const render = async (src, size, dest) => {
  await sharp(src, { density: 384 }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out(dest));
  console.log('wrote', dest, size + 'x' + size);
};

// PNG sizes for the .ico (assembled later) — from app-icon (dark bg)
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
for (const s of icoSizes) await render(appIcon, s, join(here, 'png', `app-${s}.png`));

// macOS .icns source sizes — from app-icon (dark bg)
const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
for (const s of icnsSizes) await render(appIcon, s, join(here, 'png', `icns-${s}.png`));

// Windows VisualElements tiles (used in dev mode as the window/taskbar icon)
await render(appIcon, 150, out(join(repo, 'resources/win32/code_150x150.png')));
await render(appIcon, 70, out(join(repo, 'resources/win32/code_70x70.png')));

// Linux window icon (always used on Linux at runtime)
await render(appIcon, 512, out(join(repo, 'resources/linux/code.png')));

// A plain transparent logo PNG for the website / in-app usage
await render(logo, 512, out(join(repo, 'void-panel/public/logo.png')));

// Web/server (code-server PWA) icons referenced by resources/server/manifest.json + workbench html
await render(appIcon, 192, out(join(repo, 'resources/server/code-192.png')));
await render(appIcon, 512, out(join(repo, 'resources/server/code-512.png')));
// favicon source (assembled into .ico by assemble-icons.py)
await render(appIcon, 32, join(here, 'png', 'favicon-32.png'));
await render(appIcon, 256, join(here, 'png', 'favicon-256.png'));

console.log('done');
