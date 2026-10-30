import { ElementId } from '../element/element.interface';
import {
	angleBetween,
	bentLine,
	Blob,
	blobPath,
	blobPoint,
	distanceToLine,
	inBlob,
	makeBlob,
	normaliseAngle,
	Point,
	pointDistance,
	poisson,
	range,
	Rng,
	round1,
	seededRng,
	TAU,
} from '../map/map-geometry';
import { REGION_BIAS } from '../region/region.bias';
import { RegionId } from '../region/region.interface';
import { RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';
import { FarmAdd, FarmDecor, FarmMap, FarmPlot, FarmZone } from './farm.interface';
import { FarmLand } from './farm.land';

/**
 * Procedural farmland: the land around a village, split into patches that each yield one
 * resource. Works like the village generator: plots are sampled once and saved, scenery is redrawn
 * from the seed. Never change what layout 1 draws; add a new FARM_LAYOUT instead.
 *
 * Balance: every farm has the same number of plots and at least FARM_MIN_PER_RESOURCE of each
 * resource, so nobody is locked out of anything. The rest is shared out by weighted chance, leaning
 * on the player's element and on the land round their village on the world map (see farmLand), so
 * a lord beside a forest is rich in wood and short of clay while a neighbour by the river is the
 * other way round. That gap is what trade is for.
 *
 * Patches face their land: the wood patch lies the way the forest lies on the world map. Plots are
 * placed in their patches every time the farm is drawn, keeping each saved plot's id, resource and
 * level, so the picture can follow the world map without losing anyone's work.
 *
 * Layouts: 1 drew its mix from element and region alone; 2 also reads the land. Both are drawn
 * with patches facing the land.
 */
export const FARM_LAYOUT = 2;
/** Wide, like the village, so the farm fills a landscape screen and, turned, a portrait one. */
export const FARM_WIDTH = 1800;
export const FARM_HEIGHT = 1000;
/** The ring the patches stand on round the village: about two and a half times as wide as it is tall. */
const RING = { rx: 630, ry: 262 };
const RING_STEPS = 720;
export const FARM_PLOT_COUNT = 24;

/** The size of the drawn land. It grows with the plots, so the whole farm always fits the screen. */
interface Dims {
	width: number;
	height: number;
	/** How much bigger than the usual farm: 1 up to FARM_PLOT_COUNT plots, then with their square root. */
	scale: number;
}

function _dims(plots: number): Dims {
	const scale = Math.max(1, Math.sqrt(plots / FARM_PLOT_COUNT));

	return { width: FARM_WIDTH * scale, height: FARM_HEIGHT * scale, scale };
}

/** Plots in each patch of each resource. A resource with more than three plots comes as two patches. */
type PatchCounts = Record<ResourceId, number[]>;

function _total(counts: PatchCounts): number {
	return Object.values(counts).reduce((sum, sizes) => sum + sizes.reduce((a, n) => a + n, 0), 0);
}

/** The plots a farm started with, split into patches: one patch up to three plots, else two. */
function _split(base: number): number[] {
	if (base <= 0) {
		return [];
	}

	return base <= 3 ? [base] : [Math.ceil(base / 2), Math.floor(base / 2)];
}

/** The patch of every plot: started plots fill the patches in id order, bought ones go where they were bought. */
function _patchOf(plots: FarmPlot[]): Map<number, number> {
	const of = new Map<number, number>();

	for (const { id } of RESOURCES) {
		const own = plots.filter((plot) => plot.resource === id).sort((a, b) => a.id - b.id);
		const base = own.filter((plot) => !plot.extra);
		const split = _split(base.length);

		base.forEach((plot, i) => of.set(plot.id, i < (split[0] ?? 0) ? 0 : 1));
		own
			.filter((plot) => plot.extra)
			.forEach((plot) =>
				of.set(plot.id, Math.min(plot.patch ?? 0, Math.max(0, split.length - 1))),
			);
	}

	return of;
}

function _patchCounts(plots: FarmPlot[]): PatchCounts {
	const of = _patchOf(plots);

	return Object.fromEntries(
		RESOURCES.map(({ id }) => {
			const own = plots.filter((plot) => plot.resource === id);
			const sizes: number[] = Array.from(
				{ length: _split(own.filter((plot) => !plot.extra).length).length },
				() => 0,
			);

			for (const plot of own) {
				sizes[of.get(plot.id)!]!++;
			}

			return [id, sizes];
		}),
	) as PatchCounts;
}

function _startCounts(counts: Record<ResourceId, number>): PatchCounts {
	return Object.fromEntries(RESOURCES.map(({ id }) => [id, _split(counts[id])])) as PatchCounts;
}
export const FARM_MIN_PER_RESOURCE = 2;
export const FARM_MAX_PER_RESOURCE = 7;

/** How much each choice tilts the odds of an extra plot. Every resource starts at weight 1. */
const ELEMENT_BIAS: Record<ElementId, Partial<Record<ResourceId, number>>> = {
	// The mountain gives stone and ore, and clay where rock wears down.
	stone: { stone: 0.6, iron: 0.4, clay: 0.2 },
	// Fire needs wood to burn and clay for hearths and kilns, and warms the fields.
	fire: { wood: 0.5, clay: 0.4, grain: 0.2 },
};

/** How much a resource's share of the land round the village adds to its weight. */
const LAND_WEIGHT = 5;

/**
 * Samples a new farm's plots from the land round its village (null when the village has no place
 * on the world map yet: then the region leans instead). Call once, then save the result.
 */
export function generateFarmPlots(
	seed: number,
	element: ElementId,
	region: RegionId,
	land: FarmLand | null,
): FarmPlot[] {
	return _arrange(
		seed,
		_startCounts(_counts(seededRng(seed ^ 0x51ed270b), element, region, land)),
		land,
		null,
	);
}

/** Draws the farm from the seed: patches facing the land, saved plots placed in them. */
export function generateFarm(seed: number, plots: FarmPlot[], land: FarmLand | null): FarmMap {
	const counts = _patchCounts(plots);
	const dims = _dims(_total(counts));
	const village = _village(seededRng(seed), dims);
	const zones = _zones(seed, counts, land, dims);
	const rng = seededRng(seed ^ 0x85ebca6b);
	const placed = _arrange(seed, counts, land, plots);
	const centre = { x: village.cx, y: village.cy };
	const zoneCentres = zones.map((zone) => ({ x: zone.blob.cx, y: zone.blob.cy }));

	return {
		width: dims.width,
		height: dims.height,
		village: { ...centre, path: blobPath(village, 1) },
		roads: zoneCentres.map((to) => bentLine(rng, centre, to)),
		zones: zones.map((zone) => _drawZone(rng, zone.resource, zone.blob, dims)),
		plots: placed,
		adds: _adds(seed, zones, placed),
		trees: _scatter(rng, 34, 0.1, village, zones, zoneCentres, dims),
		rocks: _scatter(rng, 60, 0.05, village, zones, zoneCentres, dims),
	};
}

/** One of the farm's patches as seen from the village: which way it lies, how big, how far. */
export interface FarmSurrounding {
	resource: ResourceId;
	/** Screen angle from the village to the patch, radians (y points down). */
	angle: number;
	/** Plots in the patch. */
	size: number;
	/** True for the patches in the farm's outer ring. */
	far: boolean;
}

/**
 * The farm's patches as seen from the village, so the village map can show the same land beyond
 * its walls: the forest that is the farm's wood, in the same direction and of a matching size.
 */
export function farmSurroundings(
	seed: number,
	plots: FarmPlot[],
	land: FarmLand | null,
): FarmSurrounding[] {
	const counts = _patchCounts(plots);
	const dims = _dims(_total(counts));
	const village = _village(seededRng(seed), dims);
	const zones = _zones(seed, counts, land, dims);
	const distances = zones.map((zone) => Math.hypot(zone.blob.cx - village.cx, zone.blob.cy - village.cy));
	const middle = distances.reduce((sum, d) => sum + d, 0) / Math.max(1, distances.length);

	return zones.map((zone, i) => ({
		resource: zone.resource,
		angle: Math.atan2(zone.blob.cy - village.cy, zone.blob.cx - village.cx),
		size: zone.count,
		far: distances[i]! > middle,
	}));
}

/** How many plots of each resource a farm gets. */
export function farmResourceCounts(plots: FarmPlot[]): Record<ResourceId, number> {
	const counts = Object.fromEntries(RESOURCES.map((r) => [r.id, 0])) as Record<ResourceId, number>;

	for (const plot of plots) {
		counts[plot.resource]++;
	}

	return counts;
}

// ---- Layout ----

interface Zone {
	resource: ResourceId;
	/** Which patch of its resource this is. */
	patch: number;
	count: number;
	blob: Blob;
}

function _village(rng: Rng, dims: Dims): Blob {
	return makeBlob(
		rng,
		dims.width / 2 + range(rng, -40, 40),
		dims.height / 2 + range(rng, -25, 25),
		110,
		76,
		0.12,
	);
}

/**
 * Distance travelled round the ring at each step of its angle. On a long oval, equal angles bunch
 * up at the two ends, so patches are spaced by distance round the ring instead.
 */
const RING_LENGTHS = (() => {
	const lengths = [0];

	for (let i = 1; i <= RING_STEPS; i++) {
		const [a, b] = [((i - 1) / RING_STEPS) * TAU, (i / RING_STEPS) * TAU];
		const step = Math.hypot(
			RING.rx * (Math.cos(b) - Math.cos(a)),
			RING.ry * (Math.sin(b) - Math.sin(a)),
		);

		lengths.push(lengths[i - 1]! + step);
	}

	return lengths;
})();

/** Where round the ring (0 to 2π of its length) the point lies that is in a screen direction. */
function _ringPosition(direction: number): number {
	const t = normaliseAngle(Math.atan2(RING.rx * Math.sin(direction), RING.ry * Math.cos(direction)));
	const at = (t / TAU) * RING_STEPS;
	const i = Math.min(RING_STEPS - 1, Math.floor(at));
	const length = RING_LENGTHS[i]! + (RING_LENGTHS[i + 1]! - RING_LENGTHS[i]!) * (at - i);

	return (length / RING_LENGTHS[RING_STEPS]!) * TAU;
}

/** The point on the ring at a position round it, as an offset from the village. */
function _ringPoint(position: number, scale: number): Point {
	const length = (normaliseAngle(position) / TAU) * RING_LENGTHS[RING_STEPS]!;
	let low = 0;
	let high = RING_STEPS;

	while (high - low > 1) {
		const middle = (low + high) >> 1;

		if (RING_LENGTHS[middle]! <= length) {
			low = middle;
		} else {
			high = middle;
		}
	}

	const part = (length - RING_LENGTHS[low]!) / (RING_LENGTHS[high]! - RING_LENGTHS[low]! || 1);
	const t = ((low + part) / RING_STEPS) * TAU;

	return { x: Math.cos(t) * RING.rx * scale, y: Math.sin(t) * RING.ry * scale };
}

/**
 * Resource counts, split into patches and laid out in a ring round the village. Each patch faces
 * its resource on the world map where the land shows one way, and lies at random otherwise; the
 * ring is turned so the patches come as close to their directions as the sectors allow.
 */
function _zones(
	seed: number,
	counts: PatchCounts,
	land: FarmLand | null,
	dims: Dims,
): Zone[] {
	const rng = seededRng(seed);
	const village = _village(rng, dims);

	// Big holdings come as two patches, so no single resource takes a whole side of the map.
	const patches: { resource: ResourceId; patch: number; count: number; target: number }[] = [];

	for (const { id } of RESOURCES) {
		const sizes = counts[id];
		// Always drawn, so the random stream does not depend on which directions the land gives.
		const random = rng() * TAU;
		// Where round the ring the patch would face its land, or a random place.
		const target = _ringPosition(land?.directions[id] ?? random);

		sizes.forEach((count, patch) => patches.push({ resource: id, patch, count, target }));
	}

	// Round the ring in the order of the directions, each patch a stretch as long as its plots.
	patches.sort((a, b) => a.target - b.target);

	const total = patches.reduce((sum, patch) => sum + patch.count, 0);
	let before = 0;
	const centres = patches.map((patch) => {
		const centre = ((before + patch.count / 2) / total) * TAU;

		before += patch.count;

		return centre;
	});
	// Turn the whole ring by the average miss, so the patches face their land as well as they can.
	const miss = patches.reduce(
		(sum, patch, i) => {
			const off = angleBetween(patch.target, centres[i]!);

			return { x: sum.x + Math.cos(off) * patch.count, y: sum.y + Math.sin(off) * patch.count };
		},
		{ x: 0, y: 0 },
	);
	const turn = Math.atan2(miss.y, miss.x);

	return patches.map((patch, i) => {
		const onRing = _ringPoint(centres[i]! + turn, dims.scale);
		// Alternate near and far from the village so neighbouring patches do not collide.
		const distance = (i % 2 ? 1.12 : 0.82) + range(rng, -0.05, 0.05);
		// Big enough to hold its plots at PLOT_SPACING.
		const rx = 62 + 24 * patch.count;
		const ry = rx * 0.72;
		const at = {
			x: village.cx + onRing.x * distance,
			y: village.cy + onRing.y * distance,
		};

		return {
			resource: patch.resource,
			patch: patch.patch,
			count: patch.count,
			blob: makeBlob(
				rng,
				_clamp(at.x, rx + 12, dims.width - rx - 12),
				_clamp(at.y, ry + 12, dims.height - ry - 12),
				rx,
				ry,
				0.18,
			),
		};
	});
}

/**
 * Plots placed in the patches. New farms get fresh ids in patch order. Saved plots keep their id,
 * resource and level: the k-th spot sampled in a patch goes to its k-th plot by id.
 */
function _arrange(
	seed: number,
	counts: PatchCounts,
	land: FarmLand | null,
	saved: FarmPlot[] | null,
): FarmPlot[] {
	const rng = seededRng(seed ^ 0x9e3779b9);
	const dims = _dims(_total(counts));
	const of = _patchOf(saved ?? []);
	const queues = new Map<string, FarmPlot[]>();

	for (const plot of [...(saved ?? [])].sort((a, b) => a.id - b.id)) {
		const key = `${plot.resource}:${of.get(plot.id)}`;

		queues.set(key, [...(queues.get(key) ?? []), plot]);
	}

	const placed: FarmPlot[] = [];

	for (const zone of _zones(seed, counts, land, dims)) {
		for (const point of _samplePlots(rng, zone.blob, zone.count, placed, dims)) {
			const id = saved
				? queues.get(`${zone.resource}:${zone.patch}`)!.shift()!.id
				: placed.length + 1;

			placed.push({ id, resource: zone.resource, ...point });
		}
	}

	return placed;
}

/**
 * Every resource gets the minimum; the remaining plots are shared out in proportion to weights
 * (largest remainder, no resource above the maximum). The weights lean on the element and on the
 * land round the village, with a little luck so two villages on similar land still differ. Without
 * land (no place on the world map yet), the region leans instead and luck counts for more.
 */
function _counts(
	rng: Rng,
	element: ElementId,
	region: RegionId,
	land: FarmLand | null,
): Record<ResourceId, number> {
	const [vertical, horizontal] = region.split('-') as ['north' | 'south', 'west' | 'east'];
	const hasLand = !!land && Object.values(land.shares).some((share) => share > 0);
	const weights = RESOURCES.map(({ id }) => {
		const leaning = ELEMENT_BIAS[element][id] ?? 0;

		if (hasLand) {
			return (1 + leaning + land!.shares[id] * LAND_WEIGHT) * range(rng, 0.85, 1.15);
		}

		const regional = (REGION_BIAS[vertical][id] ?? 0) + (REGION_BIAS[horizontal][id] ?? 0);

		return (1 + leaning + regional) * range(rng, 0.6, 1.6);
	});
	const counts = Object.fromEntries(
		RESOURCES.map(({ id }) => [id, FARM_MIN_PER_RESOURCE]),
	) as Record<ResourceId, number>;
	let remaining = FARM_PLOT_COUNT - FARM_MIN_PER_RESOURCE * RESOURCES.length;

	// Share out what is left among resources still below the maximum, until nothing is left.
	while (remaining > 0) {
		const open = RESOURCES.map((r, i) => (counts[r.id] < FARM_MAX_PER_RESOURCE ? weights[i]! : 0));
		const sum = open.reduce((total, w) => total + w, 0);
		const quotas = open.map((w) => (w / sum) * remaining);
		const room = RESOURCES.map((r) => FARM_MAX_PER_RESOURCE - counts[r.id]);
		const whole = quotas.map((q, i) => Math.min(room[i]!, Math.floor(q)));
		let given = whole.reduce((total, n) => total + n, 0);

		// The plots the whole shares leave over go to the largest remainders.
		const byRemainder = quotas
			.map((q, i) => ({ i, rest: q - Math.floor(q) }))
			.filter(({ i }) => whole[i]! < room[i]!)
			.sort((a, b) => b.rest - a.rest);

		for (const { i } of byRemainder) {
			if (given >= remaining) {
				break;
			}

			whole[i]!++;
			given++;
		}

		RESOURCES.forEach((r, i) => (counts[r.id] += whole[i]!));
		remaining -= given;
	}

	return counts;
}

/**
 * For every patch, a free spot in it, clear of every plot and of the other spots, where pressing
 * grows that patch. Taken from the seed, so it stays put until the patch changes.
 */
function _adds(seed: number, zones: Zone[], plots: Point[]): FarmAdd[] {
	const rng = seededRng(seed ^ 0x2f6e1d3b);
	const adds: FarmAdd[] = [];

	for (const zone of zones) {
		const taken: Point[] = [...plots, ...adds];
		let best: Point | null = null;
		let bestGap = -1;

		for (let attempt = 0; attempt < 400; attempt++) {
			const candidate = blobPoint(zone.blob, rng() * TAU, range(rng, 0.2, 0.9));
			const gap = Math.min(...taken.map((other) => pointDistance(other, candidate)));

			if (gap > bestGap) {
				best = candidate;
				bestGap = gap;
			}
		}

		if (best) {
			adds.push({ resource: zone.resource, patch: zone.patch, x: round1(best.x), y: round1(best.y) });
		}
	}

	return adds;
}

/** Plots never sit closer than this, even across neighbouring patches. */
const PLOT_SPACING = 78;
/** Inside a crowded patch spacing may shrink to this, which still keeps the plot discs apart. */
const PLOT_SPACING_MIN = 70;

function _samplePlots(rng: Rng, blob: Blob, count: number, placed: Point[], dims: Dims): Point[] {
	let minDistance = PLOT_SPACING;
	let points: Point[] = [];
	const clear = (x: number, y: number) =>
		placed.every((other) => pointDistance(other, { x, y }) >= PLOT_SPACING);

	for (let attempt = 0; attempt < 12 && points.length < count; attempt++) {
		points = poisson(
			rng,
			dims.width,
			dims.height,
			minDistance,
			(x, y) => inBlob(blob, x, y, 0.7) && clear(x, y),
		);
		minDistance = Math.max(PLOT_SPACING_MIN, minDistance * 0.9);
	}

	const centre = { x: blob.cx, y: blob.cy };
	const chosen = points
		.sort((a, b) => pointDistance(a, centre) - pointDistance(b, centre))
		.slice(0, count);

	// A crowded patch still gets every plot: look for any clear spot in it, then fall back to a ring.
	for (let i = chosen.length; i < count; i++) {
		let spot: Point | null = null;

		for (let attempt = 0; attempt < 300 && !spot; attempt++) {
			const candidate = blobPoint(blob, rng() * TAU, range(rng, 0, 0.95));
			const apart = chosen.every((p) => pointDistance(p, candidate) >= PLOT_SPACING_MIN);

			if (apart && clear(candidate.x, candidate.y)) {
				spot = candidate;
			}
		}

		chosen.push(spot ?? blobPoint(blob, (i / count) * TAU, 0.35));
	}

	return chosen.map((p) => ({ x: round1(p.x), y: round1(p.y) }));
}

// ---- Drawing ----

function _drawZone(rng: Rng, resource: ResourceId, blob: Blob, dims: Dims): FarmZone {
	const path = blobPath(blob, 1);
	const decor = (minDistance: number, scale: number, min: number, max: number): FarmDecor[] =>
		poisson(rng, dims.width, dims.height, minDistance, (x, y) => inBlob(blob, x, y, scale))
			.map((p) => ({ x: round1(p.x), y: round1(p.y), r: round1(range(rng, min, max)) }))
			.sort((a, b) => a.y - b.y);

	switch (resource) {
		case 'wood':
			return { resource, path, inner: [], decor: decor(20, 0.95, 10, 15) };
		case 'stone':
			return { resource, path, inner: [], decor: decor(38, 0.8, 20, 32) };
		case 'iron':
			return { resource, path, inner: [], decor: decor(28, 0.85, 9, 15) };
		case 'water':
			return { resource, path, inner: [blobPath(blob, 0.72)], decor: [] };
		case 'clay':
			return { resource, path, inner: [blobPath(blob, 0.68), blobPath(blob, 0.38)], decor: [] };
		case 'grain':
			return { resource, path, inner: [], decor: [] };
	}
}

/** Lone trees or rocks on open land: off the patches, around the village, clear of roads. */
function _scatter(
	rng: Rng,
	minDistance: number,
	chance: number,
	village: Blob,
	zones: Zone[],
	zoneCentres: Point[],
	dims: Dims,
): FarmDecor[] {
	const centre = { x: village.cx, y: village.cy };

	return poisson(rng, dims.width, dims.height, minDistance, (x, y) => {
		const point = { x, y };

		return (
			!inBlob(village, x, y, 1.4) &&
			zones.every((zone) => !inBlob(zone.blob, x, y, 1.12)) &&
			zoneCentres.every((to) => distanceToLine(point, [centre, to]) > 16) &&
			rng() < chance
		);
	})
		.map((p) => ({ x: round1(p.x), y: round1(p.y), r: round1(range(rng, 8, 14)) }))
		.sort((a, b) => a.y - b.y);
}

function _clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
