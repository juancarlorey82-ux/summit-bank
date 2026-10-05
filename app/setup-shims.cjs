const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, 'node_modules', '.bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const bins = [
  ['vite', '../vite/bin/vite.js'],
  ['tsc', '../typescript/bin/tsc'],
  ['esbuild', '../esbuild/bin/esbuild'],
  ['eslint', '../eslint/bin/eslint.js'],
  ['prettier', '../prettier/bin/prettier.cjs']
];

for (const [name, rel] of bins) {
  const cmd = `@echo off\nnode "%~dp0\\${rel.replace(/\//g, '\\')}" %*\n`;
  fs.writeFileSync(path.join(binDir, name + '.cmd'), cmd);
}
console.log('Shims created successfully in ' + binDir);
