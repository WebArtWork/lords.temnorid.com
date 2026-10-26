import { REGION_BIAS } from '../region/region.bias';
import { Point } from '../map/map-geometry';
import { RegionId } from '../region/region.interface';
import { RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';
import { geoAt, nearCity } from './world.geography';
import { WorldCounts, WorldTerrain } from './world.interface';
import { hash2 as _hash, valueNoise as _noise } from './world.noise';

/**
 * The shared world: an endless grid of tiles around the heart at (0|0). x grows to the east,
 * y to the south.
 *
 * The grid lies over real land (see world.geography): the heart is Kamianets, and rivers, hills and
 * woods follow Podillia as it was around 1300–1400. Terrain is a pure function of the coordinates,
 * WORLD_SEED and that geography, so every player sees the same land and none of it is stored.
 * Never change WORLD_SEED or villageSpot: villages already stand on their spots.
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

/** How strongly the real land pulls each resource, on top of its own noise field. */
const GEO_PULL: Record<ResourceId, (geo: ReturnType<typeof geoAt>) => number> = {
	wood: (geo) => geo.forest * 0.22,
	stone: (geo) => geo.rock * 0.24,
	iron: (geo) => geo.forest * 0.04,
	// Ponds are rare: the rivers carry the water.
	water: () => -0.1,
	grain: (geo) => geo.field * 0.12,
	clay: (geo) => geo.floodplain * 0.2,
};

/**
 * What covers a tile. Rivers are water. Elsewhere each resource has its own noise field, pulled
 * toward the land it belongs to (woods on slopes, stone on the Tovtry, clay by the rivers) and
 * tilted toward the resources its quarter is known for (the same leanings as farms). The strongest
 * field wins.
 */
export function terrainAt(x: number, y: number): WorldTerrain {
	if (Math.max(Math.abs(x), Math.abs(y)) <= WORLD_HEART) {
		return x === 0 && y === 0 ? 'heart' : 'grass';
	}

	const geo = geoAt(x, y);

	if (geo.riverDistance < geo.riverWidth + 0.25 && !nearCity(x, y)) {
		return 'water';
	}

	const [vertical, horizontal] = quadrantOf(x, y).split('-') as [
		'north' | 'south',
		'west' | 'east',
	];
	let best: WorldTerrain = 'grass';
	let bestValue = FEATURE_THRESHOLD;

	RESOURCES.forEach(({ id }, i) => {
		const bias = (REGION_BIAS[vertical][id] ?? 0) + (REGION_BIAS[horizontal][id] ?? 0);
		const value =
			_noise(x / NOISE_SCALE, y / NOISE_SCALE, WORLD_SEED + i * 1013) +
			bias * 0.12 +
			GEO_PULL[id](geo);

		if (value > bestValue) {
			best = id;
			bestValue = value;
		}
	});

	return best;
}

/** True where a lord may found a village: dry land, off the river banks and away from towns. */
export function isSettleable(x: number, y: number): boolean {
	return terrainAt(x, y) !== 'water' && geoAt(x, y).riverDistance > 0.75 && !nearCity(x, y);
}

/**
 * Where the quarter's `index`-th village is founded: its villageSpot, or, when that falls in a river
 * or next to a town, the nearest good tile inside the same cell. Cells never overlap, so two villages
 * still never share a tile, and the index stays the quarter's count as firestore.rules expect.
 */
export function settleSpot(region: RegionId, index: number): Point {
	const spot = villageSpot(region, index);

	if (isSettleable(spot.x, spot.y)) {
		return spot;
	}

	const { i, j } = _cell(index);
	const [sx, sy] = SIGN[region];
	const cell: Point[] = [];

	for (let dy = 0; dy < WORLD_SPACING; dy++) {
		for (let dx = 0; dx < WORLD_SPACING; dx++) {
			cell.push({
				x: sx * (WORLD_HEART + 1 + i * WORLD_SPACING + dx),
				y: sy * (WORLD_HEART + 1 + j * WORLD_SPACING + dy),
			});
		}
	}

	const near = (p: Point) => Math.abs(p.x - spot.x) + Math.abs(p.y - spot.y);

	return cell.filter((p) => isSettleable(p.x, p.y)).sort((a, b) => near(a) - near(b))[0] ?? spot;
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
