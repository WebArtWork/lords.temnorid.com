/** Quarter of the world map a new lord is dropped into. */
export type RegionId = 'north-west' | 'north-east' | 'south-east' | 'south-west';

export interface MapRegion {
	id: RegionId;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	/** Material Symbols arrow pointing into the quarter. */
	icon: string;
}
