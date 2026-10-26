import { VillageBuilding } from '../building/building.interface';
import { Point } from '../map/map-geometry';

/** A place where a building can stand. Coordinates are in map units (see VILLAGE_WIDTH/HEIGHT). */
export interface VillageSlot {
	id: number;
	x: number;
	y: number;
}

/**
 * What a player's village is made from. Saved in Firestore when the village is founded, so the
 * map never changes under the player: `seed` redraws the scenery, `slots` are the source of truth
 * for building places, and `layout` names the generator version that drew them.
 */
export interface VillageSave {
	seed: number;
	layout: number;
	slots: VillageSlot[];
	/** What stands on each place, by place id. Places not listed are free. */
	buildings?: Record<string, VillageBuilding>;
}

export interface VillageTree extends Point {
	r: number;
	conifer: boolean;
}

export interface VillageRock extends Point {
	r: number;
}

export interface VillageBridge extends Point {
	/** Degrees, along the road. */
	angle: number;
}

export interface VillagePalette {
	outer: string;
	ground: string;
	groundEdge: string;
	plaza: string;
	road: string;
	field: string;
	fieldLine: string;
	tree: string;
	treeDark: string;
	rock: string;
	rockShade: string;
	water: string;
	waterLight: string;
}

/** Everything the map draws. Paths are SVG path data. */
export interface VillageMap {
	width: number;
	height: number;
	palette: VillagePalette;
	boundary: string;
	plaza: string;
	centre: Point;
	roads: { d: string; width: number }[];
	slots: VillageSlot[];
	/** A stream around part of the village, or none. */
	stream: string | null;
	bridges: VillageBridge[];
	/** Rock ridge along the edge of the village. */
	ridge: VillageRock[];
	/** The farm beyond the walls (see farmSurroundings): grain fields, ponds, clay pits. */
	fields: string[];
	ponds: string[];
	pits: { outer: string; inner: string }[];
	trees: VillageTree[];
	/** Boulders, thickest where the farm quarries stone. */
	rocks: VillageRock[];
	/** Iron ore where the farm mines it. */
	ores: VillageRock[];
}
