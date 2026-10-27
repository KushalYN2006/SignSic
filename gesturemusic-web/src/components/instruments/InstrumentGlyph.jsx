const GLYPHS = {
  piano: <><rect x="5" y="17" width="90" height="42" rx="4"/><path d="M22 18v40m18-40v40m18-40v40m18-40v40"/><path d="M17 18h10v24H17zm18 0h10v24H35zm36 0h10v24H71z" fill="currentColor"/></>,
  violin: <><path d="M45 6h10l3 28c21 12 21 22 2 29 19 8 17 19-2 30l-3 28H45l-3-28c-19-11-21-22-2-30-19-7-19-17 2-29z"/><path d="M50 8v111M36 43h28M36 79h28"/></>,
  guitar: <><path d="M43 6h14v34c17-1 29 8 29 21 0 9-7 13-12 18 2 15-7 25-20 25S32 94 34 79c-7-5-13-9-13-19 0-13 12-21 22-20z"/><circle cx="50" cy="66" r="9"/><path d="M50 7v50"/></>,
  flute: <><path d="M5 34h90M18 25v18m18-18v18m18-18v18m18-18v18m18-18v18"/><circle cx="8" cy="34" r="5"/></>,
  trumpet: <><path d="M5 32h31l15-18h10L50 32h40v10H50l11 18H51L36 42H5z"/><path d="M17 32v10m12-10v10m48-14v18"/></>,
  drum: <><ellipse cx="50" cy="20" rx="31" ry="11"/><path d="M19 20v39c0 8 14 14 31 14s31-6 31-14V20M19 41c0 7 14 12 31 12s31-5 31-12M33 4l34 20m0-20L33 24"/></>,
};

export default function InstrumentGlyph({ name, ...props }) {
  return <svg viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{GLYPHS[name]}</svg>;
}
