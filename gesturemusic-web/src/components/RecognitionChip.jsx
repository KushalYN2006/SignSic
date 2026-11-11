import { Link } from 'react-router-dom';

export function recognitionModeLabel(mode, loaded) {
  if (!loaded) return 'Loading…';
  if (mode === 'mine') return 'My samples';
  if (mode === 'both') return 'Default + mine';
  return 'Default samples';
}

export default function RecognitionChip({ mode, loaded }) {
  return <Link className="recognition-chip glass glass--pill" to="/calibrate" title="Change recognition training data">
    <span className="recognition-chip-dot" />Recognition: {recognitionModeLabel(mode, loaded)} <span aria-hidden="true">↗</span>
  </Link>;
}
