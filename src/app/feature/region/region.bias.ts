import { ResourceId } from '../resource/resource.interface';

/**
 * What each side of the world is known for, added to a resource's weight. The world map's terrain
 * and the farms both lean this way, so a northern lord finds more wood and iron everywhere.
 */
export const REGION_BIAS: Record<'north' | 'south' | 'west' | 'east', Partial<Record<ResourceId, number>>> = {
	north: { wood: 0.4, iron: 0.3 },
	south: { grain: 0.4, water: 0.3 },
	west: { water: 0.3 },
	east: { stone: 0.2, clay: 0.2 },
};
