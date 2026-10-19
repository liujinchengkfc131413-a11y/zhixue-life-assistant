import type { FountainCanvasFrame } from './fountain-canvas-shared.js';

export const drawCanvasWaterSurface = ({
  ctx,
  geometry,
  model,
  time,
  reducedMotion,
  lowPerformance,
}: FountainCanvasFrame): void => {
  const { pool } = geometry;
  const agitation = 1 - model.pool.calmness;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.ellipse(pool.cx, pool.cy, pool.rx, pool.ry, 0, 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(pool.cx, pool.cy, 0, pool.cx, pool.cy, pool.rx);
  glow.addColorStop(0, `rgba(212,255,241,${String(0.08 + model.pressure.glowIntensity * 0.12)})`);
  glow.addColorStop(0.55, `rgba(94,210,190,${String(0.03 + agitation * 0.05)})`);
  glow.addColorStop(1, 'rgba(48,150,140,0)');
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(pool.cx, pool.cy, pool.rx * 0.91, pool.ry * 0.72, 0, 0, Math.PI * 2);
  ctx.clip();
  const waveCount = lowPerformance ? 8 : 16;
  for (let index = 0; index < waveCount; index += 1) {
    const row = (index + 1) / (waveCount + 1);
    const phase = reducedMotion
      ? index * 0.71
      : time * (0.34 + model.pool.waveSpeed) + index * 0.71;
    ctx.beginPath();
    for (let step = 0; step <= 24; step += 1) {
      const progress = step / 24;
      const x = pool.cx - pool.rx * 0.84 + progress * pool.rx * 1.68;
      const y =
        pool.cy -
        pool.ry * 0.55 +
        row * pool.ry * 1.05 +
        Math.sin(progress * Math.PI * (3.4 + (index % 3)) + phase) *
          (0.8 + model.pool.distortion * 4.2) *
          Math.sin(progress * Math.PI);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(218,255,241,${String(0.02 + model.pool.reflectionIntensity * 0.06)})`;
    ctx.lineWidth = 0.7 + model.pool.distortion * 0.7;
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
};
