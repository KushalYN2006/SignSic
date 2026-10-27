import { useHandTracking } from '../hooks/useHandTracking';
import { startAudio } from '../lib/audio';

export function useWebcam(enabled = true, flipHandedness) { return useHandTracking(enabled, flipHandedness); }

export default function WebcamPanel({ tracker, showRaw, onToggleRaw, className = '' }) {
  const { videoRef, canvasRef, status, error, hand, fps, start, stop } = tracker;
  return <section className={`webcam-panel glass ${className}`}>
    <div className="webcam-stage">
      <video ref={videoRef} className={`webcam-video ${showRaw ? '' : 'is-hidden'}`} muted playsInline />
      <canvas ref={canvasRef} className="landmark-canvas" />
      {!hand && <div className="camera-empty"><span className="camera-glyph">◎</span><strong>{status === 'loading' ? 'Loading camera…' : status === 'error' ? 'Camera unavailable' : 'Camera ready'}</strong><small>{status === 'error' ? error : 'Start the camera to see hand landmarks'}</small></div>}
      {hand && <div className="camera-hud"><span>Hand detected</span><span>{fps || '—'} FPS</span></div>}
    </div>
    <div className="webcam-controls">
      <button className="button button--aqua" onClick={() => { if (status === 'idle' || status === 'error') { void startAudio(); void start(); } else stop(); }}>{status === 'idle' || status === 'error' ? 'Start camera' : 'Stop camera'}</button>
      <label className="toggle-label"><input type="checkbox" checked={showRaw} onChange={(e) => onToggleRaw(e.target.checked)} /><span>Show video</span></label>
      {status === 'error' && <small className="error-text">{error}</small>}
    </div>
  </section>;
}
