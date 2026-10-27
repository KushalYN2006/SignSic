export default function ConfusionMatrix({ result }) {
  if (!result || result.total === 0) return <div className="empty-matrix">Add at least one sample for multiple signs to evaluate recognition.</div>;
  const max = Math.max(1, ...result.matrix.flat());
  const confusedPairs = result.matrix.flatMap((row, i) => row.map((value, j) => ({ value, pair: `${result.labels[i]} → ${result.labels[j]}` })))
    .filter((cell) => cell.value && cell.pair.split(' → ')[0] !== cell.pair.split(' → ')[1])
    .sort((a, b) => b.value - a.value).slice(0, 3);
  return <div className="matrix-wrap"><table className="confusion-matrix"><caption>Rows are actual signs; columns are predicted signs</caption><thead><tr><th>Actual ↓ / Predicted →</th>{result.labels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.matrix.map((row, i) => <tr key={result.labels[i]}><th>{result.labels[i]}</th>{row.map((value, j) => <td key={j} style={{ '--cell-alpha': 0.08 + (value / max) * 0.72, '--cell-color': i === j ? '79,209,197' : '245,185,66' }}>{value || ''}</td>)}</tr>)}</tbody></table>{confusedPairs.length > 0 && <p className="confused-pairs">Most confused: {confusedPairs.map((item) => `${item.pair} (${item.value})`).join(' · ')}</p>}</div>;
}
