export default function HoldRing({ progress = 0, state = 'idle', children }) {
  const circumference = 2 * Math.PI * 53;
  return <div className={`hold-ring hold-ring--${state}`}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="ring-track" cx="60" cy="60" r="53"/><circle className="ring-progress" cx="60" cy="60" r="53" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} /></svg>
    <div className="hold-ring-content">{children}</div>
  </div>;
}
