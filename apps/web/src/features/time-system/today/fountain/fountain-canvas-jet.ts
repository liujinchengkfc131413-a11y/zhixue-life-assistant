import { resolveWaterJetProfile } from './water-jet.js';
import type { FountainCanvasFrame } from './fountain-canvas-shared.js';

export const drawCanvasMainJet = ({
  ctx,
  geometry,
  model,
  time,
  lowPerformance,
}: FountainCanvasFrame): void => {
  const { column } = geometry;
  const profile = resolveWaterJetProfile(model, lowPerformance);
  const breathe = 1 + Math.sin(time * profile.breatheSpeed) * profile.breatheAmount;
  const topWidth = column.topWidth * breathe;
  const baseWidth = column.baseWidth * breathe;
  const body = new Path2D();
  body.moveTo(column.topX, column.topY - topWidth * 0.34);
  body.quadraticCurveTo(
    column.topX - topWidth * 0.62,
    column.topY,
    column.topX - topWidth / 2,
    column.topY + topWidth * 0.34,
  );
  body.bezierCurveTo(
    column.topX - topWidth,
    column.topY + (column.baseY - column.topY) * 0.36,
    column.topX - baseWidth * 0.42,
    column.topY + (column.baseY - column.topY) * 0.72,
    column.topX - baseWidth / 2,
    column.baseY,
  );
  body.lineTo(column.topX + baseWidth / 2, column.baseY);
  body.bezierCurveTo(
    column.topX + baseWidth * 0.42,
    column.topY + (column.baseY - column.topY) * 0.72,
    column.topX + topWidth,
    column.topY + (column.baseY - column.topY) * 0.36,
    column.topX + topWidth / 2,
    column.topY + topWidth * 0.34,
  );
  body.quadraticCurveTo(
    column.topX + topWidth * 0.62,
    column.topY,
    column.topX,
    column.topY - topWidth * 0.34,
  );
  body.closePath();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const gradient = ctx.createLinearGradient(
    column.topX - baseWidth / 2,
    0,
    column.topX + baseWidth / 2,
    0,
  );
  gradient.addColorStop(0, 'rgba(66,174,163,0.1)');
  gradient.addColorStop(
    0.5,
    `rgba(250,255,244,${String(0.34 + model.pressure.highlightIntensity * 0.24)})`,
  );
  gradient.addColorStop(1, 'rgba(67,164,157,0.08)');
  ctx.fillStyle = gradient;
  ctx.shadowColor = `rgba(155,239,219,${String(0.18 + model.pressure.glowIntensity * 0.32)})`;
  ctx.shadowBlur = 8 + model.pressure.glowIntensity * 16;
  ctx.fill(body);
  ctx.restore();
};

export const drawCanvasCrownSpray = ({
  ctx,
  geometry,
  model,
  time,
  reducedMotion,
  lowPerformance,
}: FountainCanvasFrame): void => {
  const count = resolveWaterJetProfile(model, lowPerformance).crownParticleCount;
  const reach = 14 + model.pressure.spray * 34;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < count; index += 1) {
    const seed = (index * 0.61803398875) % 1;
    const phase = reducedMotion ? seed : (seed + time * (0.16 + (index % 5) * 0.018)) % 1;
    const direction = index % 2 === 0 ? -1 : 1;
    const fan = 0.25 + ((index * 7) % 13) / 13;
    ctx.beginPath();
    ctx.arc(
      geometry.crown.x + direction * fan * reach * phase,
      geometry.crown.y - phase * reach * (0.7 + fan * 0.65),
      0.7 + (index % 3) * 0.4,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgba(244,255,248,${String((1 - phase) * (0.18 + model.pressure.highlightIntensity * 0.34))})`;
    ctx.fill();
  }
  ctx.restore();
};
