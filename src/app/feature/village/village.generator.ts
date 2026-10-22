import { ElementId } from '../element/element.interface';
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
 * Never change what layout 1 draws: saved villages depend on it. A new look is a new
 * VILLAGE_LAYOUT with its own branch.
 */
export const VILLAGE_LAYOUT = 1;
export const VILLAGE_WIDTH = 1000;
export const VILLAGE_HEIGHT = 750;
/** Every village gets the same number of places to build, so no player starts ahead. */
export const VILLAGE_SLOT_COUNT = 18;

/** Direction of the world's edge as seen from each quarter, in screen angles (y points down). */
const REGION_ANGLE: Record<RegionId, number> = {
	'north-west': (-3 * Math.PI) / 4,
	'north-east': -Math.PI / 4,
	'south-east': Math.PI / 4,
	'south-west': (3 * Math.PI) / 4,
};

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

/** Samples the building slots of a new village. Call once, then save the result. */
export function generateVillageSlots(seed: number): VillageSlot[] {
	const { village, plaza } = _shape(seed);

	return _sampleSlots(seededRng(seed ^ 0x9e3779b9), village, plaza);
}

/** Draws the whole map from the seed, around saved slots. */
export function generateVillage(
	seed: number,
	element: ElementId,
	region: RegionId,
	slots: VillageSlot[],
): VillageMap {
	const { village, plaza } = _shape(seed);
	// Scenery has its own random stream, so it never depends on how the slots were sampled.
	const rng = seededRng(seed ^ 0x85ebca6b);
	const centre = { x: plaza.cx, y: plaza.cy };

	const roads = _slotRoads(rng, centre, slots);
	const exits = _exits(rng, village, centre);
	const streamArc = _streamArc(rng, element);
	const stream = streamArc ? _streamPath(rng, village, streamArc) : null;
	const bridges = streamArc ? _bridges(village, exits, streamArc) : [];
	const ridge = _ridge(rng, element, village, exits, streamArc);
	const fieldBlobs = _fieldBlobs(rng, village);
	const exitLines = exits.map((exit) => exit.points);
	const trees = _trees(rng, region, village, fieldBlobs, exitLines);
	const rocks = _rocks(rng, element, village, fieldBlobs, exitLines);

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
		fields: fieldBlobs.map((blob) => blobPath(blob, 1)),
		trees,
		rocks,
	};
}

// ---- Shape ----

/** Village outline and central square. Both come first from the seed, so slots and scenery agree. */
function _shape(seed: number) {
	const rng = seededRng(seed);
	const village = makeBlob(
		rng,
		VILLAGE_WIDTH / 2 + range(rng, -30, 30),
		VILLAGE_HEIGHT / 2 + range(rng, -20, 20),
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
	let minDistance = 112;
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

/** Two to four roads leaving the village, spread around it. */
function _exits(rng: Rng, village: Blob, centre: Point): Exit[] {
	const count = 2 + Math.floor(rng() * 3);
	const start = rng() * TAU;

	return Array.from({ length: count }, (_, i) => {
		const angle = start + (i * TAU) / count + range(rng, -0.3, 0.3);
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

	for (let angle = 0; angle < TAU; angle += range(rng, 0.045, 0.1)) {
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

// ---- Scenery outside the village ----

function _fieldBlobs(rng: Rng, village: Blob): Blob[] {
	const count = 2 + Math.floor(rng() * 3);
	const fields: Blob[] = [];

	for (let i = 0; i < count * 4 && fields.length < count; i++) {
		const at = blobPoint(village, rng() * TAU, range(rng, 1.35, 1.55));
		const field = makeBlob(rng, at.x, at.y, range(rng, 55, 95), range(rng, 32, 55), 0.12);
		const onMap = at.x > 40 && at.x < VILLAGE_WIDTH - 40 && at.y > 30 && at.y < VILLAGE_HEIGHT - 30;
		const apart = fields.every((other) => pointDistance(at, { x: other.cx, y: other.cy }) > 190);

		if (onMap && apart) {
			fields.push(field);
		}
	}

	return fields;
}

/** Forests gather toward the world's edge: north-west villages have their woods to the north-west. */
function _trees(
	rng: Rng,
	region: RegionId,
	village: Blob,
	fields: Blob[],
	exitLines: Point[][],
): VillageTree[] {
	const edge = REGION_ANGLE[region];
	const coniferShare = region.startsWith('north') ? 0.7 : 0.2;
	const clusterCount = 3 + Math.floor(rng() * 3);
	const clusters = Array.from({ length: clusterCount }, (_, i) => {
		// Two in three clusters face the world's edge; the rest fall anywhere.
		const angle = i % 3 === 2 ? rng() * TAU : edge + range(rng, -0.8, 0.8);
		const at = blobPoint(village, angle, range(rng, 1.45, 1.8));

		return { ...at, r: range(rng, 110, 190) };
	});

	const trees = poisson(rng, VILLAGE_WIDTH, VILLAGE_HEIGHT, 26, (x, y) => {
		const free = _outsideVillage(village, fields, exitLines, x, y);
		const inForest = clusters.some((c) => pointDistance({ x, y }, c) < c.r * range(rng, 0.7, 1));

		return free && (inForest || rng() < 0.03);
	});

	return trees
		.map((p) => ({
			x: round1(p.x),
			y: round1(p.y),
			r: round1(range(rng, 13, 21)),
			conifer: rng() < coniferShare,
		}))
		.sort((a, b) => a.y - b.y);
}

function _rocks(
	rng: Rng,
	element: ElementId,
	village: Blob,
	fields: Blob[],
	exitLines: Point[][],
): VillageRock[] {
	const count = element === 'stone' ? 14 + Math.floor(rng() * 8) : 6 + Math.floor(rng() * 6);
	const rocks: VillageRock[] = [];

	for (let i = 0; i < count * 6 && rocks.length < count; i++) {
		const x = rng() * VILLAGE_WIDTH;
		const y = rng() * VILLAGE_HEIGHT;

		if (_outsideVillage(village, fields, exitLines, x, y)) {
			rocks.push({ x: round1(x), y: round1(y), r: round1(range(rng, 6, 15)) });
		}
	}

	return rocks.sort((a, b) => a.y - b.y);
}

/** Open land: beyond the stream, off the fields and clear of the roads. */
function _outsideVillage(
	village: Blob,
	fields: Blob[],
	exitLines: Point[][],
	x: number,
	y: number,
): boolean {
	const point = { x, y };

	return (
		!inBlob(village, x, y, 1.18) &&
		fields.every((field) => !inBlob(field, x, y, 1.15)) &&
		exitLines.every((line) => distanceToLine(point, line) > 22)
	);
}
