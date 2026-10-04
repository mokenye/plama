const { existsSync, readFileSync, writeFileSync } = require('node:fs');

if (!existsSync('node_modules/artillery/package.json')) {
  const omittedDevDependencies =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_config_omit?.split(',').includes('dev');

  if (omittedDevDependencies) {
    console.info('Skipping the Artillery patch because dev dependencies are omitted.');
    process.exit(0);
  }

  throw new Error('Artillery is missing; cannot apply the csv-parse compatibility patch.');
}

const patches = [
  {
    file: 'node_modules/artillery/dist/lib/util/prepare-test-execution-plan.js',
    original: "import csv from 'csv-parse';",
    replacement: "import { parse as csv } from 'csv-parse';",
  },
  {
    file: 'node_modules/artillery/dist/lib/cmds/run.js',
    original: "import _csv from 'csv-parse';",
    replacement: "import { parse as _csv } from 'csv-parse';",
  },
];

for (const { file, original, replacement } of patches) {
  const content = readFileSync(file, 'utf8');

  if (content.includes(replacement)) {
    continue;
  }

  if (content.split(original).length !== 2) {
    throw new Error(`Expected exactly one unpatched csv-parse import in ${file}`);
  }

  writeFileSync(file, content.replace(original, replacement));
}
