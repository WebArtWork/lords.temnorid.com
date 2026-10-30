import { costAtLevel } from '../building/building.cost';
import { BuildingId, Construction, VillageBuilding } from '../building/building.interface';
import { levelAt } from '../building/building.timing';
import { FarmPlot } from '../farm/farm.interface';
import { RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';

/**
 * The lord's stores, modelled on Travian. A lord starts with START_STOCK of each resource. Every
 * farm plot yields its resource each hour, more at higher levels. Stores fill up to a cap that the
 * warehouse (wood, stone, iron, clay), granary (grain) and well (water) raise.
 *
 * Nothing ticks on a server: the save keeps the amounts at one moment, and the stock at any later
 * moment is worked out from production since then. Spending saves a new moment.
 */
export type Amounts = Record<ResourceId, number>;

/** Saved in LordsProgress.stock. */
export interface StockSave {
	amounts: Amounts;
	/** Epoch milliseconds the amounts were true at. */
	at: number;
}

export const START_STOCK = 750;
/** Each resource holds this much with no store built. */
export const BASE_CAPACITY = 800;
/** Each level of a resource's store adds this much room. */
export const CAPACITY_PER_LEVEL = 400;

/** What level 1 of a farm plot costs; later levels grow as buildings do. Kept cheap to start. */
export const PLOT_COST: Partial<Amounts> = { wood: 20, stone: 20, clay: 20, grain: 10 };

/** Hourly yield of one plot by level, as Travian's resource fields. */
export const PLOT_PRODUCTION = [2, 5, 9, 15, 22, 33, 50, 70, 100, 145, 200];
/** Past the table, each level yields this much more than the one before. Plots never stop growing. */
export const PLOT_GROWTH = 1.25;

/**
 * What the next plot of a resource costs, given how many extra ones were bought of it: the first
 * costs what working a plot up to level 10 does, the second level 20, the third level 30, and so on.
 * Costly on purpose, so nobody buys many, though anyone can.
 */
export function newPlotCost(bought: number): Partial<Amounts> {
	return costAtLevel(PLOT_COST, 10 * (bought + 1));
}

/** Which store holds each resource. */
const STORE: Record<ResourceId, BuildingId> = {
	wood: 'warehouse',
	stone: 'warehouse',
	iron: 'warehouse',
	clay: 'warehouse',
	grain: 'granary',
	water: 'well',
};

export function startStock(now: number): StockSave {
	return {
		amounts: Object.fromEntries(RESOURCES.map((r) => [r.id, START_STOCK])) as Amounts,
		at: now,
	};
}

/** What one plot yields per hour at a level. */
export function plotProduction(level: number): number {
	const last = PLOT_PRODUCTION.length - 1;
	const known = PLOT_PRODUCTION[Math.max(0, Math.min(last, level))]!;

	return level > last ? Math.round(known * PLOT_GROWTH ** (level - last)) : known;
}

/** Hourly yield of the whole farm by `now`, per resource. */
export function productionPerHour(
	plots: FarmPlot[],
	plotLevels: Record<string, Construction>,
	now: number,
): Amounts {
	const perHour = Object.fromEntries(RESOURCES.map((r) => [r.id, 0])) as Amounts;

	for (const plot of plots) {
		const saved = plotLevels[plot.id];

		perHour[plot.resource] += plotProduction(saved ? levelAt(saved, now) : 0);
	}

	return perHour;
}

/** How much of each resource the stores hold at most by `now`. */
export function capacity(buildings: Record<string, VillageBuilding>, now: number): Amounts {
	const levels: Partial<Record<BuildingId, number>> = {};

	for (const building of Object.values(buildings)) {
		levels[building.type] = (levels[building.type] ?? 0) + levelAt(building, now);
	}

	return Object.fromEntries(
		RESOURCES.map((r) => [
			r.id,
			BASE_CAPACITY + CAPACITY_PER_LEVEL * (levels[STORE[r.id]] ?? 0),
		]),
	) as Amounts;
}

/**
 * The stock at `now`: the saved amounts plus what the farm made since, never above the stores'
 * capacity. Production and capacity are taken as they stand at `now`, which is close enough while
 * upgrades are short.
 */
export function stockAt(
	stock: StockSave,
	plots: FarmPlot[],
	plotLevels: Record<string, Construction>,
	buildings: Record<string, VillageBuilding>,
	now: number,
): Amounts {
	const hours = Math.max(0, now - stock.at) / 3_600_000;
	const perHour = productionPerHour(plots, plotLevels, now);
	const cap = capacity(buildings, now);

	return Object.fromEntries(
		RESOURCES.map((r) => {
			const saved = stock.amounts[r.id] ?? 0;
			// What is already over the cap (from a store torn down, say) is kept, just not added to.
			const grown = Math.min(Math.max(saved, cap[r.id]), saved + perHour[r.id] * hours);

			return [r.id, grown];
		}),
	) as Amounts;
}

/** The resources a cost still lacks, as amounts missing; empty when it is affordable. */
export function shortfall(stock: Amounts, cost: Partial<Amounts>): Partial<Amounts> {
	return Object.fromEntries(
		Object.entries(cost)
			.map(([id, amount]) => [id, Math.ceil((amount ?? 0) - stock[id as ResourceId])])
			.filter(([, missing]) => (missing as number) > 0),
	) as Partial<Amounts>;
}

/** `stock` with `cost` taken out. */
export function spend(stock: Amounts, cost: Partial<Amounts>): Amounts {
	return Object.fromEntries(
		RESOURCES.map((r) => [r.id, stock[r.id] - (cost[r.id] ?? 0)]),
	) as Amounts;
}
