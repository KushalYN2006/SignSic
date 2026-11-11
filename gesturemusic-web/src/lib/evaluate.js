import { createKnnClassifier } from './knnClassifier';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';

export function evaluateSamples(samples, folds = 5) {
  const labels = NOTE_SIGN_MAP.map((item) => item.note[0]);
  const matrix = labels.map(() => labels.map(() => 0));
  const groupRows = new Map();
  const perLabelGroups = new Map(labels.map((label) => [label, []]));
  let previousLegacy = null;
  let legacySequence = 0;
  let hasLegacyRows = false;

  samples.forEach((sample) => {
    if (!perLabelGroups.has(sample.label)) return;
    let key;
    if (sample.take) {
      key = `take:${sample.dataset || sample.source || 'samples'}:${sample.take}`;
      previousLegacy = null;
    } else {
      hasLegacyRows = true;
      const scope = sample.dataset || sample.source || 'legacy';
      const previousKey = `${scope}:${sample.label}`;
      if (previousLegacy?.key !== previousKey) {
        previousLegacy = { key: previousKey, id: `legacy-run:${legacySequence++}` };
      }
      key = previousLegacy.id;
    }
    if (!groupRows.has(key)) {
      const labelGroups = perLabelGroups.get(sample.label);
      const entry = { label: sample.label, index: labelGroups.length, rows: [] };
      labelGroups.push(entry);
      groupRows.set(key, entry);
    }
    groupRows.get(key).rows.push(sample);
  });

  const coveredLabels = labels.filter((label) => perLabelGroups.get(label).length > 0);
  const eligibleLabels = new Set(labels.filter((label) => perLabelGroups.get(label).length >= 2));
  const totalGroups = [...perLabelGroups.values()].reduce((sum, groups) => sum + groups.length, 0);
  const foldCount = Math.max(2, Math.min(folds, Math.max(2, totalGroups)));
  let correct = 0;
  let total = 0;

  for (let fold = 0; fold < foldCount; fold += 1) {
    const train = [];
    const test = [];
    for (const [label, groups] of perLabelGroups) {
      groups.forEach((group) => {
        const heldOut = group.index % foldCount === fold;
        if (heldOut && eligibleLabels.has(label)) test.push(...group.rows);
        else train.push(...group.rows);
      });
    }
    if (!train.length || !test.length) continue;
    const classifier = createKnnClassifier({ minConfidence: 0, maxDistance: Infinity });
    classifier.train(train);
    test.forEach((sample) => {
      const predicted = classifier.classify(sample.features)?.note;
      const row = labels.indexOf(sample.label);
      const col = labels.indexOf(predicted);
      if (row >= 0 && col >= 0) matrix[row][col] += 1;
      total += 1;
      if (predicted === sample.label) correct += 1;
    });
  }
  return {
    accuracy: total ? correct / total : null,
    correct, total, labels, matrix,
    covered: coveredLabels.length, coveredLabels,
    independentTakes: [...eligibleLabels],
    legacy: hasLegacyRows,
  };
}
