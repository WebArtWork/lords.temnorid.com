import { REGION_BIAS } from '../farm/farm.generator';
import { Point } from '../map/map-geometry';
import { RegionId } from '../region/region.interface';
import { RESOURCES } from '../resource/resource.data';
import { WorldCounts, WorldTerrain } from './world.interface';

/**
 * The shared world: an endless grid of tiles around the heart at (0|0). x grows to the east,
 * y to the south.
 *
 * Terrain is a pure function of the coordinates and WORLD_SEED, so every player sees the same land
 * and none of it is stored. Never change WORLD_SEED or the terrain maths: villages already stand on
 * that land.
 *
 * The world grows by quarter. Each quarter places its villages on its own widening rings, and its
 * explored area reaches just past its newest ring. A busy north-west pushes its frontier out while a
 * quiet south-east stays small, so the west edge and the east edge are separate frontiers.
 */
export const WORLD_SEED = 0x7e3a0d1f;
/** Tiles from the heart, in every direction, kept free of villages. */
export const WORLD_HEART = 2;
/** Villages settle one per cell of this many tiles, so neighbours keep a little land between them. */
export const WORLD_SPACING = 4;
/** Explored land beyond a quarter's outermost ring of villages. */
export const WORLD_MARGIN = 4;

/** Below this noise value a tile is open grass; about a third of the land carries a resource. */
const FEATURE_THRESHOLD = 0.84;
/** Tiles per noise cell: the size of a typical forest or quarry. */
const NOISE_SCALE = 3.2;

const SIGN: Record<RegionId, [number, number]> = {
	'north-west': [-1, -1],
	'north-east': [1, -1],
	'south-east': [1, 1],
	'south-west': [-1, 1],
};

export function quadrantOf(x: number, y: number): RegionId {
	if (y < 0) {
		return x < 0 ? 'north-west' : 'north-east';
	}

	return x < 0 ? 'south-west' : 'south-east';
}

/** The tile of the quarter's `index`-th village. Inner rings fill first, so quarters grow outward. */
export function villageSpot(region: RegionId, index: number): Point {
	const { i, j } = _cell(index);
	const [sx, sy] = SIGN[region];
	const salt = WORLD_SEED ^ Math.imul(Object.keys(SIGN).indexOf(region) + 1, 0x9e3779b9);
	// A random spot inside the cell, so villages do not line up on a grid.
	const jx = Math.floor(_hash(i, j, salt) * (WORLD_SPACING - 1));
	const jy = Math.floor(_hash(j, i, salt ^ 0x5bd1e995) * (WORLD_SPACING - 1));

	return {
		x: sx * (WORLD_HEART + 1 + i * WORLD_SPACING + jx),
		y: sy * (WORLD_HEART + 1 + j * WORLD_SPACING + jy),
	};
}

/** How far from the heart a quarter is explored, given how many villages it holds. */
export function quadrantReach(count: number): number {
	const rings = Math.ceil(Math.sqrt(count));

	return WORLD_HEART + 1 + (rings + 1) * WORLD_SPACING + WORLD_MARGIN;
}

export function isExplored(x: number, y: number, counts: WorldCounts): boolean {
	const reach = quadrantReach(counts[quadrantOf(x, y)] ?? 0);

	return Math.abs(x) <= reach && Math.abs(y) <= reach;
}

/**
 * What covers a tile. Each resource has its own noise field, tilted toward the resources its
 * quarter is known for (the same leanings as farms), and the strongest field wins.
 */
export function terrainAt(x: number, y: number): WorldTerrain {
	if (Math.max(Math.abs(x), Math.abs(y)) <= WORLD_HEART) {
		return x === 0 && y === 0 ? 'heart' : 'grass';
	}

	const [vertical, horizontal] = quadrantOf(x, y).split('-') as ['north' | 'south', 'west' | 'east'];
	let best: WorldTerrain = 'grass';
	let bestValue = FEATURE_THRESHOLD;

	RESOURCES.forEach(({ id }, i) => {
		const bias = (REGION_BIAS[vertical][id] ?? 0) + (REGION_BIAS[horizontal][id] ?? 0);
		const value = _noise(x / NOISE_SCALE, y / NOISE_SCALE, WORLD_SEED + i * 1013) + bias * 0.12;

		if (value > bestValue) {
			best = id;
			bestValue = value;
		}
	});

	return best;
}

/** A stable 0–1 number per tile, for small decoration choices. */
export function tileVariant(x: number, y: number): number {
	return _hash(x, y, WORLD_SEED ^ 0x27d4eb2d);
}

// ---- Internals ----

/** Lattice cell of the `index`-th village: square rings, nearest cells of each ring first. */
function _cell(index: number): { i: number; j: number } {
	const ring = Math.floor(Math.sqrt(index));
	const cells: { i: number; j: number }[] = [];

	for (let j = 0; j <= ring; j++) {
		cells.push({ i: ring, j });
	}

	for (let i = 0; i < ring; i++) {
		cells.push({ i, j: ring });
	}

	cells.sort((a, b) => a.i * a.i + a.j * a.j - (b.i * b.i + b.j * b.j) || a.i - b.i);

	return cells[index - ring * ring]!;
}

/** Smooth value noise in 0–1. */
function _noise(fx: number, fy: number, seed: number): number {
	const x0 = Math.floor(fx);
	const y0 = Math.floor(fy);
	const tx = _smooth(fx - x0);
	const ty = _smooth(fy - y0);
	const top = _lerp(_hash(x0, y0, seed), _hash(x0 + 1, y0, seed), tx);
	const bottom = _lerp(_hash(x0, y0 + 1, seed), _hash(x0 + 1, y0 + 1, seed), tx);

	return _lerp(top, bottom, ty);
}

/** Integer hash of a tile to 0–1, identical in every browser. */
function _hash(x: number, y: number, seed: number): number {
	let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	h ^= h >>> 16;

	return (h >>> 0) / 4294967296;
}

function _smooth(t: number): number {
	return t * t * (3 - 2 * t);
}

function _lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}
