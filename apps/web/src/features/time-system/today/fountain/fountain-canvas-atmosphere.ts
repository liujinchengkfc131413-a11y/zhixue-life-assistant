import { resolveLightingProfile } from './lighting.js';
import { resolveMistProfile } from './mist-system.js';
import type { FountainCanvasFrame } from './fountain-canvas-shared.js';

export const drawCanvasMist = ({
  ctx,
  geometry,
  model,
  time,
  reducedMotion,
  lowPerformance,
}: FountainCanvasFrame): void => {
  const profile = resolveMistProfile(model);
  if (profile.density <= 0.01) return;
  const count = reducedMotion ? 8 : Math.round(12 + profile.density * (lowPerformance ? 24 : 48));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < count; index += 1) {
    const seed = (index * 0.61803398875) % 1;
    const rise = reducedMotion ? seed : (seed + time * profile.riseSpeed) % 1;
    const angle =
      (seed + (reducedMotion ? 0 : Math.sin(time * 0.42 + index * 1.73) * 0.08)) * Math.PI * 2;
    const x =
      geometry.pool.cx + Math.cos(angle) * geometry.pool.rx * (0.08 + seed * profile.spread);
    const y =
      geometry.pool.cy - geometry.pool.ry * (0.08 + rise * (0.55 + model.domain.mistBoost * 0.32));
    const radius = 9 + profile.density * 22 + (index % 4) * 3;
    const mist = ctx.createRadialGradient(x, y, 0, x, y, radius);
    mist.addColorStop(0, `rgba(218,250,241,${String(0.025 + profile.density * 0.085)})`);
    mist.addColorStop(1, 'rgba(205,244,234,0)');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = mist;
    ctx.fill();
  }
  ctx.restore();
};

export const drawCanvasLighting = ({ ctx, geometry, model }: FountainCanvasFrame): void => {
  const profile = resolveLightingProfile(model);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const key = ctx.createRadialGradient(
    geometry.crown.x,
    geometry.crown.y,
    0,
    geometry.crown.x,
    geometry.crown.y,
    geometry.pool.rx * 0.58,
  );
  key.addColorStop(
    0,
    `rgba(${String(profile.keyColor[0])},${String(profile.keyColor[1])},${String(profile.keyColor[2])},${String(model.lighting.keyLight * 0.12)})`,
  );
  key.addColorStop(1, 'rgba(166,238,217,0)');
  ctx.fillStyle = key;
  ctx.fillRect(
    geometry.pool.cx - geometry.pool.rx,
    geometry.crown.y - geometry.pool.ry,
    geometry.pool.rx * 2,
    geometry.pool.ry * 3,
  );
  const reflected = ctx.createRadialGradient(
    geometry.pool.cx,
    geometry.pool.cy,
    0,
    geometry.pool.cx,
    geometry.pool.cy,
    geometry.pool.rx * 0.86,
  );
  reflected.addColorStop(0, `rgba(190,255,229,${String(model.lighting.reflectedLight * 0.06)})`);
  reflected.addColorStop(1, 'rgba(88,200,183,0)');
  ctx.beginPath();
  ctx.ellipse(
    geometry.pool.cx,
    geometry.pool.cy,
    geometry.pool.rx,
    geometry.pool.ry,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = reflected;
  ctx.fill();
  ctx.restore();
};
