import { MapRegion } from './region.interface';

/** In reading order, so a 2×2 grid lays them out like the map: north row first, west column first. */
export const REGIONS: MapRegion[] = [
	{ id: 'north-west', name: 'Північний захід', icon: 'north_west' },
	{ id: 'north-east', name: 'Північний схід', icon: 'north_east' },
	{ id: 'south-west', name: 'Південний захід', icon: 'south_west' },
	{ id: 'south-east', name: 'Південний схід', icon: 'south_east' },
];

// TODO(image): src/assets/map/world.webp — see IMAGES-TODO.md
export const WORLD_MAP_IMAGE = '';
