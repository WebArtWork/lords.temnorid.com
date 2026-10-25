import { DestroyRef, inject, signal } from '@angular/core';
import { BuildingType, Construction, VillageBuilding } from './building.interface';

/**
 * Construction takes time, as in Travian. Level 1 of the smallest building takes MIN_BUILD_SECONDS;
 * bigger buildings take longer in proportion to what they cost, and every level takes TIME_GROWTH
 * times longer than the one before. Each level of the lord's hall speeds all building up a little.
 */
export const MIN_BUILD_SECONDS = 120;
/** Seconds of work per resource unit of a level 1 cost. */
const SECONDS_PER_COST = 0.6;
export const TIME_GROWTH = 1.3;
/** Each lord's hall level past the first takes this share off every build. */
const HALL_SPEEDUP = 0.04;

/** How long raising `type` to `level` takes, in seconds, with a lord's hall at `hallLevel`. */
export function buildSeconds(
	type: Pick<BuildingType, 'cost'>,
	level: number,
	hallLevel: number,
): number {
	const size = Object.values(type.cost).reduce((sum, amount) => sum + (amount ?? 0), 0);
	const base = Math.max(MIN_BUILD_SECONDS, size * SECONDS_PER_COST);
	const speedup = Math.max(0.5, 1 - HALL_SPEEDUP * Math.max(0, hallLevel - 1));

	return Math.round(Math.max(MIN_BUILD_SECONDS, base * TIME_GROWTH ** (level - 1) * speedup));
}

/** The level a building has reached by `now`: a finished upgrade counts, a running one does not. */
export function levelAt(building: Construction, now: number): number {
	return building.upgrade && building.upgrade.endsAt <= now
		? building.upgrade.level
		: building.level;
}

/** The upgrade still running at `now`, if any. */
export function runningUpgrade(building: Construction, now: number) {
	return building.upgrade && building.upgrade.endsAt > now ? building.upgrade : null;
}

/** The lord's hall level by `now`, 0 when there is none. */
export function hallLevel(buildings: Record<string, VillageBuilding>, now: number): number {
	const hall = Object.values(buildings).find((building) => building.type === 'lords-hall');

	return hall ? levelAt(hall, now) : 0;
}

/**
 * When the village's builders are free again. Like Travian, a village raises one thing at a time,
 * building or farm plot alike; null when nothing is being built.
 */
export function buildersBusyUntil(
	buildings: Record<string, Construction>,
	now: number,
	plots: Record<string, Construction> = {},
): number | null {
	const ends = [...Object.values(buildings), ...Object.values(plots)]
		.map((building) => runningUpgrade(building, now)?.endsAt ?? 0)
		.filter((endsAt) => endsAt > now);

	return ends.length ? Math.max(...ends) : null;
}

/** `1:05:09` or `4:09`: a countdown as people read clocks. */
export function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.ceil(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (value: number) => String(value).padStart(2, '0');

	return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A clock that ticks every second while the calling component lives. Call in an injection context. */
export function nowSignal() {
	const now = signal(Date.now());
	const timer = setInterval(() => now.set(Date.now()), 1000);

	inject(DestroyRef).onDestroy(() => clearInterval(timer));

	return now.asReadonly();
}
