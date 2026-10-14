import { RoutePoint } from '../types';
const metersBetween = (a: RoutePoint, b: RoutePoint) => {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians, dLon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
};

export const replayFrame = (points: RoutePoint[], progress: number) => {
  if (points.length < 2) return { points, fraction: 0 };
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + metersBetween(points[i - 1], points[i]));
  const timestamps = points.map(p => p.timestamp || 0);
  const timed = timestamps[0] > 0 && timestamps.every((t, i) => !i || t > timestamps[i - 1]);
  const steps = timed ? timestamps.map(t => t - timestamps[0]) : cumulative;
  const target = Math.max(0, Math.min(1, progress)) * steps[steps.length - 1];
  let index = 1;
  while (index < steps.length - 1 && steps[index] < target) index++;
  const amount = steps[index] > steps[index - 1] ? (target - steps[index - 1]) / (steps[index] - steps[index - 1]) : 0;
  const a = points[index - 1], b = points[index];
  const head = { latitude: a.latitude + (b.latitude - a.latitude) * amount, longitude: a.longitude + (b.longitude - a.longitude) * amount };
  return { points: [...points.slice(0, index), head], fraction: cumulative[cumulative.length - 1] > 0 ? (cumulative[index - 1] + (cumulative[index] - cumulative[index - 1]) * amount) / cumulative[cumulative.length - 1] : progress };
};
