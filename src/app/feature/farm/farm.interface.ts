import { Construction } from '../building/building.interface';
import { Point } from '../map/map-geometry';
import { ResourceId } from '../resource/resource.interface';

/** A plot of land outside the village that yields one resource. */
export interface FarmPlot extends Point {
	id: number;
	resource: ResourceId;
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
	trees: FarmDecor[];
	rocks: FarmDecor[];
}
