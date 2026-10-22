/** Elements a location can be founded on. Only stone and fire exist at the start. */
export type ElementId = 'stone' | 'fire';

export interface LocationElement {
	id: ElementId;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	description: string;
	/** Material Symbols icon shown while `image` is empty. */
	icon: string;
	/** Path under src/assets, e.g. `elements/stone.webp`. Empty until the art exists (see IMAGES-TODO.md). */
	image: string;
}
