import { ResourceId } from '../resource/resource.interface';

/**
 * Each level costs this much more than the one before. Steep on purpose: a plot (35 of all goods at
 * level 1) costs about 10k in total at level 10 and about 19k at level 11.
 */
export const COST_GROWTH = 1.88;

/** Every price is this share of its raw figure, to keep costs within what the stores can hold. */
export const COST_SCALE = 0.5;

/** What reaching `level` costs, given what level 1 costs. Rounded to fives, as prices are. */
export function costAtLevel(
	base: Partial<Record<ResourceId, number>>,
	level: number,
): Partial<Record<ResourceId, number>> {
	const factor = COST_GROWTH ** (level - 1) * COST_SCALE;

	return Object.fromEntries(
		Object.entries(base).map(([id, amount]) => [id, Math.round((amount * factor) / 5) * 5]),
	) as Partial<Record<ResourceId, number>>;
}
