import { Point, TAU } from '../map/map-geometry';
import { cityAt } from '../world/world.geography';
import { WORLD_HEART } from '../world/world.generator';
import { Dungeon, DUNGEONS, DungeonId } from './dungeon.data';

/** Kilometres per world tile; the world map's scale bar says the same. */
export const KM_PER_TILE = 2;

export interface DungeonSpot extends Point {
	id: DungeonId;
	danger: Dungeon['danger'];
}

/**
 * Where a lord's dungeons lie on the world map. Each lord has their own, as Travian's adventures:
 * at the dungeon's distance from their village, in a direction fixed by the lord and the dungeon,
 * so the map never moves them. Towns and the heart of the world are stepped around.
 */
export function dungeonSpots(home: Point, uid: string): DungeonSpot[] {
	return DUNGEONS.map((dungeon) => ({
		id: dungeon.id,
		danger: dungeon.danger,
		..._spot(home, uid, dungeon),
	}));
}

function _spot(home: Point, uid: string, dungeon: Dungeon): Point {
	const radius = dungeon.distance / KM_PER_TILE;
	let angle = _hash(`${uid}:${dungeon.id}`) * TAU;
	let spot = home;

	for (let attempt = 0; attempt < 16; attempt++) {
		spot = {
			x: home.x + Math.round(Math.cos(angle) * radius),
			y: home.y + Math.round(Math.sin(angle) * radius),
		};

		const inHeart = Math.max(Math.abs(spot.x), Math.abs(spot.y)) <= WORLD_HEART;

		if (!inHeart && !cityAt(spot.x, spot.y)) {
			break;
		}

		angle += 0.4;
	}

	return spot;
}

/** FNV-1a: a string to a stable 0–1 number. */
function _hash(text: string): number {
	let h = 0x811c9dc5;

	for (let i = 0; i < text.length; i++) {
		h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
	}

	return (h >>> 0) / 4294967296;
}
