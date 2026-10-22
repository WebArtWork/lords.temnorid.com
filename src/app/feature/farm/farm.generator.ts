import { ElementId } from '../element/element.interface';
import {
	bentLine,
	Blob,
	blobPath,
	blobPoint,
	distanceToLine,
	inBlob,
	makeBlob,
	Point,
	pointDistance,
	poisson,
	range,
	Rng,
	round1,
	seededRng,
	TAU,
} from '../map/map-geometry';
import { RegionId } from '../region/region.interface';
import { RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';
import { FarmDecor, FarmMap, FarmPlot, FarmZone } from './farm.interface';

/**
 * Procedural farmland: the land around a village, split into patches that each yield one
 * resource. Works like the village generator: plots are sampled once and saved, scenery is redrawn
 * from the seed. Never change what layout 1 draws; add a new FARM_LAYOUT instead.
 *
 * Balance: every farm has the same number of plots and at least FARM_MIN_PER_RESOURCE of each
 * resource, so nobody is locked out of anything. The rest is shared out at random, leaning on the
 * player's element and region, so one lord is rich in wood and short of clay while a neighbour is
 * the other way round. That gap is what trade is for.
 */
export const FARM_LAYOUT = 1;
export const FARM_WIDTH = 1000;
export const FARM_HEIGHT = 750;
export const FARM_PLOT_COUNT = 24;
export const FARM_MIN_PER_RESOURCE = 2;
export const FARM_MAX_PER_RESOURCE = 7;

/** How much each choice tilts the odds of an extra plot. Every resource starts at weight 1. */
const ELEMENT_BIAS: Record<ElementId, Partial<Record<ResourceId, number>>> = {
	// The mountain gives stone and ore, and clay where rock wears down.
	stone: { stone: 0.6, iron: 0.4, clay: 0.2 },
	// Fire needs wood to burn and clay for hearths and kilns, and warms the fields.
	fire: { wood: 0.5, clay: 0.4, grain: 0.2 },
};

export const REGION_BIAS: Record<'north' | 'south' | 'west' | 'east', Partial<Record<ResourceId, number>>> = {
	north: { wood: 0.4, iron: 0.3 },
	south: { grain: 0.4, water: 0.3 },
	west: { water: 0.3 },
	east: { stone: 0.2, clay: 0.2 },
};

/** Samples a new farm's plots. Call once, then save the result. */
export function generateFarmPlots(seed: number, element: ElementId, region: RegionId): FarmPlot[] {
	const zones = _zones(seed, element, region);
	const rng = seededRng(seed ^ 0x9e3779b9);
	const plots: FarmPlot[] = [];

	for (const zone of zones) {
		for (const point of _samplePlots(rng, zone.blob, zone.count, plots)) {
			plots.push({ id: plots.length + 1, resource: zone.resource, ...point });
		}
	}

	return plots;
}

/** Draws the farm from the seed around saved plots. */
export function generateFarm(
	seed: number,
	element: ElementId,
	region: RegionId,
	plots: FarmPlot[],
): FarmMap {
	const village = _village(seededRng(seed));
	const zones = _zones(seed, element, region);
	const rng = seededRng(seed ^ 0x85ebca6b);
	const centre = { x: village.cx, y: village.cy };
	const zoneCentres = zones.map((zone) => ({ x: zone.blob.cx, y: zone.blob.cy }));

	return {
		width: FARM_WIDTH,
		height: FARM_HEIGHT,
		village: { ...centre, path: blobPath(village, 1) },
		roads: zoneCentres.map((to) => bentLine(rng, centre, to)),
		zones: zones.map((zone) => _drawZone(rng, zone.resource, zone.blob)),
		plots,
		trees: _scatter(rng, 34, 0.1, village, zones, zoneCentres),
		rocks: _scatter(rng, 60, 0.12, village, zones, zoneCentres),
	};
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
	count: number;
	blob: Blob;
}

function _village(rng: Rng): Blob {
	return makeBlob(
		rng,
		FARM_WIDTH / 2 + range(rng, -25, 25),
		FARM_HEIGHT / 2 + range(rng, -20, 20),
		82,
		60,
		0.12,
	);
}

/** Resource counts, split into patches and laid out in a ring around the village. */
function _zones(seed: number, element: ElementId, region: RegionId): Zone[] {
	const rng = seededRng(seed);
	const village = _village(rng);
	const counts = _counts(rng, element, region);

	// Big holdings come as two patches, so no single resource takes a whole side of the map.
	const patches: { resource: ResourceId; count: number }[] = [];

	for (const { id } of RESOURCES) {
		const count = counts[id];

		if (count <= 3) {
			patches.push({ resource: id, count });
		} else {
			const first = Math.ceil(count / 2);

			patches.push({ resource: id, count: first }, { resource: id, count: count - first });
		}
	}

	_shuffle(rng, patches);

	const total = patches.reduce((sum, patch) => sum + patch.count, 0);
	const start = rng() * TAU;
	let before = 0;

	return patches.map((patch, i) => {
		const angle = start + ((before + patch.count / 2) / total) * TAU;
		// Alternate near and far from the village so neighbouring patches do not collide.
		const distance = (i % 2 ? 1.12 : 0.82) + range(rng, -0.05, 0.05);
		const rx = 48 + 15 * patch.count;
		const ry = rx * 0.72;
		const at = {
			x: village.cx + Math.cos(angle) * 310 * distance,
			y: village.cy + Math.sin(angle) * 230 * distance,
		};

		before += patch.count;

		return {
			...patch,
			blob: makeBlob(
				rng,
				_clamp(at.x, rx + 12, FARM_WIDTH - rx - 12),
				_clamp(at.y, ry + 12, FARM_HEIGHT - ry - 12),
				rx,
				ry,
				0.18,
			),
		};
	});
}

/** Every resource gets the minimum; the remaining plots go one at a time by weighted chance. */
function _counts(rng: Rng, element: ElementId, region: RegionId): Record<ResourceId, number> {
	const [vertical, horizontal] = region.split('-') as ['north' | 'south', 'west' | 'east'];
	const biases = [ELEMENT_BIAS[element], REGION_BIAS[vertical], REGION_BIAS[horizontal]];
	const weights = RESOURCES.map(
		({ id }) => biases.reduce((w, bias) => w + (bias[id] ?? 0), 1) * range(rng, 0.6, 1.6),
	);
	const counts = Object.fromEntries(
		RESOURCES.map(({ id }) => [id, FARM_MIN_PER_RESOURCE]),
	) as Record<ResourceId, number>;
	let remaining = FARM_PLOT_COUNT - FARM_MIN_PER_RESOURCE * RESOURCES.length;

	while (remaining > 0) {
		const open = RESOURCES.map((r, i) => (counts[r.id] < FARM_MAX_PER_RESOURCE ? weights[i]! : 0));
		let pick = rng() * open.reduce((sum, w) => sum + w, 0);
		let index = -1;

		// Walk the weights until the pick runs out; rounding may leave it on the last open one.
		for (let i = 0; i < open.length; i++) {
			if (open[i]! > 0) {
				index = i;
				pick -= open[i]!;

				if (pick < 0) {
					break;
				}
			}
		}

		counts[RESOURCES[index]!.id]++;
		remaining--;
	}

	return counts;
}

/** Plots never sit closer than this, even across neighbouring patches. */
const PLOT_SPACING = 52;
/** Inside a crowded patch spacing may shrink to this, which still keeps the plot discs apart. */
const PLOT_SPACING_MIN = 44;

function _samplePlots(rng: Rng, blob: Blob, count: number, placed: Point[]): Point[] {
	let minDistance = PLOT_SPACING;
	let points: Point[] = [];
	const clear = (x: number, y: number) =>
		placed.every((other) => pointDistance(other, { x, y }) >= PLOT_SPACING);

	for (let attempt = 0; attempt < 12 && points.length < count; attempt++) {
		points = poisson(
			rng,
			FARM_WIDTH,
			FARM_HEIGHT,
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

function _drawZone(rng: Rng, resource: ResourceId, blob: Blob): FarmZone {
	const path = blobPath(blob, 1);
	const decor = (minDistance: number, scale: number, min: number, max: number): FarmDecor[] =>
		poisson(rng, FARM_WIDTH, FARM_HEIGHT, minDistance, (x, y) => inBlob(blob, x, y, scale))
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
): FarmDecor[] {
	const centre = { x: village.cx, y: village.cy };

	return poisson(rng, FARM_WIDTH, FARM_HEIGHT, minDistance, (x, y) => {
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

function _shuffle<T>(rng: Rng, items: T[]) {
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));

		[items[i], items[j]] = [items[j]!, items[i]!];
	}
}

function _clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
