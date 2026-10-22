export type ResourceId = 'wood' | 'stone' | 'iron' | 'water' | 'grain' | 'clay';

export interface Resource {
	id: ResourceId;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	/** Material Symbols icon. */
	icon: string;
	/** Ring colour of this resource's plots on the farm map. */
	color: string;
}
