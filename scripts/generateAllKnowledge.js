/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scripts = [
  'importProductMaster.js',
  'analyzeWarrantyClaims.js',
  'generateKnowledgeFromSimpleCsv.js',
  'generateKnowledgeFromSupportCases.js',
];

for (const script of scripts) {
  console.log(`\nRunning ${script}...`);
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('\nAll knowledge tasks finished.');
