import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'public/data/default_samples.json';
const dataset = JSON.parse(await readFile(path, 'utf8'));
if (!Array.isArray(dataset.samples)) throw new Error('Dataset JSON must contain a samples array.');
const samples = dataset.samples;
const labels = [...new Set(samples.map((sample) => sample?.label).filter(Boolean))].sort();
const tally = (rows, field) => Object.fromEntries([...rows.reduce((counts, sample) => {
  const value = sample?.[field] ?? '(missing)';
  counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))));

let nonFiniteValues = 0;
const seenRows = new Set();
let exactDuplicateRows = 0;
for (const sample of samples) {
  for (const value of (Array.isArray(sample?.features) ? sample.features : [])) {
    if (typeof value === 'number' && !Number.isFinite(value)) nonFiniteValues += 1;
  }
  const key = JSON.stringify([sample?.label, sample?.features]);
  if (seenRows.has(key)) exactDuplicateRows += 1;
  else seenRows.add(key);
}

function centroid(rows) {
  const width = rows[0]?.features?.length || 0;
  const values = Array(width).fill(0);
  for (const row of rows) row.features.forEach((value, i) => { values[i] += value; });
  return values.map((value) => value / rows.length);
}
function distance(left, right) {
  if (left.length !== right.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < left.length; i += 1) sum += (left[i] - right[i]) ** 2;
  return Math.sqrt(sum / left.length);
}
function euclideanDistance(left, right) {
  return distance(left, right) * Math.sqrt(left.length);
}

const valid = samples.filter((sample) => Array.isArray(sample?.features) && sample.features.length > 0 && sample.features.every(Number.isFinite));
const stats = [];
const warnings = [];
for (const label of labels) {
  const rows = valid.filter((sample) => sample.label === label);
  const center = rows.length ? centroid(rows) : [];
  const spread = rows.length ? rows.reduce((sum, row) => sum + distance(row.features, center), 0) / rows.length : 0;
  const hands = [...new Set(rows.map((row) => row.handedness).filter(Boolean))];
  const handCentroids = Object.fromEntries(hands.map((hand) => {
    const group = rows.filter((row) => row.handedness === hand);
    const groupCenter = centroid(group);
    const groupSpread = group.reduce((sum, row) => sum + distance(row.features, groupCenter), 0) / group.length;
    return [hand, { rows: group.length, centroid: groupCenter, spread: groupSpread }];
  }));
  let handednessDistance = null;
  let handednessRmsDistance = null;
  let handednessRatio = null;
  if (hands.length > 1) {
    handednessRmsDistance = distance(handCentroids[hands[0]].centroid, handCentroids[hands[1]].centroid);
    handednessDistance = euclideanDistance(handCentroids[hands[0]].centroid, handCentroids[hands[1]].centroid);
    const typicalWithinSpread = (handCentroids[hands[0]].spread + handCentroids[hands[1]].spread) / 2;
    handednessRatio = handednessRmsDistance / Math.max(typicalWithinSpread, 1e-12);
    if (handednessRatio > 3) warnings.push(`${label}: ${hands.join('/')} handedness clusters are ${handednessDistance.toFixed(3)} apart by Euclidean centroid distance (${handednessRatio.toFixed(1)}× their typical RMS within-hand spread).`);
  }
  const recorded = rows.filter((row) => row.source === 'personal').length;
  const recordedHands = Object.fromEntries(hands.map((hand) => [hand, rows.filter((row) => row.source === 'personal' && row.handedness === hand).length]));
  if (recorded < 60) warnings.push(`${label}: only ${recorded} recorded (source=personal) rows; expected at least 60.`);
  stats.push({ label, rows: rows.length, recorded, spread, centroid: center, hands: Object.fromEntries(hands.map((hand) => [hand, handCentroids[hand].rows])), recordedHands, handednessDistance, handednessRmsDistance, handednessRatio });
}

for (const item of stats) {
  const neighbors = stats.filter((other) => other.label !== item.label && other.centroid.length && item.centroid.length)
    .map((other) => ({ label: other.label, distance: euclideanDistance(item.centroid, other.centroid) }))
    .sort((a, b) => a.distance - b.distance);
  item.nearestClass = neighbors[0] || null;
}

const spreads = stats.map((item) => item.spread).filter((value) => value > 0).sort((a, b) => a - b);
const medianSpread = spreads.length ? spreads[Math.floor(spreads.length / 2)] : 0;
for (const item of stats) if (medianSpread && item.spread > 3 * medianSpread) warnings.push(`${item.label}: class spread ${item.spread.toFixed(3)} is more than 3× the median spread ${medianSpread.toFixed(3)}.`);

console.log(`Dataset: ${path}`);
console.log(`Rows: ${samples.length}; valid feature rows: ${valid.length}; feature length: ${dataset.featureLength ?? '(legacy 72)'}; feature version: ${dataset.featureVersion ?? '(legacy 1)'}`);
console.log('Rows per label:', tally(samples, 'label'));
console.log('Rows per handedness:', tally(samples, 'handedness'));
console.log('Rows per source:', tally(samples, 'source'));
console.log('Per-class centroids/spread (RMS Euclidean):');
for (const item of stats) console.log(`  ${item.label}: rows=${item.rows}, recorded=${item.recorded}, spread(RMS)=${item.spread.toFixed(4)}, nearest-class-centroid=${item.nearestClass ? `${item.nearestClass.label} (${item.nearestClass.distance.toFixed(3)} Euclidean)` : 'n/a'}, hands(all rows)=${JSON.stringify(item.hands)}, recorded hands=${JSON.stringify(item.recordedHands)}, hand-centroid-distance(Euclidean)=${item.handednessDistance === null ? 'n/a' : item.handednessDistance.toFixed(3)}, separation/within-hand-spread=${item.handednessRatio === null ? 'n/a' : item.handednessRatio.toFixed(2)}`);
console.log(`Non-finite feature values: ${nonFiniteValues}`);
console.log(`Exact duplicate feature rows: ${exactDuplicateRows}`);
if (warnings.length) {
  console.log('Warnings:');
  for (const warning of warnings) console.warn(`  WARNING: ${warning}`);
} else console.log('Warnings: none');
const c = stats.find((item) => item.label === 'C');
if (c && c.hands.Left && c.hands.Right) {
  console.log(`Known handedness review: C has ${c.recordedHands.Left} recorded Left and ${c.recordedHands.Right} recorded Right rows (${c.hands.Left} and ${c.hands.Right} including augmentation) with a ${c.handednessDistance.toFixed(3)} Euclidean (RMS ${c.handednessRmsDistance.toFixed(3)}) feature-centroid separation.`);
  console.log('Recommendation: re-record C with the right hand, or fix handedness mirroring and re-record. No rows were changed.');
}
