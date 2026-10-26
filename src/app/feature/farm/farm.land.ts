import { Point } from '../map/map-geometry';
import { RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';
import { terrainAt } from '../world/world.generator';

/** Tiles round the village tile that count as its land: 5 tiles, about 10 km on the world map. */
export const FARM_LAND_RADIUS = 5;

/**
 * The land round a village on the world map, as its farm sees it: how much of each resource lies
 * near (closer tiles count more), and which way it lies. A village beside a forest farms more wood,
 * and its wood patch faces that forest.
 */
export interface FarmLand {
	/** Each resource's share of the land round the village, 0–1; together they make 1. */
	shares: Record<ResourceId, number>;
	/** Screen angle from the village toward each resource that lies near, radians (y points down). */
	directions: Partial<Record<ResourceId, number>>;
}

/** The land round the village tile at `at`, read from the shared world map. */
export function farmLand(at: Point): FarmLand {
	const weight = Object.fromEntries(RESOURCES.map((r) => [r.id, 0])) as Record<ResourceId, number>;
	const pull = Object.fromEntries(RESOURCES.map((r) => [r.id, { x: 0, y: 0 }])) as Record<
		ResourceId,
		Point
	>;

	for (let dy = -FARM_LAND_RADIUS; dy <= FARM_LAND_RADIUS; dy++) {
		for (let dx = -FARM_LAND_RADIUS; dx <= FARM_LAND_RADIUS; dx++) {
			const distance = Math.hypot(dx, dy);

			if (!distance || distance > FARM_LAND_RADIUS) {
				continue;
			}

			const terrain = terrainAt(at.x + dx, at.y + dy);

			if (terrain === 'grass' || terrain === 'heart') {
				continue;
			}

			const near = 1 / distance;

			weight[terrain] += near;
			pull[terrain].x += (dx / distance) * near;
			pull[terrain].y += (dy / distance) * near;
		}
	}

	const total = Object.values(weight).reduce((sum, w) => sum + w, 0);
	const shares = Object.fromEntries(
		RESOURCES.map((r) => [r.id, total ? weight[r.id] / total : 0]),
	) as Record<ResourceId, number>;
	// A direction only where the resource clearly lies to one side, not scattered all round.
	const directions = Object.fromEntries(
		RESOURCES.filter((r) => Math.hypot(pull[r.id].x, pull[r.id].y) > 0.25).map((r) => [
			r.id,
			Math.atan2(pull[r.id].y, pull[r.id].x),
		]),
	) as Partial<Record<ResourceId, number>>;

	return { shares, directions };
}
