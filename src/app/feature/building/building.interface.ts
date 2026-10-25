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
}

/** A building standing on a village place. Saved in VillageSave.buildings by place id. */
export interface VillageBuilding {
	type: BuildingId;
	level: number;
}
