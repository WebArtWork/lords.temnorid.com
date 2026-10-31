import { ResourceId } from '../resource/resource.interface';

export type BuildingId =
	| 'lords-hall'
	| 'rally-point'
	| 'warehouse'
	| 'granary'
	| 'well'
	| 'cranny'
	| 'marketplace'
	| 'embassy'
	| 'sawmill'
	| 'stonecutter'
	| 'foundry'
	| 'pottery'
	| 'mill'
	| 'bakery'
	| 'barracks'
	| 'smithy'
	| 'academy'
	| 'stable'
	| 'workshop'
	| 'wall'
	| 'infirmary'
	| 'arena'
	| 'tavern'
	| 'castle'
	| 'town-hall'
	| 'treasury';

export type BuildingCategory = 'infrastructure' | 'economy' | 'military';

/** A kind of building a lord can raise on a free place in the village. */
export interface BuildingType {
	id: BuildingId;
	category: BuildingCategory;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	description: string;
	/** Material Symbols icon. */
	icon: string;
	/** What level 1 costs. Shown now; spent once resources are stockpiled. */
	cost: Partial<Record<ResourceId, number>>;
	/** Buildings that must already stand in the village. */
	requires: BuildingId[];
	/** Warehouses, granaries and crannies can be built more than once. */
	repeatable?: boolean;
	/** Stands only in the middle of the village (CENTER_PLACE), and nothing else stands there. */
	center?: boolean;
	/** Runs round the village (WALL_PLACE) instead of standing on a place. */
	wall?: boolean;
}

/** Place id of the village centre. Ordinary places are numbered from 1. */
export const CENTER_PLACE = 0;
/** Place id of the wall round the village: it is drawn along the edge, and no house stands there. */
export const WALL_PLACE = -1;

/**
/** One level of work: it starts when the one before ends, and counts as done once `endsAt` passes. */
export interface WorkStep {
	level: number;
	/** Epoch milliseconds. */
	startedAt: number;
	endsAt: number;
	/** True while a building is being taken down: `level` is then the lower level it ends at. */
	down?: boolean;
}

/**
 * Something that is raised level by level over time: a building or a farm plot. `level` is the
 * last finished level. The work is a chain of steps done one after another by the same builder:
 * `queue` holds the ones ahead and `upgrade` is the last, so pressing upgrade again just adds a
 * step to the end. Each step counts as done once its `endsAt` has passed (see levelAt).
 */
export interface Construction {
	level: number;
	queue?: WorkStep[];
	upgrade?: WorkStep;
}

/**
 * A building on a village place, saved in VillageSave.buildings by place id. Its level is 0 while
 * the first one is still being raised.
 */
export interface VillageBuilding extends Construction {
	type: BuildingId;
}
