import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
let input = 'data-source/gesturemusic-samples.json';
let output = 'public/data/default_samples.json';
let precision = null;
let dropAugmented = false;
const drops = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  const [option, inlineValue] = arg.split('=', 2);
  const value = inlineValue ?? args[i + 1];
  if (option === '--round') {
    if (inlineValue === undefined) i += 1;
    precision = Number(value);
    if (!Number.isInteger(precision) || precision < 0 || precision > 12) throw new Error('--round must be an integer from 0 to 12.');
  } else if (option === '--drop-augmented') dropAugmented = true;
  else if (option === '--drop') {
    if (inlineValue === undefined) i += 1;
    const filters = Object.fromEntries(String(value).split(/\s*,\s*|\s+(?=[a-zA-Z]+=)/).map((entry) => {
      const split = entry.indexOf('=');
      if (split < 1) throw new Error(`Invalid --drop filter: ${entry}`);
      return [entry.slice(0, split), entry.slice(split + 1)];
    }));
    drops.push(filters);
  } else if (option === '--input') {
    if (inlineValue === undefined) i += 1;
    input = value;
  } else if (option === '--output') {
    if (inlineValue === undefined) i += 1;
    output = value;
  } else throw new Error(`Unknown option: ${arg}`);
}

const inputPath = resolve(input);
const outputPath = resolve(output);
if (inputPath === outputPath) throw new Error('Refusing to overwrite the input dataset. Choose a different --output path.');
const original = JSON.parse(await readFile(inputPath, 'utf8'));
if (!Array.isArray(original.samples)) throw new Error('Input JSON must contain a samples array.');
let samples = original.samples.filter((sample) => !(dropAugmented && sample.source === 'augmented'));
samples = samples.filter((sample) => !drops.some((filter) => Object.entries(filter).every(([key, value]) => String(sample[key]) === value)));
if (precision !== null) {
  const round = (value) => typeof value === 'number' ? Number(value.toFixed(precision)) : value;
  samples = samples.map((sample) => ({ ...sample, features: sample.features.map(round) }));
}
const outputDataset = {
  version: 1,
  featureVersion: original.featureVersion ?? 1,
  featureLength: original.featureLength ?? 72,
  createdAt: new Date().toISOString(),
  notes: [
    'Prepared from the archived source dataset. The archived source was not modified.',
    ...(dropAugmented ? ['Augmented rows were omitted; the app regenerates deterministic augmentation at load.'] : []),
  ],
  samples,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(outputDataset));
console.log(`Wrote ${samples.length} rows to ${outputPath}`);
console.log(`Input preserved at ${inputPath}`);
