import { BuildingId, VillageBuilding } from '../building/building.interface';
import { levelAt } from '../building/building.timing';
import { Amounts, capacity } from '../economy/economy';
import { ResourceId } from '../resource/resource.interface';

/**
 * Trade, in two kinds. The NPC merchants swap any resource for any other at once, but keep a cut.
 * Other lords post offers on a shared board: the offered goods leave the poster's stores when the
 * offer is posted and wait with it, so a buyer can always take what is listed.
 */

const MARKET: BuildingId = 'marketplace';

/** What the NPC merchants give back per unit at marketplace level 1; each level adds a little. */
export const NPC_RATE_BASE = 0.5;
export const NPC_RATE_PER_LEVEL = 0.05;
export const NPC_RATE_MAX = 0.85;

/** Offers go no higher than this per side, which also keeps the rules' limit honest. */
export const OFFER_MAX_AMOUNT = 100_000;

/** A posted offer, stored in `lordsOffers/{id}`. */
export interface Offer {
	id: string;
	/** The lord who posted it. */
	uid: string;
	lordName: string;
	/** What the poster hands over, and what they ask for in return. */
	give: ResourceId;
	giveAmount: number;
	want: ResourceId;
	wantAmount: number;
	/** `open` until a buyer takes it, then `filled` until the poster collects the payment. */
	status: 'open' | 'filled';
	/** Epoch milliseconds; 0 until the server has stamped it. */
	createdAt: number;
}

/** The marketplace's level, 0 when none stands or it is still being raised. */
export function marketLevel(buildings: Record<string, VillageBuilding>, now: number): number {
	return Object.values(buildings)
		.filter((building) => building.type === MARKET)
		.reduce((sum, building) => sum + levelAt(building, now), 0);
}

/** How many open offers a lord may have at once: one per marketplace level. */
export function offerLimit(level: number): number {
	return level;
}

/** The share of goods the NPC merchants pay out at a marketplace level. */
export function npcRate(level: number): number {
	return Math.min(NPC_RATE_MAX, NPC_RATE_BASE + NPC_RATE_PER_LEVEL * level);
}

/** What `amount` of one resource fetches from the NPC merchants. */
export function npcReceive(amount: number, level: number): number {
	return Math.floor(amount * npcRate(level));
}

/** Why a trade cannot go ahead, or null when it can. Messages are translation keys. */
export function cannotTrade(
	stock: Amounts,
	buildings: Record<string, VillageBuilding>,
	now: number,
	give: ResourceId,
	giveAmount: number,
	want: ResourceId,
	receive: number,
): string | null {
	if (give === want) {
		return 'Оберіть різні ресурси.';
	}

	if (!Number.isInteger(giveAmount) || giveAmount < 1 || receive < 1) {
		return 'Вкажіть кількість більшу за нуль.';
	}

	if (giveAmount > stock[give]) {
		return 'Бракує ресурсів';
	}

	if (stock[want] + receive > capacity(buildings, now)[want]) {
		return 'У сховищі немає місця.';
	}

	return null;
}

/** `stock` after giving up `giveAmount` of one resource and gaining `receive` of another. */
export function swap(
	stock: Amounts,
	give: ResourceId,
	giveAmount: number,
	want: ResourceId,
	receive: number,
): Amounts {
	return { ...stock, [give]: stock[give] - giveAmount, [want]: stock[want] + receive };
}

/** A trade that cannot go ahead for a reason the lord can read; the message is a translation key. */
export class TradeError extends Error {}
