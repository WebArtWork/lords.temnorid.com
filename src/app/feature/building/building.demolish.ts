import { ResourceId } from '../resource/resource.interface';
import { BUILDING_BY_ID } from './building.data';
import { costAtLevel } from './building.cost';
import { BuildingId, BuildingType, Construction, VillageBuilding } from './building.interface';
import { buildSeconds, buildersBusyUntil, levelAt, runningUpgrade, standing } from './building.timing';

/** The share of what the taken-down levels cost that comes back to the stores. */
export const REFUND_SHARE = 0.5;

/** The lowest level a building can be taken down to; the lord's hall always stands. */
export function lowestLevel(type: BuildingId): number {
	return type === 'lords-hall' ? 1 : 0;
}

/** Taking a level down takes this share of the time raising it took. */
export const DEMOLISH_TIME_SHARE = 0.5;

/** How long taking a building from level `from` down to `to` takes, in seconds: the levels' times add up. */
export function demolishSeconds(
	type: Pick<BuildingType, 'cost'>,
	from: number,
	to: number,
	hallLevel: number,
): number {
	let seconds = 0;

	for (let level = to + 1; level <= from; level++) {
		seconds += buildSeconds(type, level, hallLevel);
	}

	return Math.round(seconds * DEMOLISH_TIME_SHARE);
}

/** What taking a building from level `from` down to level `to` gives back (0 = tearing it down). */
export function demolishRefund(
	base: Partial<Record<ResourceId, number>>,
	from: number,
	to: number,
): Partial<Record<ResourceId, number>> {
	const refund: Partial<Record<ResourceId, number>> = {};

	for (let level = to + 1; level <= from; level++) {
		for (const [id, amount] of Object.entries(costAtLevel(base, level))) {
			refund[id as ResourceId] = (refund[id as ResourceId] ?? 0) + amount;
		}
	}

	return Object.fromEntries(
		Object.entries(refund).map(([id, amount]) => [id, Math.floor(amount * REFUND_SHARE)]),
	) as Partial<Record<ResourceId, number>>;
}

/**
 * Why a building cannot be taken down to level `to` right now, as a Ukrainian source text for
 * i18n, or '' when it can.
 */
export function demolishBlocker(
	buildings: Record<string, VillageBuilding>,
	slot: string,
	to: number,
	now: number,
	plots: Record<string, Construction> = {},
): string {
	buildings = standing(buildings, now);
	const building = buildings[slot];

	if (!building) {
		return 'Тут нічого не збудовано.';
	}

	if (runningUpgrade(building, now)) {
		return 'Будівля зараз вдосконалюється.';
	}

	if (buildersBusyUntil(buildings, now, plots)) {
		return 'Будівельники зайняті.';
	}

	if (to < lowestLevel(building.type) || to >= levelAt(building, now)) {
		return 'Так розібрати не можна.';
	}

	// Tearing the last one of a kind down leaves buildings that need it without their requirement.
	if (to === 0) {
		const others = Object.entries(buildings).filter(
			([place, other]) => place !== slot && other.type === building.type && levelAt(other, now) > 0,
		);

		if (!others.length) {
			const dependent = Object.values(buildings).find(
				(other) => BUILDING_BY_ID[other.type].requires.includes(building.type),
			);

			if (dependent) {
				return 'Спершу розберіть будівлі, що потребують цієї.';
			}
		}
	}

	return '';
}
