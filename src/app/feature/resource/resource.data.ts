import { Resource, ResourceId } from './resource.interface';

export const RESOURCES: Resource[] = [
	{ id: 'wood', name: 'Деревина', icon: 'forest', color: '#3f6b2f' },
	{ id: 'stone', name: 'Каміння', icon: 'landscape', color: '#7a746b' },
	{ id: 'iron', name: 'Залізо', icon: 'hardware', color: '#8a4b33' },
	{ id: 'water', name: 'Вода', icon: 'water_drop', color: '#2f78a0' },
	{ id: 'grain', name: 'Зерно', icon: 'grass', color: '#b8892a' },
	{ id: 'clay', name: 'Глина', icon: 'layers', color: '#a0613a' },
];

export const RESOURCE_BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r])) as Record<
	ResourceId,
	Resource
>;
