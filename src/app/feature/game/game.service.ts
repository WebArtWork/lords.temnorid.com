import { inject, Service, signal } from '@angular/core';
import { BUILDING_BY_ID } from '../building/building.data';
import { costAtLevel } from '../building/building.cost';
import { demolishBlocker, demolishRefund, demolishSeconds } from '../building/building.demolish';
import { BuildingId, Construction, VillageBuilding } from '../building/building.interface';
import {
	buildersBusyUntil,
	buildSeconds,
	hallLevel,
	isGone,
	levelAt,
	runningUpgrade,
} from '../building/building.timing';
import { DUNGEON_BY_ID, DungeonId } from '../dungeon/dungeon.data';
import { FactionId } from '../faction/faction.data';
import {
	cannotGo,
	HeroSave,
	heroHealth,
	heroStatus,
	newHero,
	rollDamage,
	rollLoot,
} from '../dungeon/hero';
import {
	Amounts,
	capacity,
	PLOT_COST,
	PLOT_MAX_LEVEL,
	shortfall,
	spend,
	startStock,
	StockSave,
	stockAt,
} from '../economy/economy';
import { ElementId } from '../element/element.interface';
import { FARM_LAYOUT, generateFarmPlots } from '../farm/farm.generator';
import { farmLand } from '../farm/farm.land';
import { FarmSave } from '../farm/farm.interface';
import { FirebaseService } from '../firebase/firebase.service';
import { createSeed, Point } from '../map/map-geometry';
import {
	cannotTrade,
	TradeError,
	marketLevel,
	npcReceive,
	Offer,
	OFFER_MAX_AMOUNT,
	swap,
} from '../market/market';
import { MarketService } from '../market/market.service';
import { ResourceId } from '../resource/resource.interface';
import { isOnboarded, LordsProgress, ProgressService } from '../progress/progress.service';
import { RegionId } from '../region/region.interface';
import { generateVillageSlots, VILLAGE_LAYOUT } from '../village/village.generator';
import { WorldService } from '../world/world.service';
import { VillageSave } from '../village/village.interface';

/** Everything the in-game pages need about the signed-in lord. */
export interface GameState {
	uid: string;
	lordName: string;
	element: ElementId;
	region: RegionId;
	village: VillageSave;
	farm: FarmSave;
	stock: StockSave;
	hero: HeroSave;
	faction: FactionId | null;
}

/**
 * Loads the lord's save for the in-game pages and founds their maps on first visit. Kept for the
 * session, so moving between the village and the farm does not read Firestore again.
 */
@Service()
export class GameService {
	private readonly _firebase = inject(FirebaseService);
	private readonly _progress = inject(ProgressService);
	private readonly _world = inject(WorldService);
	private readonly _market = inject(MarketService);
	private _cache: GameState | null = null;
	/** The load in flight, shared so the top bar and a page never found the maps twice. */
	private _loading: Promise<GameState | null> | null = null;

	/** The last loaded game, for chrome such as the top bar that only shows it. */
	readonly game = signal<GameState | null>(null);

	/** The lord's game, or null when they are signed out or have not finished onboarding. */
	load(): Promise<GameState | null> {
		this._loading ??= this._load().finally(() => (this._loading = null));

		return this._loading;
	}

	private async _load(): Promise<GameState | null> {
		const user = await this._firebase.whenReady();

		if (!user) {
			return null;
		}

		if (this._cache?.uid === user.uid) {
			return this._cache;
		}

		const progress = await this._progress.load(user.uid);

		if (!progress || !isOnboarded(progress)) {
			return null;
		}

		const element = progress.firstLocation!.element!;
		const region = progress.firstLocation!.region!;
		const lord = { uid: user.uid, lordName: progress.lord!.name!, element, region };
		// The village takes its place on the world map before its farm is laid out, so the farm
		// can follow the land round it.
		const at = progress.farm?.at ?? (await this._worldTile(lord));
		const maps = this._missingMaps(progress, element, region, at);

		// A farm laid out before it knew its land learns where it stands, once.
		if (progress.farm && !progress.farm.at && at) {
			maps.farm = { ...progress.farm, at };
		}

		if (maps.village || maps.farm) {
			await this._progress.setMaps(user.uid, maps);
		}

		// Lords founded before stores existed start with the same stock as new ones.
		const stock = progress.stock ?? startStock(Date.now());

		if (!progress.stock) {
			await this._progress.setStock(user.uid, stock);
		}

		// Every lord has a hero from the start, as in Travian.
		const hero = progress.hero ?? newHero(Date.now());

		if (!progress.hero) {
			await this._progress.setHero(user.uid, hero);
		}

		this._cache = {
			uid: user.uid,
			lordName: progress.lord!.name!,
			element,
			region,
			village: progress.village ?? maps.village!,
			farm: maps.farm ?? progress.farm!,
			stock,
			hero,
			faction: progress.faction ?? null,
		};

		this.game.set(this._cache);

		return this._cache;
	}

	/** The stores right now, with the farm's production since the last save. */
	stockNow(game: GameState, now: number): Amounts {
		return stockAt(
			game.stock,
			game.farm.plots,
			game.farm.levels ?? {},
			game.village.buildings ?? {},
			now,
		);
	}

	/** Starts raising a building on a free village place. Level 1 is ready once its time runs out. */
	async build(slot: number, type: BuildingId): Promise<void> {
		const there = this._cache?.village.buildings?.[slot];

		if (there && !isGone(there, Date.now())) {
			throw new Error('Something already stands on this place.');
		}

		await this._construct(slot, { type, level: 0 });
	}

	/** Starts raising a standing building to its next level. */
	async upgrade(slot: number): Promise<void> {
		const building = this._cache?.village.buildings?.[slot];

		if (!building || isGone(building, Date.now())) {
			throw new Error('Nothing stands on this place.');
		}

		if (runningUpgrade(building, Date.now())) {
			throw new Error('This building is already being raised.');
		}

		await this._construct(slot, { type: building.type, level: levelAt(building, Date.now()) });
	}

	/**
	 * Starts taking a building down to level `to` (0 tears it down). It takes a builder, half the
	 * time each level took to raise, and half of what those levels cost comes back at once.
	 */
	async demolish(slot: number, to: number): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const buildings = game.village.buildings ?? {};
		const building = buildings[slot];
		const blocker = demolishBlocker(buildings, String(slot), to, now, game.farm.levels ?? {});

		if (!building || blocker) {
			throw new Error(blocker || 'Nothing stands on this place.');
		}

		const type = BUILDING_BY_ID[building.type];
		const level = levelAt(building, now);
		const refund = demolishRefund(type.cost, level, to);
		const seconds = demolishSeconds(type, level, to, hallLevel(buildings, now));
		// The stores are counted before the work starts, and the refund may pass their capacity.
		const amounts = { ...this.stockNow(game, now) };

		for (const [id, amount] of Object.entries(refund)) {
			amounts[id as ResourceId] += amount;
		}

		const stock: StockSave = { amounts, at: now };
		const working: VillageBuilding = {
			type: building.type,
			level,
			upgrade: { level: to, startedAt: now, endsAt: now + seconds * 1000, down: true },
		};

		await this._progress.setDemolished(game.uid, slot, working, stock);
		this._update({
			...game,
			stock,
			village: { ...game.village, buildings: { ...buildings, [slot]: working } },
		});
	}

	/** Starts working a farm plot up to its next level. */
	async upgradePlot(plot: number): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const current = game.farm.levels?.[plot];
		const level = current ? levelAt(current, now) : 0;

		if (current && runningUpgrade(current, now)) {
			throw new Error('This plot is already being worked.');
		}

		if (level >= PLOT_MAX_LEVEL) {
			throw new Error('The plot is at its highest level.');
		}

		const { construction, stock } = this._startWork(
			game,
			now,
			level,
			costAtLevel(PLOT_COST, level + 1),
			buildSeconds(
				{ cost: PLOT_COST },
				level + 1,
				hallLevel(game.village.buildings ?? {}, now),
			),
		);

		await this._progress.setPlot(game.uid, plot, construction, stock);
		this._update({
			...game,
			stock,
			farm: { ...game.farm, levels: { ...game.farm.levels, [plot]: construction } },
		});
	}

	/** Puts the next level of a building under construction, paid and timed as in Travian. */
	private async _construct(slot: number, from: VillageBuilding): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const type = BUILDING_BY_ID[from.type];
		const { construction, stock } = this._startWork(
			game,
			now,
			from.level,
			costAtLevel(type.cost, from.level + 1),
			buildSeconds(type, from.level + 1, hallLevel(game.village.buildings ?? {}, now)),
		);
		const building: VillageBuilding = { ...construction, type: from.type };

		await this._progress.setBuilding(game.uid, slot, building, stock);
		this._update({
			...game,
			stock,
			village: {
				...game.village,
				buildings: { ...game.village.buildings, [slot]: building },
			},
		});
	}

	/**
	 * Checks the builders are free and the stores can pay, then returns the started work and the
	 * stores after paying. A village has BUILDERS builders, shared by buildings and plots.
	 */
	private _startWork(
		game: GameState,
		now: number,
		level: number,
		cost: Partial<Amounts>,
		seconds: number,
	): { construction: Construction; stock: StockSave } {
		if (buildersBusyUntil(game.village.buildings ?? {}, now, game.farm.levels ?? {})) {
			throw new Error('The builders are busy.');
		}

		const available = this.stockNow(game, now);

		if (Object.keys(shortfall(available, cost)).length) {
			throw new Error('Not enough resources.');
		}

		return {
			construction: {
				level,
				upgrade: { level: level + 1, startedAt: now, endsAt: now + seconds * 1000, down: false },
			},
			stock: { amounts: spend(available, cost), at: now },
		};
	}

	private _requireGame(): GameState {
		if (!this._cache) {
			throw new Error('No game loaded.');
		}

		return this._cache;
	}

	private _update(game: GameState) {
		this._cache = game;
		this.game.set(game);
	}

	/** Sends the hero into a dungeon. The loot is rolled now and collected on return. */
	async sendHero(id: DungeonId): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const dungeon = DUNGEON_BY_ID[id];

		const buildings = game.village.buildings ?? {};

		if (cannotGo(game.hero, dungeon, now, buildings)) {
			throw new Error('The hero cannot go.');
		}

		const hero: HeroSave = {
			// The wounds are taken when the hero is back (see heroHealth), not now.
			health: heroHealth(game.hero, now, buildings),
			at: now,
			expedition: {
				dungeon: id,
				startedAt: now,
				endsAt: now + dungeon.minutes * 60_000,
				loot: rollLoot(dungeon),
				damage: rollDamage(dungeon),
			},
		};

		await this._progress.setHero(game.uid, hero);
		this._update({ ...game, hero });
	}

	/** Puts what the returned hero carried into the stores, up to their capacity. */
	async collectLoot(): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const expedition = game.hero.expedition;

		const buildings = game.village.buildings ?? {};

		if (!expedition || heroStatus(game.hero, now, buildings) !== 'back') {
			throw new Error('The hero has nothing to hand over.');
		}

		const cap = capacity(game.village.buildings ?? {}, now);
		const available = this.stockNow(game, now);
		const amounts = Object.fromEntries(
			Object.entries(available).map(([id, amount]) => {
				const gained = expedition.loot[id as keyof Amounts] ?? 0;

				return [id, Math.max(amount, Math.min(cap[id as keyof Amounts], amount + gained))];
			}),
		) as Amounts;
		const stock: StockSave = { amounts, at: now };
		const hero: HeroSave = {
			health: heroHealth(game.hero, now, buildings),
			at: now,
			expedition: null,
		};

		await this._progress.setHero(game.uid, hero, stock);
		this._update({ ...game, hero, stock });
	}

	/** Swaps goods with the NPC merchants at once, at the rate the marketplace level earns. */
	async exchange(give: ResourceId, giveAmount: number, want: ResourceId): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const buildings = game.village.buildings ?? {};
		const receive = npcReceive(giveAmount, marketLevel(buildings, now));
		const available = this.stockNow(game, now);
		const reason = cannotTrade(available, buildings, now, give, giveAmount, want, receive);

		if (reason) {
			throw new TradeError(reason);
		}

		const stock: StockSave = { amounts: swap(available, give, giveAmount, want, receive), at: now };

		await this._progress.setStock(game.uid, stock);
		this._update({ ...game, stock });
	}

	/** Lists an offer on the board; the goods leave the stores until it is bought or cancelled. */
	async postOffer(
		give: ResourceId,
		giveAmount: number,
		want: ResourceId,
		wantAmount: number,
	): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const available = this.stockNow(game, now);

		if (give === want || !this._validAmount(giveAmount) || !this._validAmount(wantAmount)) {
			throw new TradeError('Пропозиція недійсна.');
		}

		if (giveAmount > available[give]) {
			throw new TradeError('Бракує ресурсів');
		}

		const stock: StockSave = {
			amounts: { ...available, [give]: available[give] - giveAmount },
			at: now,
		};

		await this._market.post(
			{ uid: game.uid, lordName: game.lordName, give, giveAmount, want, wantAmount },
			stock,
		);
		this._update({ ...game, stock });
	}

	/** Takes an unsold offer back; its goods return to the stores even past their capacity. */
	async cancelOffer(offer: Offer): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const stock = this._credited(game, now, offer.give, offer.giveAmount);

		await this._market.cancel(game.uid, offer.id, stock);
		this._update({ ...game, stock });
	}

	/** Buys another lord's offer: pays what they ask and receives what they listed. */
	async buyOffer(offer: Offer): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		let stock = null as StockSave | null;

		await this._market.accept(game.uid, game.lordName, offer.id, (listed) => {
			const available = this.stockNow(game, now);
			const reason = cannotTrade(
				available,
				game.village.buildings ?? {},
				now,
				listed.want,
				listed.wantAmount,
				listed.give,
				listed.giveAmount,
			);

			if (reason) {
				throw new TradeError(reason);
			}

			stock = {
				amounts: swap(available, listed.want, listed.wantAmount, listed.give, listed.giveAmount),
				at: now,
			};

			return stock;
		});

		if (stock) {
			this._update({ ...game, stock });
		}
	}

	/** Collects what a buyer paid for the lord's offer. */
	async collectOffer(offer: Offer): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		let stock = null as StockSave | null;

		await this._market.collect(game.uid, offer.id, (filled) => {
			stock = this._credited(game, now, filled.want, filled.wantAmount);

			return stock;
		});

		if (stock) {
			this._update({ ...game, stock });
		}
	}

	private _validAmount(amount: number) {
		return Number.isInteger(amount) && amount >= 1 && amount <= OFFER_MAX_AMOUNT;
	}

	/** The stores with `amount` of a resource added, not held back by capacity so nothing is lost. */
	private _credited(game: GameState, now: number, id: ResourceId, amount: number): StockSave {
		const available = this.stockNow(game, now);

		return { amounts: { ...available, [id]: available[id] + amount }, at: now };
	}

	/** Joins a faction; a lord can change sides at any time for now. */
	async chooseFaction(faction: FactionId): Promise<void> {
		const game = this._requireGame();

		await this._progress.setFaction(game.uid, faction);
		this._update({ ...game, faction });
	}

	async leaveFaction(): Promise<void> {
		const game = this._requireGame();

		await this._progress.setFaction(game.uid, null);
		this._update({ ...game, faction: null });
	}

	async signOut() {
		this._cache = null;
		this._loading = null;
		this.game.set(null);
		await this._firebase.signOut();
	}

	/** Generates whichever maps this lord does not have yet. */
	/**
	 * The village's tile on the world map, settling it there if needed. Null when the world cannot
	 * be reached: the farm then leans on the region, and learns its land on a later load.
	 */
	private async _worldTile(lord: Pick<GameState, 'uid' | 'lordName' | 'element' | 'region'>) {
		try {
			const { x, y } = await this._world.settle(lord);

			return { x, y };
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	private _missingMaps(
		progress: LordsProgress,
		element: ElementId,
		region: RegionId,
		at: Point | null,
	) {
		const maps: Pick<LordsProgress, 'village' | 'farm'> = {};

		if (!progress.village) {
			const seed = createSeed();

			maps.village = { seed, layout: VILLAGE_LAYOUT, slots: generateVillageSlots(seed) };
		}

		if (!progress.farm) {
			const seed = createSeed();

			maps.farm = {
				seed,
				layout: FARM_LAYOUT,
				plots: generateFarmPlots(seed, element, region, at ? farmLand(at) : null),
				// Firestore refuses undefined fields, so `at` is only set when known.
				...(at ? { at } : {}),
			};
		}

		return maps;
	}
}
