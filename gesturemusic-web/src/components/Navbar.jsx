import { NavLink } from 'react-router-dom';

const links = [
  ['/', 'Learn'], ['/practice', 'Practice'], ['/reference', 'Reference'], ['/calibrate', 'Calibrate'],
];

export default function Navbar() {
  return <header className="navbar glass glass--strong">
    <NavLink className="brand" to="/" aria-label="GestureMusic home"><span className="brand-mark">G</span><span>Gesture<span>Music</span></span></NavLink>
    <nav aria-label="Main navigation">{links.map(([to, label]) => <NavLink key={label} end={to === '/'} to={to} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>{label}</NavLink>)}</nav>
    <span className="local-badge"><i /> On-device</span>
  </header>;
}
