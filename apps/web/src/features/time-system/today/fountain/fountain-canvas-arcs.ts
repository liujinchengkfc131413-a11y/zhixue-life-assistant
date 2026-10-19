import { resolveWaterArcProfile } from './water-arc.js';
import {
  parseFountainPath,
  quadraticPoint,
  WATER_COLORS,
  withAlpha,
  type FountainCanvasFrame,
} from './fountain-canvas-shared.js';

export const drawCanvasArcStreams = ({
  ctx,
  geometry,
  model,
  time,
  reducedMotion,
  lowPerformance,
}: FountainCanvasFrame): void => {
  const profile = resolveWaterArcProfile(model);
  for (const stream of geometry.streams) {
    const [startX, startY, controlX, baseControlY, endX, endY] = parseFountainPath(stream.path);
    if ([startX, startY, controlX, baseControlY, endX, endY].some((value) => value === undefined))
      continue;
    const sx = startX ?? 0;
    const sy = startY ?? 0;
    const cx = controlX ?? 0;
    const ey = endY ?? 0;
    const ex = endX ?? 0;
    const phase = stream.index * 0.37 + (stream.side === 'LEFT' ? 0 : 0.9);
    const cy =
      (baseControlY ?? 0) +
      Math.sin(time * (0.72 + model.pressure.flowSpeed * 0.58) + phase) *
        (1.2 + model.pressure.turbulence * 5.4) *
        profile.warpScale;
    const path = new Path2D(
      `M ${String(sx)} ${String(sy)} Q ${String(cx)} ${String(cy)} ${String(ex)} ${String(ey)}`,
    );
    const layerAlpha = stream.layer === 'BACK' ? 0.28 : stream.layer === 'MID' ? 0.38 : 0.5;
    const alpha = layerAlpha * stream.opacity;
    const color = WATER_COLORS[stream.colorHint];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = withAlpha(color.base, alpha * 0.5);
    ctx.lineWidth = stream.width * 0.72;
    ctx.lineCap = 'round';
    ctx.shadowColor = withAlpha(color.base, alpha * 0.34);
    ctx.shadowBlur = Math.max(4, stream.width * 0.8);
    ctx.stroke(path);
    ctx.shadowBlur = 0;
    const gradient = ctx.createLinearGradient(sx, sy, ex, ey);
    gradient.addColorStop(0, withAlpha(color.light, alpha * 0.72));
    gradient.addColorStop(1, withAlpha(color.base, alpha * 0.26));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = stream.width * 0.4;
    ctx.stroke(path);
    if (!reducedMotion) {
      const cycle =
        (time * (0.16 + model.pressure.flowSpeed * 0.28) * profile.cycleSpeed + phase * 0.13) % 1;
      for (let bead = 0; bead < (lowPerformance ? 1 : 3); bead += 1) {
        const point = quadraticPoint(sx, sy, cx, cy, ex, ey, (cycle + bead * 0.29) % 1);
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(0.7, stream.width * 0.055), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,248,${String(0.18 + model.pressure.highlightIntensity * 0.25)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }
};
