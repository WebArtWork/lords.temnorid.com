import { VillageBuilding } from '../building/building.interface';
import { levelAt } from '../building/building.timing';

/**
 * A village's fighting strength, as Travian sums it: attack from the troops that can march out,
 * defense from the troops at home, raised by the wall. There are no troops yet, so attack is 0 and
 * defense is what the villagers themselves can hold, which the wall still raises.
 */

/** What the villagers can hold with no troops at all. */
export const VILLAGER_DEFENSE = 10;
/** Each wall level adds this share to the village's defense, as Travian's city wall. */
export const WALL_BONUS_PER_LEVEL = 0.04;

export interface VillageStrength {
	attack: number;
	defense: number;
	/** The wall's share of the defense, e.g. 0.12 for +12%. */
	wallBonus: number;
}

export function villageStrength(
	buildings: Record<string, VillageBuilding>,
	now: number,
): VillageStrength {
	const wall = Object.values(buildings).find((building) => building.type === 'wall');
	const wallBonus = wall ? WALL_BONUS_PER_LEVEL * levelAt(wall, now) : 0;

	return {
		attack: 0,
		defense: Math.round(VILLAGER_DEFENSE * (1 + wallBonus)),
		wallBonus,
	};
}
