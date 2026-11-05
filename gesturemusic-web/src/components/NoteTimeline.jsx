import { useEffect, useRef, useState } from 'react';

const colors = { C:'#4FD1C5', D:'#5BB8F5', E:'#5EEAA0', F:'#D9E35A', G:'#F5B942', A:'#FF9A55', B:'#FF7A59' };

export default function NoteTimeline({ notes, duration, time, seek }) {
  const width = Math.max(720, duration * 100);
  const scroller = useRef(null);
  const [autoFollow, setAutoFollow] = useState(true);
  useEffect(() => {
    const node=scroller.current;
    if (!autoFollow || !node || !duration) return;
    const x=time/duration*width;
    if(x>node.scrollLeft+node.clientWidth*.82||x<node.scrollLeft) node.scrollTo({left:Math.max(0,x-node.clientWidth*.2),behavior:'smooth'});
  },[autoFollow,duration,time,width]);
  const seekFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left + event.currentTarget.scrollLeft;
    seek(Math.max(0, Math.min(duration, (x / width) * duration)));
  };
  return <section className="timeline-card glass"><div className="timeline-head"><span className="eyebrow">MELODY TIMELINE</span><label className="toggle-label"><input type="checkbox" checked={autoFollow} onChange={e=>setAutoFollow(e.target.checked)}/>Auto-follow</label></div>
    <div ref={scroller} className="timeline-scroll" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); seekFromPointer(e); }} onPointerMove={e => { if (e.buttons === 1) seekFromPointer(e); }}>
      <div className="timeline-roll" style={{ width }}><div className="timeline-lanes">{['C','D','E','F','G','A','B'].map((p,i)=><div className="timeline-lane" key={p}><span>{p}</span></div>)}</div>
        {notes.map(n => <button key={n.id} title={`${n.note} · ${n.start_s.toFixed(2)}s`} className={`timeline-note ${!n.is_natural?'timeline-note--accidental':''} ${time>=n.start_s&&time<n.end_s?'is-active':''}`} style={{left:`${n.start_s/duration*100}%`,width:`${Math.max(.7,(n.end_s-n.start_s)/duration*100)}%`,top:`${(6-(['C','D','E','F','G','A','B'].indexOf(n.pitch_class[0])))*14.285}%`,backgroundColor:colors[n.pitch_class[0]]}} onClick={() => seek(n.start_s)} />)}
        <div className="timeline-playhead" style={{ left:`${duration?time/duration*100:0}%` }} />
      </div>
    </div>
  </section>;
}
