export default function NoteKey({ item, active, status, onClick }) {
  return <button className={`note-key glass glass--pill ${active ? 'is-selected' : ''} ${status ? `note-key--${status}` : ''}`} onClick={onClick} aria-pressed={active}>
    <strong>{item.note[0]}</strong><span>{item.solfege}</span>
  </button>;
}
