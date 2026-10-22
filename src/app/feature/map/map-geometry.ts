/** Shared geometry for the generated maps: seeded randomness, even point spreads, soft shapes. */

export const TAU = Math.PI * 2;

export interface Point {
	x: number;
	y: number;
}

/** An irregular oval: an ellipse whose radius wobbles with a few sine harmonics. */
export interface Blob {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	harmonics: { k: number; a: number; p: number }[];
}

export function makeBlob(rng: Rng, cx: number, cy: number, rx: number, ry: number, wobble: number): Blob {
	const harmonics = [2, 3, 4, 5].map((k) => ({
		k,
		a: (rng() * wobble) / (k - 1),
		p: rng() * TAU,
	}));

	return { cx, cy, rx, ry, harmonics };
}

export function blobRadius(blob: Blob, angle: number): number {
	return blob.harmonics.reduce((r, h) => r + h.a * Math.sin(h.k * angle + h.p), 1);
}

/** Angle and distance in the blob's own unit-circle space. */
export function blobPolar(blob: Blob, x: number, y: number) {
	const nx = (x - blob.cx) / blob.rx;
	const ny = (y - blob.cy) / blob.ry;

	return { angle: Math.atan2(ny, nx), distance: Math.hypot(nx, ny) };
}

/** Whether a point lies inside the blob grown or shrunk by `scale`. */
export function inBlob(blob: Blob, x: number, y: number, scale: number): boolean {
	const { angle, distance } = blobPolar(blob, x, y);

	return distance <= scale * blobRadius(blob, angle);
}

export function blobPoint(blob: Blob, angle: number, scale: number): Point {
	const r = scale * blobRadius(blob, angle);

	return {
		x: blob.cx + blob.rx * r * Math.cos(angle),
		y: blob.cy + blob.ry * r * Math.sin(angle),
	};
}

export function blobPath(blob: Blob, scale: number, steps = 48): string {
	const points = Array.from({ length: steps }, (_, i) => blobPoint(blob, (i / steps) * TAU, scale));

	return closedCurve(points);
}

export type Rng = () => number;

/** A fresh random seed for a new map. Browser only. */
export function createSeed(): number {
	return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** mulberry32: small, fast, and identical in every browser. */
export function seededRng(seed: number): Rng {
	let state = seed >>> 0;

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function range(rng: Rng, min: number, max: number): number {
	return min + rng() * (max - min);
}

/**
 * Poisson-disc sampling (Bridson): points spread evenly, never closer than `minDistance`, only
 * where `accept` allows.
 */
export function poisson(
	rng: Rng,
	width: number,
	height: number,
	minDistance: number,
	accept: (x: number, y: number) => boolean,
): Point[] {
	const cell = minDistance / Math.SQRT2;
	const columns = Math.ceil(width / cell);
	const rows = Math.ceil(height / cell);
	const grid = new Int32Array(columns * rows).fill(-1);
	const points: Point[] = [];
	const active: number[] = [];

	const fits = (p: Point) => {
		if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height || !accept(p.x, p.y)) {
			return false;
		}

		const column = Math.floor(p.x / cell);
		const row = Math.floor(p.y / cell);

		for (let r = Math.max(0, row - 2); r <= Math.min(rows - 1, row + 2); r++) {
			for (let c = Math.max(0, column - 2); c <= Math.min(columns - 1, column + 2); c++) {
				const index = grid[r * columns + c]!;

				if (index >= 0 && pointDistance(points[index]!, p) < minDistance) {
					return false;
				}
			}
		}

		return true;
	};

	const add = (p: Point) => {
		grid[Math.floor(p.y / cell) * columns + Math.floor(p.x / cell)] = points.length;
		active.push(points.length);
		points.push(p);
	};

	for (let i = 0; i < 300 && !points.length; i++) {
		const p = { x: rng() * width, y: rng() * height };

		if (fits(p)) {
			add(p);
		}
	}

	while (active.length) {
		const slot = Math.floor(rng() * active.length);
		const base = points[active[slot]!]!;
		let found = false;

		for (let k = 0; k < 30; k++) {
			const angle = rng() * TAU;
			const radius = minDistance * (1 + rng());
			const candidate = {
				x: base.x + Math.cos(angle) * radius,
				y: base.y + Math.sin(angle) * radius,
			};

			if (fits(candidate)) {
				add(candidate);
				found = true;
				break;
			}
		}

		if (!found) {
			active.splice(slot, 1);
		}
	}

	return points;
}

/** A road between two points with a gentle random bend. */
export function bentLine(rng: Rng, a: Point, b: Point): string {
	const bend = range(rng, -0.18, 0.18);
	const control = {
		x: (a.x + b.x) / 2 - (b.y - a.y) * bend,
		y: (a.y + b.y) / 2 + (b.x - a.x) * bend,
	};

	return `M${round1(a.x)} ${round1(a.y)} Q${round1(control.x)} ${round1(control.y)} ${round1(b.x)} ${round1(b.y)}`;
}

/** Smooth closed outline through the points (Catmull-Rom as cubic Béziers). */
export function closedCurve(points: Point[]): string {
	const n = points.length;
	let d = `M${round1(points[0]!.x)} ${round1(points[0]!.y)}`;

	for (let i = 0; i < n; i++) {
		d += segment(points[(i - 1 + n) % n]!, points[i]!, points[(i + 1) % n]!, points[(i + 2) % n]!);
	}

	return `${d}Z`;
}

/** Smooth open line through the points. */
export function openCurve(points: Point[]): string {
	const last = points.length - 1;
	let d = `M${round1(points[0]!.x)} ${round1(points[0]!.y)}`;

	for (let i = 0; i < last; i++) {
		d += segment(points[Math.max(0, i - 1)]!, points[i]!, points[i + 1]!, points[Math.min(last, i + 2)]!);
	}

	return d;
}

function segment(p0: Point, p1: Point, p2: Point, p3: Point): string {
	const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
	const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };

	return ` C${round1(c1.x)} ${round1(c1.y)} ${round1(c2.x)} ${round1(c2.y)} ${round1(p2.x)} ${round1(p2.y)}`;
}

export function pointDistance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToLine(p: Point, line: Point[]): number {
	let best = Infinity;

	for (let i = 0; i < line.length - 1; i++) {
		const a = line[i]!;
		const b = line[i + 1]!;
		const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
		const t = lengthSquared
			? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / lengthSquared))
			: 0;

		best = Math.min(best, pointDistance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }));
	}

	return best;
}

/** Angle in [0, 2π). */
export function normaliseAngle(angle: number): number {
	return ((angle % TAU) + TAU) % TAU;
}

/** Signed difference between two angles, in (-π, π]. */
export function angleBetween(a: number, b: number): number {
	const difference = normaliseAngle(a - b);

	return difference > Math.PI ? difference - TAU : difference;
}

export function round1(value: number): number {
	return Math.round(value * 10) / 10;
}
