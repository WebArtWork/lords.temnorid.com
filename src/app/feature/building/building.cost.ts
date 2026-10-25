import { ResourceId } from '../resource/resource.interface';

/** Each level costs this much more than the one before, as in Travian. */
export const COST_GROWTH = 1.28;

/** What reaching `level` costs, given what level 1 costs. Rounded to fives, as prices are. */
export function costAtLevel(
	base: Partial<Record<ResourceId, number>>,
	level: number,
): Partial<Record<ResourceId, number>> {
	const factor = COST_GROWTH ** (level - 1);

	return Object.fromEntries(
		Object.entries(base).map(([id, amount]) => [id, Math.round((amount * factor) / 5) * 5]),
	) as Partial<Record<ResourceId, number>>;
}
