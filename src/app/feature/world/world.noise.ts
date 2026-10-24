/** Deterministic hashing and value noise shared by the world's terrain and its geography. */

/** Integer hash of a tile to 0–1, identical in every browser. */
export function hash2(x: number, y: number, seed: number): number {
	let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	h ^= h >>> 16;

	return (h >>> 0) / 4294967296;
}

/** Smooth value noise in 0–1. */
export function valueNoise(fx: number, fy: number, seed: number): number {
	const x0 = Math.floor(fx);
	const y0 = Math.floor(fy);
	const tx = smooth(fx - x0);
	const ty = smooth(fy - y0);
	const top = lerp(hash2(x0, y0, seed), hash2(x0 + 1, y0, seed), tx);
	const bottom = lerp(hash2(x0, y0 + 1, seed), hash2(x0 + 1, y0 + 1, seed), tx);

	return lerp(top, bottom, ty);
}

export function smooth(t: number): number {
	return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}
