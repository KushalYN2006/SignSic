export default function SignPhoto({ item, compact = false, className = '' }) {
  const sign = item.solfege.toLowerCase();
  return <div className={`sign-photo-frame ${compact ? 'sign-photo-frame--compact' : ''} ${className}`.trim()}>
    <img
      className="sign-photo"
      src={`${import.meta.env.BASE_URL}signs/${sign}.jpg`}
      alt={`${item.solfege} traditional Kodály hand sign`}
      loading="lazy"
      width="600"
      height="450"
    />
  </div>;
}
