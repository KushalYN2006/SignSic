const silhouettes = [
  { type: 'piano', x: '1%', y: '18%', rotate: '-11deg' },
  { type: 'violin', x: '84%', y: '7%', rotate: '18deg' },
  { type: 'guitar', x: '88%', y: '66%', rotate: '-15deg' },
  { type: 'flute', x: '6%', y: '79%', rotate: '8deg' },
  { type: 'trumpet', x: '56%', y: '82%', rotate: '-6deg' },
  { type: 'drum', x: '38%', y: '10%', rotate: '12deg' },
];

function Instrument({ type }) {
  if (type === 'piano') return <svg viewBox="0 0 240 100"><rect x="8" y="16" width="224" height="68" rx="6"/><path d="M8 18h224M34 18v66m32-66v66m32-66v66m32-66v66m32-66v66m32-66v66"/><path className="ink" d="M26 18h17v39H26zm32 0h17v39H58zm64 0h17v39h-17zm32 0h17v39h-17zm32 0h17v39h-17z"/></svg>;
  if (type === 'violin') return <svg viewBox="0 0 90 260"><path d="M40 12h10l5 80c26 17 30 36 10 49 20 16 15 37-10 52l-5 52H40l-5-52c-26-15-30-36-10-52-20-13-16-32 10-49z"/><path d="M45 16v224M31 110h28m-27 66h26M17 12l56 236"/></svg>;
  if (type === 'guitar') return <svg viewBox="0 0 140 220"><path d="M59 15h22v68c22-3 44 10 45 35 1 22-15 30-26 42 4 25-10 47-34 48-25 1-38-21-34-45-16-13-31-22-30-44 1-25 23-39 46-36z"/><circle cx="70" cy="129" r="14"/><path d="M70 17v96m-8-42h16"/></svg>;
  if (type === 'flute') return <svg viewBox="0 0 260 70"><path d="M16 35h226M33 25v20m28-20v20m28-20v20m28-20v20m28-20v20m28-20v20m28-20v20"/><circle cx="20" cy="35" r="10"/></svg>;
  if (type === 'drum') return <svg viewBox="0 0 180 180"><ellipse cx="90" cy="45" rx="60" ry="23"/><path d="M30 45v82c0 16 27 28 60 28s60-12 60-28V45m-120 44c0 16 27 28 60 28s60-12 60-28M58 12l64 48m0-48L58 60"/></svg>;
  return <svg viewBox="0 0 240 140"><path d="M15 70h78l35-48h22l-24 48h81v16h-81l24 48h-22L93 86H15z"/><path d="M38 70v16m24-16v16m24-16v16m130-24v32"/></svg>;
}

export default function BackgroundScene() {
  return <div className="background-scene" aria-hidden="true">
    <div className="scene-wash" />
    {silhouettes.map((item, i) => <div key={item.type} className={`instrument-ghost ghost-${i}`} style={{ left: item.x, top: item.y, transform: `rotate(${item.rotate})` }}><Instrument type={item.type} /></div>)}
    <div className="music-mark mark-one">♪</div><div className="music-mark mark-two">♫</div><div className="music-mark mark-three">𝄞</div><div className="music-mark mark-four">♪</div>
  </div>;
}
