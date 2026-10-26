import { ElementId } from '../element/element.interface';
import { FarmSurrounding } from '../farm/farm.generator';
import { RegionId } from '../region/region.interface';
import {
	VillageBridge,
	VillageMap,
	VillagePalette,
	VillageRock,
	VillageSlot,
	VillageTree,
} from './village.interface';
import {
	angleBetween,
	bentLine,
	Blob,
	blobPath,
	blobPoint,
	closedCurve,
	distanceToLine,
	inBlob,
	makeBlob,
	normaliseAngle,
	openCurve,
	Point,
	pointDistance,
	poisson,
	range,
	Rng,
	round1,
	seededRng,
	TAU,
} from '../map/map-geometry';

/**
 * Procedural village maps. One 32-bit seed draws a whole village, so every player gets their own
 * shape, stream, roads, fields and forests, and the same seed always draws the same picture.
 *
 * Building slots are sampled once, when the village is founded, and then saved; later draws pass
 * them back in. The scenery is redrawn from the seed every time and fitted around those slots.
 *
 * Layouts:
 * 1. An oval on a 1000×750 map.
 * 2. A long, squared-off village on a wide 1800×1000 map, so it fills a landscape screen and,
 *    turned on its side, a portrait one. It is layout 1's shape stretched (VILLAGE_STRETCH) and
 *    squared, so layout 1 villages are redrawn as layout 2 with their saved places stretched the
 *    same way (see villageSlots): every building keeps its place and stays inside the village.
 *
 * Never change what the current layout samples: saved places depend on it. A new look is a new
 * VILLAGE_LAYOUT that saved villages are carried over to.
 */
export const VILLAGE_LAYOUT = 2;
export const VILLAGE_WIDTH = 1800;
export const VILLAGE_HEIGHT = 1000;
/** Layout 1's map, and how far layout 2 stretches its village along each axis. */
const LAYOUT_1 = { width: 1000, height: 750 };
const VILLAGE_STRETCH = { x: 1.8, y: 1.2 };
/** How square layout 2's village is: 2 would be an oval. */
const VILLAGE_SQUARENESS = 3;
/** Every village gets the same number of places to build, so no player starts ahead. */
export const VILLAGE_SLOT_COUNT = 18;

const PALETTES: Record<ElementId, VillagePalette> = {
	// A warm mountain shelf: dry grass on rock, slate-grey stones.
	stone: {
		outer: '#8f9a6c',
		ground: '#b3b585',
		groundEdge: '#8a8762',
		plaza: '#d6c8a2',
		road: '#c9b88f',
		field: '#d5b36a',
		fieldLine: '#b8944c',
		tree: '#55703f',
		treeDark: '#3f5632',
		rock: '#9a958d',
		rockShade: '#6e6962',
		water: '#6b9fb3',
		waterLight: '#a6cbd6',
	},
	// A green clearing held around a fire: lusher grass, warmer earth.
	fire: {
		outer: '#7c9653',
		ground: '#a3bb66',
		groundEdge: '#7f8f4c',
		plaza: '#d8c08c',
		road: '#ccb27f',
		field: '#dcb35e',
		fieldLine: '#bf9244',
		tree: '#4f6d36',
		treeDark: '#3a522a',
		rock: '#958d84',
		rockShade: '#6a625a',
		water: '#5f97ad',
		waterLight: '#9fc6d3',
	},
};

/**
 * A saved village's places in the current layout. Layout 1 places are stretched with the village,
 * so they keep their spot relative to the outline.
 */
export function villageSlots(save: { seed: number; layout: number; slots: VillageSlot[] }): VillageSlot[] {
	if (save.layout !== 1) {
		return save.slots;
	}

	const before = _layout1Shape(save.seed).village;
	const after = _shape(save.seed).village;

	return save.slots.map((slot) => ({
		id: slot.id,
		x: round1(after.cx + (slot.x - before.cx) * VILLAGE_STRETCH.x),
		y: round1(after.cy + (slot.y - before.cy) * VILLAGE_STRETCH.y),
	}));
}

/** Samples the building slots of a new village. Call once, then save the result. */
export function generateVillageSlots(seed: number): VillageSlot[] {
	const { village, plaza } = _shape(seed);

	return _sampleSlots(seededRng(seed ^ 0x9e3779b9), village, plaza);
}

/**
 * Draws the whole map from the seed, around saved slots. The land beyond the walls is the lord's
 * farm (see farmSurroundings): each of its patches shows in the same direction as on the farm map,
 * sized by its plots, and the roads out of the village lead toward the biggest of them.
 */
export function generateVillage(
	seed: number,
	element: ElementId,
	region: RegionId,
	slots: VillageSlot[],
	surroundings: FarmSurrounding[],
): VillageMap {
	const { village, plaza } = _shape(seed);
	// Scenery has its own random stream, so it never depends on how the slots were sampled.
	const rng = seededRng(seed ^ 0x85ebca6b);
	const centre = { x: plaza.cx, y: plaza.cy };

	const roads = _slotRoads(rng, centre, slots);
	const exits = _exits(rng, village, centre, _roadDirections(surroundings));
	const streamArc = _streamArc(rng, element);
	const stream = streamArc ? _streamPath(rng, village, streamArc) : null;
	const bridges = streamArc ? _bridges(village, exits, streamArc) : [];
	const ridge = _ridge(rng, element, village, exits, streamArc);
	const exitLines = exits.map((exit) => exit.points);
	const land = _farmland(rng, region, village, surroundings, exitLines);

	return {
		width: VILLAGE_WIDTH,
		height: VILLAGE_HEIGHT,
		palette: PALETTES[element],
		boundary: blobPath(village, 1),
		plaza: blobPath(plaza, 1),
		centre,
		roads: [
			...exits.map((exit) => ({ d: openCurve(exit.points), width: 18 })),
			...roads,
		],
		slots,
		stream,
		bridges,
		ridge,
		fields: land.fields,
		ponds: land.ponds,
		pits: land.pits,
		trees: land.trees,
		rocks: land.rocks,
		ores: land.ores,
	};
}

// ---- Shape ----

/**
 * Village outline and central square. Both come first from the seed, so slots and scenery agree.
 * Layout 1's oval, moved to the middle of the wider map, stretched and squared off. The square
 * grows a little with it, by the smaller stretch, so it stays a square and not a field.
 */
function _shape(seed: number) {
	const before = _layout1Shape(seed);
	const sx = VILLAGE_WIDTH / LAYOUT_1.width;
	const sy = VILLAGE_HEIGHT / LAYOUT_1.height;
	const village: Blob = {
		...before.village,
		cx: before.village.cx * sx,
		cy: before.village.cy * sy,
		rx: before.village.rx * VILLAGE_STRETCH.x,
		ry: before.village.ry * VILLAGE_STRETCH.y,
		squareness: VILLAGE_SQUARENESS,
	};
	const grow = Math.min(VILLAGE_STRETCH.x, VILLAGE_STRETCH.y);
	const plaza: Blob = {
		...before.plaza,
		cx: village.cx + (before.plaza.cx - before.village.cx) * VILLAGE_STRETCH.x,
		cy: village.cy + (before.plaza.cy - before.village.cy) * VILLAGE_STRETCH.y,
		rx: before.plaza.rx * grow,
		ry: before.plaza.ry * grow,
	};

	return { village, plaza };
}

/** Layout 1's outline and square, which layout 2 is drawn from. Never change it. */
function _layout1Shape(seed: number) {
	const rng = seededRng(seed);
	const village = makeBlob(
		rng,
		LAYOUT_1.width / 2 + range(rng, -30, 30),
		LAYOUT_1.height / 2 + range(rng, -20, 20),
		range(rng, 320, 350),
		range(rng, 245, 265),
		0.16,
	);
	const plaza = makeBlob(
		rng,
		village.cx + range(rng, -45, 45),
		village.cy + range(rng, -35, 35),
		range(rng, 65, 85),
		range(rng, 45, 60),
		0.22,
	);

	return { village, plaza };
}

// ---- Slots ----

function _sampleSlots(rng: Rng, village: Blob, plaza: Blob): VillageSlot[] {
	// Wide enough apart to spread the places over the long village, not bunch them in the middle.
	let minDistance = 170;
	let points: Point[] = [];

	// Shrink the spacing until the outline fits every slot. Small villages pack a little tighter.
	for (let attempt = 0; attempt < 10; attempt++) {
		points = poisson(
			rng,
			VILLAGE_WIDTH,
			VILLAGE_HEIGHT,
			minDistance,
			(x, y) => inBlob(village, x, y, 0.84) && !inBlob(plaza, x, y, 1.45),
		);

		if (points.length >= VILLAGE_SLOT_COUNT) {
			break;
		}

		minDistance *= 0.93;
	}

	// Keep the places closest to the square: a compact village with open land at its edges.
	const centre = { x: plaza.cx, y: plaza.cy };
	const chosen = points
		.sort((a, b) => pointDistance(a, centre) - pointDistance(b, centre))
		.slice(0, VILLAGE_SLOT_COUNT);

	// Number them clockwise from north, so ids read in a sensible order around the square.
	const clockwise = (p: Point) => (Math.atan2(p.y - centre.y, p.x - centre.x) + Math.PI / 2 + TAU) % TAU;

	return chosen
		.sort((a, b) => clockwise(a) - clockwise(b))
		.map((p, i) => ({ id: i + 1, x: round1(p.x), y: round1(p.y) }));
}

// ---- Roads ----

/** Paths from the square to every slot: a minimum spanning tree, so neighbours share a road. */
function _slotRoads(rng: Rng, centre: Point, slots: VillageSlot[]) {
	const nodes: Point[] = [centre, ...slots];
	const inTree = new Set([0]);
	const roads: { d: string; width: number }[] = [];

	while (inTree.size < nodes.length) {
		let best: [number, number] | null = null;
		let bestDistance = Infinity;

		for (const from of inTree) {
			for (let to = 0; to < nodes.length; to++) {
				if (inTree.has(to)) {
					continue;
				}

				const distance = pointDistance(nodes[from]!, nodes[to]!);

				if (distance < bestDistance) {
					bestDistance = distance;
					best = [from, to];
				}
			}
		}

		const [from, to] = best!;

		inTree.add(to);
		roads.push({ d: bentLine(rng, nodes[from]!, nodes[to]!), width: from === 0 ? 14 : 9 });
	}

	return roads;
}

interface Exit {
	angle: number;
	points: Point[];
}

/**
 * Up to three directions for the roads out: toward the biggest farm patches, kept well apart so
 * they leave on different sides. Screen angles.
 */
function _roadDirections(surroundings: FarmSurrounding[]): number[] {
	const directions: number[] = [];

	for (const patch of [...surroundings].sort((a, b) => b.size - a.size)) {
		if (directions.length < 3 && directions.every((d) => Math.abs(angleBetween(d, patch.angle)) > 1.2)) {
			directions.push(patch.angle);
		}
	}

	return directions;
}

/** The blob's own angle for a screen direction, so a point at it lies that way from the centre. */
function _blobAngle(blob: Blob, angle: number): number {
	return Math.atan2(Math.sin(angle) / blob.ry, Math.cos(angle) / blob.rx);
}

/** Roads leaving the village, one per direction (screen angles). */
function _exits(rng: Rng, village: Blob, centre: Point, directions: number[]): Exit[] {
	return directions.map((direction) => {
		const angle = _blobAngle(village, direction) + range(rng, -0.08, 0.08);
		const edge = blobPoint(village, angle, 1);
		const bend = blobPoint(village, angle + range(rng, -0.12, 0.12), 0.55);

		return {
			angle: normaliseAngle(angle),
			points: [centre, bend, edge, blobPoint(village, angle + range(rng, -0.15, 0.15), 1.7)],
		};
	});
}

// ---- Edge: stream and ridge ----

interface Arc {
	start: number;
	span: number;
}

/** Fire villages sit by water; stone villages sometimes do. */
function _streamArc(rng: Rng, element: ElementId): Arc | null {
	const hasStream = element === 'fire' || rng() < 0.35;
	const arc = { start: rng() * TAU, span: Math.PI * range(rng, 1.1, 1.8) };

	return hasStream ? arc : null;
}

function _inArc(arc: Arc, angle: number): boolean {
	return normaliseAngle(angle - arc.start) <= arc.span;
}

function _streamPath(rng: Rng, village: Blob, arc: Arc): string {
	const steps = Math.ceil((arc.span / TAU) * 48) + 1;
	const points = Array.from({ length: steps }, (_, i) =>
		blobPoint(village, arc.start + (i / (steps - 1)) * arc.span, 1.1 + range(rng, -0.025, 0.025)),
	);

	return openCurve(points);
}

function _bridges(village: Blob, exits: Exit[], arc: Arc): VillageBridge[] {
	return exits
		.filter((exit) => _inArc(arc, exit.angle))
		.map((exit) => {
			const at = blobPoint(village, exit.angle, 1.1);
			const angle = (Math.atan2(at.y - village.cy, at.x - village.cx) * 180) / Math.PI;

			return { x: round1(at.x), y: round1(at.y), angle: round1(angle) };
		});
}

/** Stones along the edge, with gaps where roads leave and where the stream already guards it. */
function _ridge(
	rng: Rng,
	element: ElementId,
	village: Blob,
	exits: Exit[],
	arc: Arc | null,
): VillageRock[] {
	const rocks: VillageRock[] = [];
	const density = element === 'stone' ? 1 : 0.35;

	for (let angle = 0; angle < TAU; angle += range(rng, 0.03, 0.065)) {
		const nearExit = exits.some((exit) => Math.abs(angleBetween(exit.angle, angle)) < 0.14);
		const keep = rng() < density;

		if (nearExit || (arc && _inArc(arc, angle)) || !keep) {
			continue;
		}

		const at = blobPoint(village, angle, range(rng, 1.02, 1.06));

		rocks.push({ x: round1(at.x), y: round1(at.y), r: round1(range(rng, 7, 17)) });
	}

	return rocks;
}

// ---- The farm beyond the walls ----

interface Farmland {
	fields: string[];
	ponds: string[];
	pits: { outer: string; inner: string }[];
	trees: VillageTree[];
	rocks: VillageRock[];
	ores: VillageRock[];
}

/**
 * Each farm patch drawn beyond the walls, the way it looks on the farm: a forest for wood, a field
 * for grain, boulders for stone, ore for iron, a pond for water, a pit for clay. Near patches sit
 * close to the walls, far ones further out; more plots, a bigger patch. Besides them, only a few
 * lone trees and stones.
 */
function _farmland(
	rng: Rng,
	region: RegionId,
	village: Blob,
	surroundings: FarmSurrounding[],
	exitLines: Point[][],
): Farmland {
	const land: Farmland = { fields: [], ponds: [], pits: [], trees: [], rocks: [], ores: [] };
	const coniferShare = region.startsWith('north') ? 0.7 : 0.2;
	const forests: { x: number; y: number; r: number }[] = [];
	const open = (x: number, y: number) =>
		!inBlob(village, x, y, 1.16) && exitLines.every((line) => distanceToLine({ x, y }, line) > 22);
	const scatter = (at: Point, radius: number, count: number, min: number, max: number) =>
		Array.from({ length: count * 4 }, () => {
			const angle = rng() * TAU;
			const distance = Math.sqrt(rng()) * radius;

			return { x: at.x + Math.cos(angle) * distance, y: at.y + Math.sin(angle) * distance };
		})
			.filter((p) => open(p.x, p.y))
			.slice(0, count)
			.map((p) => ({ x: round1(p.x), y: round1(p.y), r: round1(range(rng, min, max)) }));

	for (const patch of surroundings) {
		const out = blobPoint(village, _blobAngle(village, patch.angle), patch.far ? 1.42 : 1.26);
		const at = {
			x: Math.max(40, Math.min(VILLAGE_WIDTH - 40, out.x)),
			y: Math.max(40, Math.min(VILLAGE_HEIGHT - 40, out.y)),
		};
		const radius = 55 + 22 * patch.size;

		switch (patch.resource) {
			case 'wood':
				forests.push({ ...at, r: radius });
				break;
			case 'grain':
				land.fields.push(blobPath(makeBlob(rng, at.x, at.y, radius * 0.9, radius * 0.6, 0.12), 1));
				break;
			case 'water':
				land.ponds.push(blobPath(makeBlob(rng, at.x, at.y, radius * 0.75, radius * 0.5, 0.18), 1));
				break;
			case 'clay': {
				const pit = makeBlob(rng, at.x, at.y, radius * 0.7, radius * 0.5, 0.15);

				land.pits.push({ outer: blobPath(pit, 1), inner: blobPath(pit, 0.55) });
				break;
			}
			case 'stone':
				land.rocks.push(...scatter(at, radius * 0.8, 4 + patch.size * 2, 12, 22));
				break;
			case 'iron':
				land.ores.push(...scatter(at, radius * 0.7, 3 + patch.size * 2, 9, 15));
				break;
		}
	}

	// Forests, plus the odd lone tree on open land.
	land.trees = poisson(
		rng,
		VILLAGE_WIDTH,
		VILLAGE_HEIGHT,
		26,
		(x, y) =>
			open(x, y) &&
			(forests.some((f) => pointDistance({ x, y }, f) < f.r * range(rng, 0.75, 1)) || rng() < 0.012),
		400,
	).map((p) => ({
		x: round1(p.x),
		y: round1(p.y),
		r: round1(range(rng, 13, 21)),
		conifer: rng() < coniferShare,
	}));

	// A few small stones anywhere, so open land is not bare.
	for (let i = 0; i < 8; i++) {
		const x = rng() * VILLAGE_WIDTH;
		const y = rng() * VILLAGE_HEIGHT;

		if (open(x, y)) {
			land.rocks.push({ x: round1(x), y: round1(y), r: round1(range(rng, 6, 12)) });
		}
	}

	const byDepth = (a: Point, b: Point) => a.y - b.y;

	land.trees.sort(byDepth);
	land.rocks.sort(byDepth);
	land.ores.sort(byDepth);

	return land;
}

