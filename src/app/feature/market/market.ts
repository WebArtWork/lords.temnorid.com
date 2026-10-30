import { BuildingId, VillageBuilding } from '../building/building.interface';
import { levelAt } from '../building/building.timing';
import { Amounts, capacity } from '../economy/economy';
import { Point } from '../map/map-geometry';
import { ResourceId } from '../resource/resource.interface';
import { CITIES, GEO_KM_PER_TILE, WorldCity } from '../world/world.geography';

/**
 * Trade, in two kinds. The NPC merchants swap any resource for any other, but keep a cut, and
 * carry the goods from the nearest town. Other lords post offers on a shared board: the offered
 * goods leave the poster's stores when the offer is posted and wait with it, so a buyer can always
 * take what is listed. Goods never move at once: every trade takes the road between the two places.
 */

/** How fast merchants travel, so a trade's time follows the distance on the world map. */
export const TRADE_KM_PER_HOUR = 10;
/** Even a neighbour's cart takes this long. */
export const TRADE_MIN_SECONDS = 60;

/** Goods on the road to a lord's stores, saved in the lord's progress until they arrive. */
export interface Shipment {
	id: string;
	/** `npc`: carried by the town's merchants; `lord`: bought from another lord's offer. */
	kind: 'npc' | 'lord';
	/** The town's name (Ukrainian source text) or the selling lord's name. */
	source: string;
	resource: ResourceId;
	amount: number;
	/** Epoch milliseconds. */
	arriveAt: number;
}

/** Kilometres between two world tiles. */
export function tradeKm(from: Point, to: Point): number {
	return Math.hypot(from.x - to.x, from.y - to.y) * GEO_KM_PER_TILE;
}

/** Seconds merchants need to cover the road between two world tiles. */
export function travelSeconds(from: Point, to: Point): number {
	return Math.max(
		TRADE_MIN_SECONDS,
		Math.round((tradeKm(from, to) / TRADE_KM_PER_HOUR) * 3600),
	);
}

/** The town closest to a tile, where the NPC merchants set out from. */
export function nearestCity(at: Point): WorldCity {
	return CITIES.reduce((best, city) =>
		tradeKm(at, city) < tradeKm(at, best) ? city : best,
	);
}

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
	/** The poster's village on the world map; offers posted before this existed have none. */
	at?: Point;
	/** Set when bought: epoch milliseconds, the buyer's village, and the road between the two. */
	filledAt?: number;
	buyerAt?: Point;
	travelSeconds?: number;
}

/** When the payment for a bought offer reaches the poster, epoch milliseconds. */
export function paymentArrivesAt(offer: Offer): number {
	return (offer.filledAt ?? 0) + (offer.travelSeconds ?? 0) * 1000;
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

/** `stock` after handing `amount` of one resource to the merchants. */
export function ship(stock: Amounts, give: ResourceId, amount: number): Amounts {
	return { ...stock, [give]: stock[give] - amount };
}

/** A trade that cannot go ahead for a reason the lord can read; the message is a translation key. */
export class TradeError extends Error {}
