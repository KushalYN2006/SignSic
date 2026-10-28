import { createKnnClassifier } from './knnClassifier';
import { NOTE_SIGN_MAP } from '../data/noteSignMap';

export function evaluateSamples(samples, folds = 5) {
  const labels = NOTE_SIGN_MAP.map((item) => item.note[0]);
  const matrix = labels.map(() => labels.map(() => 0));
  const byLabel = new Map(labels.map((label) => [label, []]));
  samples.forEach((sample) => byLabel.get(sample.label)?.push(sample));
  const covered = labels.filter((label) => byLabel.get(label).length > 0);
  let correct = 0;
  let total = 0;

  for (let fold = 0; fold < folds; fold += 1) {
    const train = [];
    const test = [];
    byLabel.forEach((classSamples) => {
      const groupFold = new Map();
      let nextFold = 0;
      classSamples.forEach((sample) => {
        const group = sample.group || `${sample.label}:${nextFold}:${sample.source || ''}`;
        if (!groupFold.has(group)) { groupFold.set(group, nextFold % folds); nextFold += 1; }
        (groupFold.get(group) === fold ? test : train).push(sample);
      });
    });
    if (!test.length || !train.length) continue;
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
  return { accuracy: total ? correct / total : null, correct, total, labels, matrix, covered: covered.length, coveredLabels: covered };
}
