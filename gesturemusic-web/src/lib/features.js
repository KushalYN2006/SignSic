const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export function extractFeatures(landmarks, worldLandmarks, handedness, flipHandedness = false) {
  if (!landmarks || landmarks.length !== 21) return null;
  const source = worldLandmarks?.length === 21 ? worldLandmarks : landmarks;
  const pts = source.map(({ x, y, z = 0 }) => ({ x, y, z }));
  const origin = pts[0];
  const scale = distance(origin, pts[9]) || 1;
  const label = String(handedness || '').toLowerCase();
  const shouldMirror = (label.includes('left') !== Boolean(flipHandedness));

  // Keep orientation in the feature vector: rotating the points would erase distinctions between Re, Mi, and Sol.
  const normalized = pts.map((point) => {
    const rel = { x: (point.x - origin.x) / scale, y: (point.y - origin.y) / scale, z: (point.z - origin.z) / scale };
    if (shouldMirror) rel.x *= -1;
    return rel;
  });

  const palm = cross(subtract(normalized[5], normalized[0]), subtract(normalized[17], normalized[0]));
  const palmLength = Math.hypot(palm.x, palm.y, palm.z) || 1;
  const palmNormal = [palm.x / palmLength, palm.y / palmLength, palm.z / palmLength];
  const tipIds = [4, 8, 12, 16, 20];
  const mcpIds = [2, 5, 9, 13, 17];
  const curl = tipIds.map((tip, index) => distance(normalized[tip], normalized[0]) / (distance(normalized[mcpIds[index]], normalized[0]) || 1));
  const imageTilt = Math.atan2(landmarks[9].y - landmarks[0].y, landmarks[9].x - landmarks[0].x);
  const values = [...normalized.flatMap((p) => [p.x, p.y, p.z]), ...palmNormal, ...curl, imageTilt];
  return Float32Array.from(values);
}

export function augmentFeatures(features, { scale = 0, angle = 0, noise = 0 } = {}) {
  const copy = Float32Array.from(features);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(Math.random(), 1e-8))) * Math.cos(2 * Math.PI * Math.random());
  for (let i = 0; i < 21; i += 1) {
    const x = copy[i * 3];
    const y = copy[i * 3 + 1];
    copy[i * 3] = (x * cos - y * sin) * (1 + scale) + gaussian() * noise;
    copy[i * 3 + 1] = (x * sin + y * cos) * (1 + scale) + gaussian() * noise;
    copy[i * 3 + 2] += gaussian() * noise;
  }
  return copy;
}
