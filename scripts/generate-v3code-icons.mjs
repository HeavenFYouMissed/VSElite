#!/usr/bin/env node
// Pure-Node fallback for generating V3Code app icons WITHOUT ImageMagick.
//
// Uses @resvg/resvg-js (pure WASM SVG renderer, no native compile) for SVG→PNG,
// and png-to-ico / png2icons for ICO/ICNS multi-resolution packing.
//
// Run from repo root:
//   npm install --no-save @resvg/resvg-js png-to-ico png2icons
//   node scripts/generate-v3code-icons.mjs
//
// Produces the same outputs as generate-v3code-icons.ps1.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const SRC = join(repoRoot, 'void_icons', 'v3code-cube-isolated.svg');
const WIN32 = join(repoRoot, 'resources', 'win32');
const DARWIN = join(repoRoot, 'resources', 'darwin');
const LINUX = join(repoRoot, 'resources', 'linux');
const VOID_ICONS = join(repoRoot, 'void_icons');

if (!existsSync(SRC)) {
	console.error(`Brand SVG not found at ${SRC}`);
	process.exit(1);
}

let Resvg, pngToIco, png2icons;
try {
	({ Resvg } = await import('@resvg/resvg-js'));
	pngToIco = (await import('png-to-ico')).default;
	png2icons = (await import('png2icons')).default;
} catch (err) {
	console.error('Missing deps. Run from repo root:');
	console.error('  npm install --no-save @resvg/resvg-js png-to-ico png2icons');
	console.error(`Original error: ${err.message}`);
	process.exit(1);
}

const svgSource = await readFile(SRC, 'utf8');

function renderAt(size) {
	const resvg = new Resvg(svgSource, {
		fitTo: { mode: 'width', value: size },
		background: 'rgba(0,0,0,0)',
	});
	return resvg.render().asPng();
}

console.log(`Generating V3Code icons from ${SRC} ...`);

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
const pngBuffers = Object.fromEntries(sizes.map((s) => [s, renderAt(s)]));

const ref1024 = join(VOID_ICONS, 'v3code-mark-1024.png');
await writeFile(ref1024, pngBuffers[1024]);
console.log(`  ✓ ${ref1024}`);

const winTile = join(WIN32, 'code_150x150.png');
await writeFile(winTile, renderAt(150));
console.log(`  ✓ ${winTile}`);

const linuxPng = join(LINUX, 'code.png');
await writeFile(linuxPng, pngBuffers[512]);
console.log(`  ✓ ${linuxPng}`);

const winIcoBuffer = await pngToIco([
	pngBuffers[16], pngBuffers[32], pngBuffers[48],
	pngBuffers[64], pngBuffers[128], pngBuffers[256],
]);
const winIco = join(WIN32, 'code.ico');
await writeFile(winIco, winIcoBuffer);
console.log(`  ✓ ${winIco}`);

const macIcnsBuffer = png2icons.createICNS(pngBuffers[1024], png2icons.BILINEAR, 0);
if (macIcnsBuffer) {
	const macIcns = join(DARWIN, 'code.icns');
	await writeFile(macIcns, macIcnsBuffer);
	console.log(`  ✓ ${macIcns}`);
} else {
	console.error('  ✗ Failed to generate .icns');
}

console.log('\nIcons generated. Next steps:');
console.log('  1. Rebuild Electron app: npm run watch (or Ctrl+Shift+B in VS Code)');
console.log('  2. Launch dev window:    .\\scripts\\code.bat --user-data-dir .\\.tmp\\user-data --extensions-dir .\\.tmp\\extensions');
console.log('  3. New icons appear in taskbar / dock / window chrome');
