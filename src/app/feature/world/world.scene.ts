import { openCurve, Point, round1 } from '../map/map-geometry';
import { CITIES, geoAt, GEO_KM_PER_TILE, RIVERS, WorldCity } from './world.geography';
import { isExplored, terrainAt, WORLD_SEED } from './world.generator';
import { WorldCounts, WorldTerrain } from './world.interface';
import { hash2 } from './world.noise';

/**
 * Draws a window of the world as low-poly relief: every tile is an irregular quad cut into two
 * flat-shaded triangles, coloured by what covers it and lit from the north-west. Triangles of the
 * same colour share one SVG path, so even a zoomed-out view stays a few dozen elements.
 */

export interface SceneView {
	/** World tile in the top-left corner of the view. */
	firstX: number;
	firstY: number;
	cols: number;
	rows: number;
	/** Tile size in SVG units. */
	tile: number;
	/** Explored area; null shows the whole land, as on the onboarding map. */
	counts: WorldCounts | null;
}

export interface SceneRiver {
	d: string;
	width: number;
}

export interface SceneCity extends Point {
	city: WorldCity;
}

export interface WorldScene {
	facets: { fill: string; d: string }[];
	rivers: SceneRiver[];
	fog: string;
	cities: SceneCity[];
}

/** Base colours of the land. Mid tones: the light raises or lowers them. */
const LAND: Record<WorldTerrain, [number, number, number]> = {
	grass: [158, 186, 98],
	heart: [158, 186, 98],
	grain: [210, 180, 104],
	wood: [80, 120, 60],
	stone: [178, 172, 152],
	iron: [138, 122, 104],
	clay: [186, 136, 92],
	// River tiles: wet meadow along the banks; the river itself is drawn on top.
	water: [128, 168, 104],
};
/** Ponds: water drawn as facets, so neighbouring ponds run together into one lake. */
const POND: [number, number, number] = [96, 156, 182];
const SHADOW: [number, number, number] = [36, 30, 22];
const HIGHLIGHT: [number, number, number] = [255, 248, 228];
/** Light from the north-west, high in the sky. */
const LIGHT = _normalise([-1, -1, 1.6]);
const FLAT = LIGHT[2];
/** Vertical exaggeration, so a 150 m canyon reads at 2 km a tile. */
const RELIEF = 26;
/** How far tile corners drift off the grid, in tiles. */
const JITTER = 0.2;

export function buildScene(view: SceneView): WorldScene {
	const { firstX, firstY, cols, rows, tile, counts } = view;
	const corners = new Map<string, { sx: number; sy: number; z: number }>();
	const corner = (i: number, j: number) => {
		const key = `${i}|${j}`;
		let c = corners.get(key);

		if (!c) {
			const gx = i - 0.5 + (hash2(i, j, WORLD_SEED ^ 0x1b873593) - 0.5) * 2 * JITTER;
			const gy = j - 0.5 + (hash2(j, i, WORLD_SEED ^ 0x68e31da4) - 0.5) * 2 * JITTER;

			c = {
				sx: (gx - firstX + 0.5) * tile,
				sy: (gy - firstY + 0.5) * tile,
				z: (geoAt(round1(gx), round1(gy)).height * RELIEF) / (GEO_KM_PER_TILE * 1000),
			};
			corners.set(key, c);
		}

		return c;
	};
	const buckets = new Map<string, string[]>();
	const fog: string[] = [];

	// One tile past each edge, so the jittered border never leaves a gap.
	for (let y = firstY - 1; y <= firstY + rows; y++) {
		for (let x = firstX - 1; x <= firstX + cols; x++) {
			const terrain = terrainAt(x, y);
			const pond = terrain === 'water' && geoAt(x, y).riverDistance > 1;
			const a = corner(x, y);
			const b = corner(x + 1, y);
			const c = corner(x + 1, y + 1);
			const d = corner(x, y + 1);
			const flip = hash2(x, y, WORLD_SEED ^ 0x2545f491) < 0.5;
			const triangles = flip
				? [
						[a, b, c],
						[a, c, d],
					]
				: [
						[a, b, d],
						[b, c, d],
					];

			triangles.forEach((triangle, k) => {
				const fill = _shade(
					pond ? POND : LAND[terrain],
					triangle,
					tile,
					hash2(x * 2 + k, y, WORLD_SEED),
					geoAt(x, y).height,
				);
				const path = `M${_xy(triangle[0]!)}L${_xy(triangle[1]!)}L${_xy(triangle[2]!)}Z`;
				const list = buckets.get(fill);

				if (list) {
					list.push(path);
				} else {
					buckets.set(fill, [path]);
				}
			});

			if (counts && !isExplored(x, y, counts)) {
				fog.push(`M${_xy(a)}L${_xy(b)}L${_xy(c)}L${_xy(d)}Z`);
			}
		}
	}

	const toScreen = (p: Point): Point => ({
		x: (p.x - firstX + 0.5) * tile,
		y: (p.y - firstY + 0.5) * tile,
	});
	const inView = (p: Point) =>
		p.x >= firstX - 4 &&
		p.x <= firstX + cols + 4 &&
		p.y >= firstY - 4 &&
		p.y <= firstY + rows + 4;
	const rivers = RIVERS.filter((river) => river.points.some(inView)).map((river) => ({
		d: openCurve(river.points.map(toScreen)),
		width: Math.max(1.5, river.width * tile),
	}));
	const cities = CITIES.filter(
		(city) =>
			city.x >= firstX - 1 &&
			city.x <= firstX + cols &&
			city.y >= firstY - 1 &&
			city.y <= firstY + rows,
	).map((city) => ({ city, ...toScreen(city) }));

	return {
		facets: [...buckets].map(([fill, paths]) => ({ fill, d: paths.join('') })),
		rivers,
		fog: fog.join(''),
		cities,
	};
}

/** Lambert light on the triangle's plane, quantised so similar facets share a path. */
function _shade(
	base: [number, number, number],
	[a, b, c]: { sx: number; sy: number; z: number }[],
	tile: number,
	grain: number,
	height: number,
): string {
	const u = [(b!.sx - a!.sx) / tile, (b!.sy - a!.sy) / tile, b!.z - a!.z];
	const v = [(c!.sx - a!.sx) / tile, (c!.sy - a!.sy) / tile, c!.z - a!.z];
	let n = [
		u[1]! * v[2]! - u[2]! * v[1]!,
		u[2]! * v[0]! - u[0]! * v[2]!,
		u[0]! * v[1]! - u[1]! * v[0]!,
	];

	if (n[2]! < 0) {
		n = n.map((value) => -value);
	}

	const normal = _normalise(n as [number, number, number]);
	const light = normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2];
	// A little noise per facet gives the faceted, cut-paper look even on flat land.
	// Valleys sit darker and hilltops lighter, as on a relief map.
	const altitude = Math.max(-1, Math.min(1, (height - 300) / 200)) * 0.14;
	const shade = Math.round(((light - FLAT) * 2.4 + altitude + (grain - 0.5) * 0.08) * 20) / 20;
	const target = shade > 0 ? HIGHLIGHT : SHADOW;
	const t = Math.min(0.6, Math.abs(shade));

	return `rgb(${base.map((value, i) => Math.round(value + (target[i]! - value) * t)).join(' ')})`;
}

function _xy(p: { sx: number; sy: number }): string {
	return `${round1(p.sx)} ${round1(p.sy)}`;
}

function _normalise([x, y, z]: [number, number, number]): [number, number, number] {
	const length = Math.hypot(x, y, z) || 1;

	return [x / length, y / length, z / length];
}
