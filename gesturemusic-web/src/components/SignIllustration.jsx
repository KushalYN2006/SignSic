const finger = (x, y, angle, height = 74) => <rect key={`${x}-${angle}`} x={x - 8} y={y - height} width="16" height={height} rx="8" transform={`rotate(${angle} ${x} ${y})`} />;

export default function SignIllustration({ item, compact = false }) {
  const note = item?.note?.[0] || 'C';
  const palm = <rect x="98" y="105" width="84" height="72" rx="26" />;
  let fingers;
  if (note === 'C' || note === 'F') fingers = <><path d={note === 'F' ? 'M150 150l46 33-8 12-50-27' : 'M112 142l-34-8-4 14 38 19'} fill="none" stroke="currentColor" strokeWidth="15" strokeLinecap="round"/><path d={note === 'F' ? 'M189 183l10 59' : 'M78 134l-12 24'} fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/></>;
  else if (note === 'B') fingers = <>{finger(112, 118, -8, 110)}{finger(133, 171, 4, 42)}{finger(153, 171, 3, 40)}{finger(173, 171, 3, 36)}<path d="M103 139L75 156" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/></>;
  else if (note === 'A') fingers = <>{finger(112, 119, -14, 68)}{finger(132, 108, -4, 74)}{finger(152, 112, 7, 68)}{finger(172, 124, 16, 57)}<path d="M103 140l-31 17" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/></>;
  else fingers = <>{finger(109, 110, -24, 74)}{finger(132, 103, -8, 80)}{finger(153, 104, 8, 78)}{finger(174, 111, 24, 72)}<path d="M103 141l-30 12" fill="none" stroke="currentColor" strokeWidth="15" strokeLinecap="round"/></>;
  const poseTransform = note === 'D' ? 'rotate(45 140 140)' : note === 'E' ? 'rotate(90 140 140)' : note === 'G' ? 'rotate(90 140 140) scale(.72 1)' : undefined;

  return <div className={`sign-illustration ${compact ? 'sign-illustration--compact' : ''}`}>
    <svg viewBox="0 0 280 270" role="img" aria-label={`${item.signName} hand sign illustration`}>
      <defs><linearGradient id={`skin-${note}`} x1="0" x2="1"><stop stopColor="#ffd98a"/><stop offset="1" stopColor="#efa758"/></linearGradient></defs>
      <g transform={poseTransform} fill={`url(#skin-${note})`} stroke="#ffe8bb" strokeWidth="2">{fingers}{palm}</g>
      <path d="M105 162q36 22 70 0" fill="none" stroke="#cf8744" strokeWidth="3" opacity=".7" />
      <path d="M218 40v34m-12-12 12 12 12-12" fill="none" stroke="#4fd1c5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="orientation-badge">{item.cameraVariant}</span>
  </div>;
}
