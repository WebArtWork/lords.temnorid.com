import { distanceToLine, Point } from '../map/map-geometry';
import { valueNoise } from './world.noise';

/**
 * The real land under the world grid: Podillia and northern Bukovina around 1300–1400, between
 * Terebovlia in the north-west and Bakota in the east.
 *
 * The heart of the world (0|0) is Kamianets, the stone town in the Smotrych canyon. One tile is
 * GEO_KM_PER_TILE kilometres; x grows to the east and y to the south, as on the grid. Lines are
 * written in degrees, as read off a map, and projected onto tiles once.
 */
export const GEO_KM_PER_TILE = 2;

const ORIGIN = { lat: 48.678, lon: 26.585 };
const TILES_PER_LON = (111.32 * Math.cos((ORIGIN.lat * Math.PI) / 180)) / GEO_KM_PER_TILE;
const TILES_PER_LAT = 111.2 / GEO_KM_PER_TILE;
const GEO_SEED = 0x51a7e3c9;

/** Degrees to tile coordinates. Integers land on tile centres. */
export function geoToTile(lat: number, lon: number): Point {
	return { x: (lon - ORIGIN.lon) * TILES_PER_LON, y: (ORIGIN.lat - lat) * TILES_PER_LAT };
}

export type CityId = 'kamianets' | 'smotrych' | 'bakota' | 'khotyn' | 'chernivtsi' | 'terebovlia';

export interface WorldCity extends Point {
	id: CityId;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	/** One line on what stood there in the 14th century. Ukrainian source text. */
	about: string;
	/** Drawn bigger: the heart of the world. */
	capital?: boolean;
}

/**
 * Towns that stood in 1300–1400. Tiles are rounded from their coordinates and nudged a tile off
 * the river where rounding would drop the town into the water.
 */
export const CITIES: WorldCity[] = [
	{
		// 48.678, 26.585
		id: 'kamianets',
		name: "Кам'янець",
		about: 'Фортеця на скелі, яку обіймає петля Смотрича. Серце світу. Магдебурзьке право з 1374 року.',
		capital: true,
		x: 0,
		y: 0,
	},
	{
		// 48.933, 26.567
		id: 'smotrych',
		name: 'Смотрич',
		about: 'Замок князів Коріатовичів над верхнім Смотричем, одна з перших твердинь Поділля.',
		x: -1,
		y: -14,
	},
	{
		// 48.594, 26.989; on the left bank, a tile north of the river.
		id: 'bakota',
		name: 'Бакота',
		about: 'Давній центр Пониззя над Дністром, скельний монастир у крейдяній кручі.',
		x: 15,
		y: 4,
	},
	{
		// 48.507, 26.492
		id: 'khotyn',
		name: 'Хотин',
		about: "Кам'яна фортеця на правому березі Дністра, що стереже переправу.",
		x: -3,
		y: 10,
	},
	{
		// 48.292, 25.936
		id: 'chernivtsi',
		name: 'Чернівці',
		about: 'Фортеця над Прутом на межі Молдавського князівства, вперше згадана 1408 року.',
		x: -24,
		y: 22,
	},
	{
		// 49.302, 25.697
		id: 'terebovlia',
		name: 'Теребовля',
		about: 'Давній галицький замок на пагорбі, де Гнізна впадає в Серет.',
		x: -33,
		y: -35,
	},
];

export const CITY_BY_KEY = new Map(CITIES.map((city) => [`${city.x}|${city.y}`, city]));

export function cityAt(x: number, y: number): WorldCity | null {
	return CITY_BY_KEY.get(`${x}|${y}`) ?? null;
}

/** True on a town and the ring of tiles around it, where no lord may settle. */
export function nearCity(x: number, y: number): boolean {
	return CITIES.some((city) => Math.abs(city.x - x) <= 1 && Math.abs(city.y - y) <= 1);
}

export interface WorldRiver {
	/** Ukrainian source text; translated through i18n. */
	name: string;
	/** Width of the water, in tiles. */
	width: number;
	/** How deep the river has cut below the plateau, in metres, and how wide its valley is. */
	depth: number;
	valley: number;
	points: Point[];
}

function _line(points: [number, number][]): Point[] {
	return points.map(([lat, lon]) => geoToTile(lat, lon));
}

export const RIVERS: WorldRiver[] = [
	{
		name: 'Дністер',
		width: 0.42,
		depth: 150,
		valley: 1.4,
		points: _line([
			[48.8, 25.4],
			[48.73, 25.55],
			[48.67, 25.68],
			[48.645, 25.735],
			[48.63, 25.85],
			[48.6, 25.95],
			[48.615, 26.05],
			[48.58, 26.15],
			[48.56, 26.28],
			[48.537, 26.4],
			[48.545, 26.47],
			[48.525, 26.51],
			[48.535, 26.58],
			[48.555, 26.655],
			[48.57, 26.75],
			[48.585, 26.87],
			[48.583, 26.99],
			[48.6, 27.1],
			[48.63, 27.25],
		]),
	},
	{
		name: 'Смотрич',
		width: 0.2,
		depth: 90,
		valley: 0.8,
		points: _line([
			[49.36, 26.55],
			[49.15, 26.53],
			[48.98, 26.56],
			[48.933, 26.567],
			[48.85, 26.56],
			[48.76, 26.575],
			[48.7, 26.58],
			// The loop around the stone island of Kamianets.
			[48.688, 26.594],
			[48.679, 26.598],
			[48.671, 26.592],
			[48.672, 26.578],
			[48.668, 26.572],
			[48.66, 26.585],
			[48.64, 26.605],
			[48.6, 26.63],
			[48.555, 26.655],
		]),
	},
	{
		name: 'Збруч',
		width: 0.18,
		depth: 80,
		valley: 0.8,
		points: _line([
			[49.45, 26.2],
			[49.25, 26.26],
			[49.07, 26.18],
			[48.95, 26.22],
			[48.85, 26.2],
			[48.7, 26.3],
			[48.6, 26.35],
			[48.537, 26.4],
		]),
	},
	{
		name: 'Серет',
		width: 0.2,
		depth: 80,
		valley: 1,
		points: _line([
			[49.45, 25.65],
			[49.3, 25.73],
			[49.15, 25.73],
			[49.02, 25.8],
			[48.85, 25.82],
			[48.72, 25.86],
			[48.63, 25.85],
		]),
	},
	{
		name: 'Гнізна',
		width: 0.14,
		depth: 40,
		valley: 0.7,
		points: _line([
			[49.45, 25.88],
			[49.38, 25.8],
			[49.3, 25.73],
		]),
	},
	{
		name: 'Прут',
		width: 0.36,
		depth: 70,
		valley: 2.2,
		points: _line([
			[48.45, 25.4],
			[48.4, 25.62],
			[48.34, 25.8],
			[48.305, 25.94],
			[48.27, 26.08],
			[48.23, 26.25],
			[48.17, 26.4],
		]),
	},
];

/** The Tovtry: a chain of grey limestone hills crossing Podillia from north-west to south-east. */
const TOVTRY = _line([
	[49.6, 25.85],
	[49.33, 26.05],
	[49.2, 26.25],
	[49.0, 26.38],
	[48.85, 26.5],
	[48.74, 26.66],
	[48.66, 26.8],
	[48.6, 26.92],
]);

/** The Khotyn upland: wooded hills between the Dniester and the Prut. */
const KHOTYN_UPLAND = { ...geoToTile(48.42, 26.2), r: 9 };

/** Everything the terrain needs to know about the real land under a point. */
export interface GeoSample {
	/** Height above the sea, in metres. */
	height: number;
	/** Distance to the nearest river's middle, in tiles, and that river's width. */
	riverDistance: number;
	riverWidth: number;
	/** 0–1 leanings toward each kind of land. */
	forest: number;
	rock: number;
	field: number;
	floodplain: number;
}

const _cache = new Map<string, GeoSample>();

/** Samples the land at a point. Cached, since every tile corner is asked for several times. */
export function geoAt(x: number, y: number): GeoSample {
	const key = `${x}|${y}`;
	let sample = _cache.get(key);

	if (!sample) {
		if (_cache.size > 60000) {
			_cache.clear();
		}

		sample = _sample(x, y);
		_cache.set(key, sample);
	}

	return sample;
}

function _sample(x: number, y: number): GeoSample {
	const p = { x, y };
	let height =
		300 +
		(valueNoise(x / 6, y / 6, GEO_SEED) - 0.5) * 70 +
		(valueNoise(x / 2, y / 2, GEO_SEED + 1) - 0.5) * 26 -
		y * 0.8;

	// Tovtry: a ridge of separate hills, so its height swells and dips along the chain.
	const ridge = distanceToLine(p, TOVTRY);
	const hills = 0.45 + valueNoise(x / 1.6, y / 1.6, GEO_SEED + 2);
	const tovtry = Math.exp(-((ridge / 1.1) ** 2));

	height += 75 * tovtry * hills;

	const upland = Math.max(
		0,
		1 - Math.hypot(x - KHOTYN_UPLAND.x, y - KHOTYN_UPLAND.y) / KHOTYN_UPLAND.r,
	);

	height += 190 * upland ** 1.4;
	// Bukovina climbs toward the Carpathians in the south-west.
	height += Math.max(0, y - 20 - x * 0.4) * 5;

	let riverDistance = Infinity;
	let riverWidth = 0;
	let canyon = 0;
	let dniester = Infinity;

	for (const river of RIVERS) {
		const distance = distanceToLine(p, river.points);

		if (distance < riverDistance) {
			riverDistance = distance;
			riverWidth = river.width;
		}

		if (river.name === 'Дністер') {
			dniester = distance;
		}

		canyon = Math.max(canyon, river.depth * Math.exp(-((distance / river.valley) ** 2)));
	}

	height -= canyon;

	const noise = valueNoise(x / 3, y / 3, GEO_SEED + 3);
	// Woods on the canyon slopes, on the Khotyn upland and in Bukovina beyond the Prut.
	const slopes = dniester > 0.7 && dniester < 2.8 ? 0.6 : 0;
	const bukovina = Math.min(1, Math.max(0, (y - 18 - x * 0.3) / 6));
	const forest = Math.min(
		1,
		slopes + upland * 1.2 + bukovina * 0.8 + tovtry * 0.25 * (y < -10 ? 1 : 0) + noise * 0.3,
	);
	const rock = Math.min(
		1,
		tovtry * 0.9 + (riverDistance > 0.5 && riverDistance < 1.2 ? 0.35 : 0),
	);
	const floodplain = riverDistance < 2.2 ? 1 - riverDistance / 2.2 : 0;
	// Black-earth plateau: open fields wherever nothing else claims the land.
	const field = Math.max(0, 1 - forest - rock * 0.6 - floodplain * 0.5);

	return { height, riverDistance, riverWidth, forest, rock, field, floodplain };
}
