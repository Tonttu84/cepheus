export interface SeededRng {
  /** Uniform float in [0, 1) */
  next(): number;
  /** Uniform float in [min, max) */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** Gaussian random number with given mean and standard deviation (Box-Muller) */
  normal(mean?: number, sd?: number): number;
  /** Clamp a numeric value into [min, max] */
  clamp(val: number, min: number, max: number): number;
}

/**
 * Deterministic Mulberry32 PRNG.
 * Given the same integer seed, produces the exact same sequence across all platforms.
 */
export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  let spareGaussian: number | null = null;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (min: number, max: number): number => {
    return min + next() * (max - min);
  };

  const int = (min: number, max: number): number => {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(next() * (high - low + 1)) + low;
  };

  const normal = (mean = 0, sd = 1): number => {
    if (spareGaussian !== null) {
      const z = spareGaussian;
      spareGaussian = null;
      return mean + z * sd;
    }
    let u = 0;
    let v = 0;
    while (u <= 1e-12) {
      u = next();
    }
    v = next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const z0 = mag * Math.cos(2.0 * Math.PI * v);
    const z1 = mag * Math.sin(2.0 * Math.PI * v);
    spareGaussian = z1;
    return mean + z0 * sd;
  };

  const clamp = (val: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, val));
  };

  return {
    next,
    range,
    int,
    normal,
    clamp,
  };
}
