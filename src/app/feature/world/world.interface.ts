import { ElementId } from '../element/element.interface';
import { RegionId } from '../region/region.interface';
import { ResourceId } from '../resource/resource.interface';

/** What covers a world tile. `heart` is the centre of the world at (0|0). */
export type WorldTerrain = ResourceId | 'grass' | 'heart';

/** A lord's village on the world map. Stored in `lordsVillages/{uid}`. */
export interface WorldVillage {
	uid: string;
	lordName: string;
	element: ElementId;
	region: RegionId;
	/** Order in which the village settled its quarter; fixes its spot (see villageSpot). */
	index: number;
	x: number;
	y: number;
}

/** How many villages each quarter holds. Stored in `lordsWorld/quadrants`. */
export type WorldCounts = Record<RegionId, number>;

export interface WorldState {
	counts: WorldCounts;
	villages: WorldVillage[];
	mine: WorldVillage;
}
