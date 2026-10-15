import { RoutePoint } from '../types';

export const routeMeters = (points: RoutePoint[]) => points.slice(1).reduce((sum, b, index) => {
  const a = points[index], rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return sum + 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}, 0);

export const parseRunTime = (text: string): number => {
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(text)) return NaN;
  const parts = text.split(':').map(Number);
  if (parts.slice(1).some(value => value >= 60)) return NaN;
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
};

// New recordings preserve active elapsed time (excluding pauses). Older GPS
// traces use timestamp proportions; traces without times fall back to distance.
export const routeTimeline = (points: RoutePoint[], duration: number): number[] => {
  const elapsed = points.map(point => point.elapsedSeconds);
  if (elapsed.every((value, index) => Number.isFinite(value) && value! >= 0 && value! <= duration && (!index || value! >= elapsed[index - 1]!))) {
    return elapsed as number[];
  }
  const first = points[0]?.timestamp, last = points[points.length - 1]?.timestamp;
  if (Number.isFinite(first) && Number.isFinite(last) && last! > first!
    && points.every((point, index) => Number.isFinite(point.timestamp) && (!index || point.timestamp! >= points[index - 1].timestamp!))) {
    return points.map(point => (point.timestamp! - first!) / (last! - first!) * duration);
  }
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) cumulative.push(cumulative[index - 1] + routeMeters([points[index - 1], points[index]]));
  const total = cumulative[cumulative.length - 1];
  return cumulative.map((value, index) => total > 0 ? value / total * duration : index / Math.max(1, points.length - 1) * duration);
};

export const trimRoute = (points: RoutePoint[], duration: number, start: number, end: number) => {
  if (points.length < 2 || !Number.isFinite(duration) || !Number.isFinite(start) || !Number.isFinite(end)
    || start < 0 || end > duration || end - start < 5) throw new Error('Keep at least 5 seconds within the original run.');
  const times = routeTimeline(points, duration);
  const sample = (time: number): RoutePoint => {
    let right = times.findIndex(value => value >= time);
    if (right < 0) right = points.length - 1;
    if (right === 0) return { ...points[0] };
    const a = points[right - 1], b = points[right];
    const span = times[right] - times[right - 1];
    const fraction = span > 0 ? Math.max(0, Math.min(1, (time - times[right - 1]) / span)) : 1;
    // Follow the shorter longitude arc when crossing the date line.
    const delta = ((b.longitude - a.longitude + 540) % 360) - 180;
    return {
      latitude: a.latitude + (b.latitude - a.latitude) * fraction,
      longitude: ((a.longitude + delta * fraction + 540) % 360) - 180,
      timestamp: a.timestamp != null && b.timestamp != null ? a.timestamp + (b.timestamp - a.timestamp) * fraction : undefined,
    };
  };
  const kept = [
    { ...sample(start), elapsedSeconds: 0 },
    ...points.flatMap((point, index) => times[index] > start && times[index] < end ? [{ ...point, elapsedSeconds: times[index] - start }] : []),
    { ...sample(end), elapsedSeconds: end - start },
  ];
  return { points: kept, duration: end - start, meters: routeMeters(kept) };
};
