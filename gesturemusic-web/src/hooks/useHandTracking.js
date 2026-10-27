import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { FLIP_HANDEDNESS, MAX_INFERENCE_FPS } from '../config';
import { extractFeatures } from '../lib/features';

export function useHandTracking(enabled = true, flipHandedness = FLIP_HANDEDNESS) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(0);
  const loopRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const lastInferAtRef = useRef(0);
  const previousInferAtRef = useRef(0);
  const latestRef = useRef(null);
  const flipRef = useRef(flipHandedness);
  flipRef.current = flipHandedness;
  const [state, setState] = useState({ status: 'idle', error: '', hand: null, fps: 0 });

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    latestRef.current = null;
    setState((current) => ({ ...current, status: 'idle', hand: null }));
  }, []);

  const start = useCallback(async () => {
    if (!enabled || streamRef.current) return;
    setState((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot access a webcam. Open the app on localhost or HTTPS.');
      const vision = await FilesetResolver.forVisionTasks('/models/wasm');
      try {
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO', numHands: 1,
          minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        });
      } catch {
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'CPU' },
          runningMode: 'VIDEO', numHands: 1,
          minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        });
      }
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      await video.play();
      setState((current) => ({ ...current, status: 'ready', error: '' }));

      const loop = (now) => {
        if (document.hidden) { rafRef.current = 0; return; }
        rafRef.current = requestAnimationFrame(loop);
        if (!video || video.readyState < 2 || video.currentTime === lastVideoTimeRef.current) return;
        if (now - lastInferAtRef.current < 1000 / MAX_INFERENCE_FPS) return;
        const elapsed = previousInferAtRef.current ? now - previousInferAtRef.current : 0;
        previousInferAtRef.current = now;
        lastInferAtRef.current = now;
        lastVideoTimeRef.current = video.currentTime;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        let result;
        try {
          result = landmarkerRef.current.detectForVideo(video, now);
        } catch (error) {
          setState((current) => ({ ...current, status: 'error', error: error.message }));
          return;
        }
        const landmarks = result.landmarks?.[0] || null;
        const worldLandmarks = result.worldLandmarks?.[0] || null;
        const category = result.handednesses?.[0]?.[0] || result.handedness?.[0]?.[0];
        const handedness = category?.categoryName || category?.displayName || 'Right';
        if (landmarks) {
          const features = extractFeatures(landmarks, worldLandmarks, handedness, flipRef.current);
          context.fillStyle = '#4fd1c5';
          landmarks.forEach((point) => {
            context.beginPath();
            context.arc(point.x * width, point.y * height, Math.max(3, width * 0.004), 0, Math.PI * 2);
            context.fill();
          });
          const hand = { landmarks, worldLandmarks, handedness, features, timestamp: now, confidence: category?.score ?? 0.75 };
          latestRef.current = hand;
          setState((current) => ({ ...current, status: 'tracking', hand, fps: elapsed ? Math.round(1000 / elapsed) : 0 }));
        } else {
          latestRef.current = null;
          setState((current) => ({ ...current, status: 'ready', hand: null }));
        }
      };
      loopRef.current = loop;
      rafRef.current = requestAnimationFrame(loop);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setState((current) => ({ ...current, status: 'error', error: error.message || 'Could not start the camera.' }));
    }
  }, [enabled]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
  }, []);

  useEffect(() => {
    const resume = () => {
      if (!document.hidden && streamRef.current && loopRef.current && !rafRef.current) {
        rafRef.current = requestAnimationFrame(loopRef.current);
      }
    };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, []);

  return { videoRef, canvasRef, latestRef, ...state, start, stop };
}
