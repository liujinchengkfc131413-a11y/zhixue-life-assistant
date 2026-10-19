import { clamp } from './fountain-motion.js';
import type { FountainCanvasFrame } from './fountain-canvas-shared.js';

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}
interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  intensity: number;
}
interface Drift {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export class FountainCanvasParticleLayer {
  private drops: Drop[] = [];
  private ripples: Ripple[] = [];
  private drift: Drift[] = [];
  private accumulator = 0;

  public reset(lowPerformance: boolean): void {
    this.drops = [];
    this.ripples = [];
    this.drift = Array.from({ length: lowPerformance ? 8 : 18 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.72,
      vy: -0.24 - Math.random() * 0.72,
      size: 1 + Math.random() * 1.8,
    }));
  }

  public draw(frame: FountainCanvasFrame): void {
    this.drawDropsAndSplash(frame);
    this.drawRipples(frame);
    this.drawDrift(frame);
  }

  private drawDropsAndSplash(frame: FountainCanvasFrame): void {
    const { ctx, geometry, model, deltaMs, reducedMotion, lowPerformance } = frame;
    const budget = model.pressure.particleBudget;
    this.accumulator +=
      budget * 0.65 * model.domain.flowScale * (reducedMotion ? 0 : deltaMs / 1000);
    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      const landing =
        geometry.landingPoints[Math.floor(Math.random() * geometry.landingPoints.length)];
      if (landing === undefined) continue;
      this.drops.push({
        x: landing.x + (Math.random() - 0.5) * 10,
        y: landing.y - 2,
        vx: (Math.random() - 0.5) * (44 + model.pressure.spray * 70),
        vy: -34 - Math.random() * (42 + model.pressure.spray * 88),
        life: 0,
        maxLife: 620 + Math.random() * 520,
        size: 1 + Math.random() * 1.6,
      });
      this.ripples.push({
        x: landing.x,
        y: landing.y,
        radius: 4,
        maxRadius: 10 + model.pool.rippleFrequency * 18 + Math.random() * 8,
        life: 0,
        maxLife: 760,
        intensity: clamp(0.38 + model.pressure.spray * 0.62, 0, 1),
      });
    }
    const limit = lowPerformance ? 110 : Math.round(budget * 0.6);
    if (this.drops.length > limit) this.drops.splice(0, this.drops.length - limit);
    for (let index = this.drops.length - 1; index >= 0; index -= 1) {
      const drop = this.drops[index];
      if (drop === undefined) continue;
      const seconds = deltaMs / 1000;
      drop.life += deltaMs;
      drop.x += drop.vx * seconds;
      drop.y += drop.vy * seconds;
      drop.vy += 180 * seconds;
      if (drop.life >= drop.maxLife) {
        this.drops.splice(index, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,244,236,${String((1 - drop.life / drop.maxLife) * 0.75)})`;
      ctx.fill();
    }
  }

  private drawRipples({ ctx, model, deltaMs, lowPerformance }: FountainCanvasFrame): void {
    for (let index = this.ripples.length - 1; index >= 0; index -= 1) {
      const ripple = this.ripples[index];
      if (ripple === undefined) continue;
      ripple.life += deltaMs;
      const progress = ripple.life / ripple.maxLife;
      ripple.radius = ripple.maxRadius * (0.2 + 0.8 * progress);
      if (progress >= 1) {
        this.ripples.splice(index, 1);
        continue;
      }
      if (progress < 0.26) {
        const burst = 1 - progress / 0.26;
        for (let ray = 0; ray < (lowPerformance ? 3 : 7); ray += 1) {
          const angle = (ray / (lowPerformance ? 3 : 7)) * Math.PI + Math.PI;
          ctx.beginPath();
          ctx.moveTo(ripple.x, ripple.y - 1);
          ctx.lineTo(
            ripple.x + Math.cos(angle) * 18 * burst,
            ripple.y + Math.sin(angle) * 6 * burst - 3,
          );
          ctx.strokeStyle = `rgba(234,255,245,${String(burst * 0.24)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, ripple.radius, ripple.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180,228,216,${String((1 - progress) * (0.2 + model.pool.rippleStrength * 0.48))})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  private drawDrift({
    ctx,
    deltaMs,
    reducedMotion,
    time,
    width,
    height,
  }: FountainCanvasFrame): void {
    if (reducedMotion) return;
    for (const particle of this.drift) {
      particle.x += (particle.vx * deltaMs) / 1000;
      particle.y += (particle.vy * deltaMs) / 1000;
      if (particle.y < -0.05) {
        particle.y = 1.02;
        particle.x = Math.random();
      }
      if (particle.x < -0.05) particle.x = 1.05;
      if (particle.x > 1.05) particle.x = -0.05;
      ctx.beginPath();
      ctx.arc(particle.x * width, particle.y * height, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,240,230,${String(clamp(0.16 + Math.sin(time * 1.4 + particle.x * 12) * 0.08, 0.04, 0.3))})`;
      ctx.fill();
    }
  }
}
