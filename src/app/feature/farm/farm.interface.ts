import { Construction } from '../building/building.interface';
import { Point } from '../map/map-geometry';
import { ResourceId } from '../resource/resource.interface';

/** A plot of land outside the village that yields one resource. */
export interface FarmPlot extends Point {
	id: number;
	resource: ResourceId;
	/** Bought later, to grow the farm; the ones it started with are not. Their place is drawn, not saved. */
	extra?: true;
	/** Which patch of its resource a bought plot grows (0 or 1); the plots it started with fill the patches in order. */
	patch?: number;
}

/** Saved like VillageSave: the seed redraws scenery, the plots are the source of truth. */
export interface FarmSave {
	seed: number;
	layout: number;
	plots: FarmPlot[];
	/**
	 * The village's tile on the world map, which the farm's land is read from (see farmLand). Set
	 * once the village has its place; farms laid out before that learn it on a later load.
	 */
	at?: Point;
	/** How far each plot has been worked, by plot id. Plots not listed are at level 0. */
	levels?: Record<string, Construction>;
}

/** An empty spot in a patch where a new plot of its resource can be bought. */
export interface FarmAdd extends Point {
	resource: ResourceId;
	/** The patch of that resource it grows. */
	patch: number;
}

export interface FarmDecor extends Point {
	r: number;
}

/** One patch of land of a single resource: a forest, a quarry, a lake, a field… */
export interface FarmZone {
	resource: ResourceId;
	path: string;
	/** Extra outlines inside the zone: lake shallows, clay-pit terraces. */
	inner: string[];
	/** Trees in a forest, peaks in a quarry, rocks in a mine. */
	decor: FarmDecor[];
}

export interface FarmMap {
	width: number;
	height: number;
	village: Point & { path: string };
	roads: string[];
	zones: FarmZone[];
	plots: FarmPlot[];
	/** One per patch: the place to press to grow it. */
	adds: FarmAdd[];
	trees: FarmDecor[];
	rocks: FarmDecor[];
}
