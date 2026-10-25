import { Amounts } from '../economy/economy';
import { Dungeon, DungeonId } from './dungeon.data';

/**
 * The lord's hero, who goes into dungeons for loot as in Travian's adventures. The hero loses
 * health on each trip and heals over time; the loot is decided when the hero sets out and
 * collected once they are back.
 */
export const HERO_MAX_HEALTH = 100;
/** Health the hero recovers each hour, at home or away. */
export const HERO_HEAL_PER_HOUR = 10;

export interface HeroExpedition {
	dungeon: DungeonId;
	/** Epoch milliseconds. */
	startedAt: number;
	endsAt: number;
	/** What the hero will bring back. */
	loot: Partial<Amounts>;
}

/** Saved in LordsProgress.hero. */
export interface HeroSave {
	/** Health at `at`. */
	health: number;
	at: number;
	/** The current or last trip; cleared once its loot is collected. */
	expedition?: HeroExpedition | null;
}

export type HeroStatus = 'home' | 'away' | 'back';

export function newHero(now: number): HeroSave {
	return { health: HERO_MAX_HEALTH, at: now };
}

export function heroHealth(hero: HeroSave, now: number): number {
	const hours = Math.max(0, now - hero.at) / 3_600_000;

	return Math.min(HERO_MAX_HEALTH, hero.health + HERO_HEAL_PER_HOUR * hours);
}

export function heroStatus(hero: HeroSave, now: number): HeroStatus {
	if (!hero.expedition) {
		return 'home';
	}

	return hero.expedition.endsAt > now ? 'away' : 'back';
}

/** Why the hero cannot go into a dungeon now, as a reason key, or null when they can. */
export function cannotGo(hero: HeroSave, dungeon: Dungeon, now: number): 'busy' | 'weak' | null {
	if (heroStatus(hero, now) !== 'home') {
		return 'busy';
	}

	return heroHealth(hero, now) <= dungeon.damage ? 'weak' : null;
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
