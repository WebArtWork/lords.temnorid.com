import { VillageBuilding } from '../building/building.interface';
import { buildingLevel } from '../building/building.timing';
import { Amounts } from '../economy/economy';
import { Dungeon, DungeonId } from './dungeon.data';

/**
 * The lord's hero, who goes into dungeons for loot as in Travian's adventures. The hero heals over
 * time and is hurt in the dungeon: the wounds are rolled when they set out and count from the
 * moment they are back. Wounds deeper than the hero's health kill them: the loot is lost and the
 * hero is carried to the infirmary, where they recover and come home with a little health.
 */
export const HERO_MAX_HEALTH = 100;
/** Health the hero recovers each hour, at home or away. */
export const HERO_HEAL_PER_HOUR = 10;
/** Health a fallen hero has when they leave the infirmary. */
export const HERO_REVIVE_HEALTH = 25;
/** Recovery without an infirmary: someone in the village tends the hero, slowly. */
const RECOVERY_HOURS_WITHOUT_INFIRMARY = 24;
/** Recovery in a level 1 infirmary; each level above takes a share off, down to the floor. */
const RECOVERY_HOURS_INFIRMARY = 8;
const RECOVERY_SPEEDUP = 0.9;
const RECOVERY_HOURS_MIN = 1;

export interface HeroExpedition {
	dungeon: DungeonId;
	/** Epoch milliseconds. */
	startedAt: number;
	endsAt: number;
	/** What the hero will bring back, if they come back alive. */
	loot: Partial<Amounts>;
	/**
	 * Health the hero loses, rolled at departure and taken at `endsAt`. Trips saved before this
	 * field existed were paid for at departure, so a missing value means nothing more to take.
	 */
	damage?: number;
}

/** Saved in LordsProgress.hero. */
export interface HeroSave {
	/** Health at `at`. */
	health: number;
	at: number;
	/** The current or last trip; cleared once its loot is collected. */
	expedition?: HeroExpedition | null;
}

/** home: free to go. away: in a dungeon. back: home with loot to hand over. infirmary: fell, recovering. */
export type HeroStatus = 'home' | 'away' | 'back' | 'infirmary';

export function newHero(now: number): HeroSave {
	return { health: HERO_MAX_HEALTH, at: now };
}

/** How the last trip ended, once it has: whether the hero fell, and when they leave the infirmary. */
export function heroFate(
	hero: HeroSave,
	buildings: Record<string, VillageBuilding> = {},
): { fell: boolean; recoveredAt: number } | null {
	const expedition = hero.expedition;

	if (!expedition?.damage) {
		return null;
	}

	const onReturn = _healed(hero.health, hero.at, expedition.endsAt) - expedition.damage;

	if (onReturn > 0) {
		return { fell: false, recoveredAt: expedition.endsAt };
	}

	// Recovery is set by the infirmary as it stood when the hero was carried in.
	const level = buildingLevel(buildings, 'infirmary', expedition.endsAt);

	return {
		fell: true,
		recoveredAt: expedition.endsAt + recoveryHours(level) * 3_600_000,
	};
}

/** Hours a fallen hero spends recovering, with an infirmary at `level` (0 for none). */
export function recoveryHours(level: number): number {
	if (level <= 0) {
		return RECOVERY_HOURS_WITHOUT_INFIRMARY;
	}

	return Math.max(RECOVERY_HOURS_MIN, RECOVERY_HOURS_INFIRMARY * RECOVERY_SPEEDUP ** (level - 1));
}

export function heroHealth(
	hero: HeroSave,
	now: number,
	buildings: Record<string, VillageBuilding> = {},
): number {
	const expedition = hero.expedition;
	const fate = heroFate(hero, buildings);

	if (!expedition || !fate || now < expedition.endsAt) {
		return _healed(hero.health, hero.at, now);
	}

	if (fate.fell) {
		// No health while in the infirmary; then home with a little, healing on.
		return now < fate.recoveredAt ? 0 : _healed(HERO_REVIVE_HEALTH, fate.recoveredAt, now);
	}

	// Back alive: heal until the return, take the wounds, then heal on from there.
	const onReturn = _healed(hero.health, hero.at, expedition.endsAt) - expedition.damage!;

	return _healed(onReturn, expedition.endsAt, now);
}

export function heroStatus(
	hero: HeroSave,
	now: number,
	buildings: Record<string, VillageBuilding> = {},
): HeroStatus {
	const expedition = hero.expedition;

	if (!expedition) {
		return 'home';
	}

	if (expedition.endsAt > now) {
		return 'away';
	}

	const fate = heroFate(hero, buildings);

	if (fate?.fell) {
		// Out of the infirmary the trip is over: its loot was lost with the fall.
		return now < fate.recoveredAt ? 'infirmary' : 'home';
	}

	return 'back';
}

/** Why the hero cannot go into a dungeon now, as a reason key, or null when they can. */
export function cannotGo(
	hero: HeroSave,
	dungeon: Dungeon,
	now: number,
	buildings: Record<string, VillageBuilding> = {},
): 'busy' | 'infirmary' | 'weak' | null {
	const status = heroStatus(hero, now, buildings);

	if (status === 'infirmary') {
		return 'infirmary';
	}

	if (status !== 'home') {
		return 'busy';
	}

	return heroHealth(hero, now, buildings) <= dungeon.damage[0] ? 'weak' : null;
}

/**
 * Chance, 0–1, that the hero falls if they set out now: the share of possible wounds at least as
 * deep as the health they will have on return (they heal on the way).
 */
export function deathChance(
	hero: HeroSave,
	dungeon: Dungeon,
	now: number,
	buildings: Record<string, VillageBuilding> = {},
): number {
	const [min, max] = dungeon.damage;
	const onReturn = Math.min(
		HERO_MAX_HEALTH,
		heroHealth(hero, now, buildings) + (HERO_HEAL_PER_HOUR * dungeon.minutes) / 60,
	);
	const deadly = max - Math.max(min, Math.ceil(onReturn)) + 1;

	return Math.max(0, Math.min(1, deadly / (max - min + 1)));
}

/** Rolls the wounds: a whole number between the dungeon's min and max. */
export function rollDamage(dungeon: Dungeon, random: () => number = Math.random): number {
	const [min, max] = dungeon.damage;

	return min + Math.floor(random() * (max - min + 1));
}

/** Rolls what the hero finds: each listed resource between its min and max, in tens. */
export function rollLoot(dungeon: Dungeon, random: () => number = Math.random): Partial<Amounts> {
	return Object.fromEntries(
		Object.entries(dungeon.loot).map(([id, [min, max]]) => [
			id,
			Math.round((min + random() * (max - min)) / 10) * 10,
		]),
	) as Partial<Amounts>;
}

function _healed(health: number, from: number, to: number): number {
	const hours = Math.max(0, to - from) / 3_600_000;

	return Math.min(HERO_MAX_HEALTH, health + HERO_HEAL_PER_HOUR * hours);
}
