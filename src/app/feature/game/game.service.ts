import { inject, Service, signal } from '@angular/core';
import { BUILDING_BY_ID } from '../building/building.data';
import { costAtLevel } from '../building/building.cost';
import { demolishBlocker, demolishRefund, demolishSeconds } from '../building/building.demolish';
import {
	BuildingId,
	Construction,
	VillageBuilding,
	WALL_PLACE,
} from '../building/building.interface';
import {
	buildersBusyUntil,
	buildSeconds,
	hallLevel,
	isGone,
	levelAt,
	raised,
	runningUpgrade,
	targetLevel,
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
	newPlotCost,
	PLOT_COST,
	shortfall,
	spend,
	startStock,
	StockSave,
	stockAt,
} from '../economy/economy';
import { ElementId } from '../element/element.interface';
import { FARM_LAYOUT, generateFarmPlots, patchPlots } from '../farm/farm.generator';
import { farmLand } from '../farm/farm.land';
import { FarmPlot, FarmSave } from '../farm/farm.interface';
import { FirebaseService } from '../firebase/firebase.service';
import { createSeed, Point } from '../map/map-geometry';
import {
	cannotTrade,
	TradeError,
	marketLevel,
	npcReceive,
	nearestCity,
	Offer,
	OFFER_MAX_AMOUNT,
	Shipment,
	ship,
	travelSeconds,
} from '../market/market';
import { MarketService } from '../market/market.service';
import { ResourceId } from '../resource/resource.interface';
import { isOnboarded, LordsProgress, ProgressService } from '../progress/progress.service';
import { RegionId } from '../region/region.interface';
import { VillageSlot } from '../village/village.interface';
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
	/** Goods on the road to the stores; they are credited when they arrive. */
	shipments: Shipment[];
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
	private _shipmentTimer: ReturnType<typeof setTimeout> | undefined;

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

		// A wall raised on an ordinary place before it had its own moves out to it, once.
		let village = progress.village ?? maps.village!;
		const wallAt = Object.entries(village.buildings ?? {}).find(
			([place, building]) => building.type === 'wall' && place !== String(WALL_PLACE),
		);

		if (wallAt && !village.buildings?.[WALL_PLACE]) {
			const { [wallAt[0]]: wall, ...rest } = village.buildings!;

			village = { ...village, buildings: { ...rest, [WALL_PLACE]: wall! } };
			await this._progress.moveWall(user.uid, wallAt[0], String(WALL_PLACE), wall!);
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
			village,
			farm: maps.farm ?? progress.farm!,
			stock,
			hero,
			faction: progress.faction ?? null,
				shipments: progress.shipments ?? [],
		};

		this._update(this._cache);

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

	/** Adds the next level to a standing building's work; a running upgrade just gets longer. */
	async upgrade(slot: number): Promise<void> {
		const building = this._cache?.village.buildings?.[slot];

		if (!building || isGone(building, Date.now())) {
			throw new Error('Nothing stands on this place.');
		}

		await this._construct(slot, building);
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
			queue: [],
			upgrade: { level: to, startedAt: now, endsAt: now + seconds * 1000, down: true },
		};

		await this._progress.setDemolished(game.uid, slot, working, stock);
		this._update({
			...game,
			stock,
			village: { ...game.village, buildings: { ...buildings, [slot]: working } },
		});
	}

	/** Adds the next level to a farm plot's work; a running upgrade just gets longer. */
	async upgradePlot(plot: number): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const current = game.farm.levels?.[plot] ?? { level: 0 };
		const hall = hallLevel(game.village.buildings ?? {}, now);

		const { construction, stock } = this._startWork(
			game,
			now,
			current,
			(level) => costAtLevel(PLOT_COST, level),
			(level) => buildSeconds({ cost: PLOT_COST }, level, hall),
		);

		await this._progress.setPlot(game.uid, plot, construction, stock);
		this._update({
			...game,
			stock,
			farm: { ...game.farm, levels: { ...game.farm.levels, [plot]: construction } },
		});
	}

	/** Buys one more place to build in the village, paid at once. Each one costs more than the last. */
	async buyVillagePlace(): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const bought = game.village.slots.filter((slot) => slot.extra).length;
		const cost = newPlotCost(bought);
		const available = this.stockNow(game, now);

		if (Object.keys(shortfall(available, cost)).length) {
			throw new Error('Not enough resources.');
		}

		const stock: StockSave = { amounts: spend(available, cost), at: now };
		// The spot is drawn from the seed each time the village is shown, so only the id matters here.
		const slots: VillageSlot[] = [
			...game.village.slots,
			{ id: Math.max(0, ...game.village.slots.map((slot) => slot.id)) + 1, x: 0, y: 0, extra: true },
		];

		await this._progress.setVillageSlots(game.uid, slots, stock);
		this._update({ ...game, stock, village: { ...game.village, slots } });
	}

	/** Adds a plot of a resource to the farm, paid at once. Each extra plot of a resource costs more. */
	async buyPlot(resource: ResourceId, patch = 0): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const cost = newPlotCost(patchPlots(game.farm.plots, resource, patch).length);
		const available = this.stockNow(game, now);

		if (Object.keys(shortfall(available, cost)).length) {
			throw new Error('Not enough resources.');
		}

		const stock: StockSave = { amounts: spend(available, cost), at: now };
		// The spot is drawn from the seed each time the farm is shown, so only the id matters here.
		const plots: FarmPlot[] = [
			...game.farm.plots,
			{ id: Math.max(0, ...game.farm.plots.map((p) => p.id)) + 1, resource, x: 0, y: 0, extra: true, patch },
		];

		await this._progress.setFarmPlots(game.uid, plots, stock);
		this._update({ ...game, stock, farm: { ...game.farm, plots } });
	}

	/** Puts the next level of a building under construction, paid and timed as in Travian. */
	private async _construct(slot: number, from: VillageBuilding): Promise<void> {
		const game = this._requireGame();
		const now = Date.now();
		const type = BUILDING_BY_ID[from.type];
		const hall = hallLevel(game.village.buildings ?? {}, now);
		const { construction, stock } = this._startWork(
			game,
			now,
			from,
			(level) => costAtLevel(type.cost, level),
			(level) => buildSeconds(type, level, hall),
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
	 * Adds one more level to `current`, paid at once. Work already running carries on with the same
	 * builder, so the new level only waits its turn; otherwise a builder must be free. A village has
	 * BUILDERS builders, shared by buildings and plots. Returns the new work and the stores after
	 * paying.
	 */
	private _startWork(
		game: GameState,
		now: number,
		current: Construction,
		cost: (level: number) => Partial<Amounts>,
		seconds: (level: number) => number,
	): { construction: Construction; stock: StockSave } {
		const running = runningUpgrade(current, now);

		if (running?.down) {
			throw new Error('This building is being taken down.');
		}

		if (!running && buildersBusyUntil(game.village.buildings ?? {}, now, game.farm.levels ?? {})) {
			throw new Error('The builders are busy.');
		}

		const level = targetLevel(current, now) + 1;
		const price = cost(level);
		const available = this.stockNow(game, now);

		if (Object.keys(shortfall(available, price)).length) {
			throw new Error('Not enough resources.');
		}

		return {
			construction: raised(current, seconds(level), now),
			stock: { amounts: spend(available, price), at: now },
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
		this._watchShipments();
	}

	/** Credits whatever shipments have arrived, and wakes up again for the next one. */
	private _watchShipments() {
		clearTimeout(this._shipmentTimer);

		const game = this._cache;

		if (!game?.shipments.length || typeof window === 'undefined') {
			return;
		}

		const next = Math.min(...game.shipments.map((shipment) => shipment.arriveAt));

		this._shipmentTimer = setTimeout(
			() => this.receiveShipments().catch((error) => console.error(error)),
			Math.max(0, next - Date.now()) + 50,
		);
	}

	/** Puts the shipments that have arrived into the stores, even past their capacity. */
	async receiveShipments(): Promise<void> {
		const game = this._cache;
		const now = Date.now();
		const arrived = game?.shipments.filter((shipment) => shipment.arriveAt <= now) ?? [];

		if (!game || !arrived.length) {
			this._watchShipments();

			return;
		}

		const available = this.stockNow(game, now);

		for (const shipment of arrived) {
			available[shipment.resource] += shipment.amount;
		}

		const stock: StockSave = { amounts: available, at: now };
		const shipments = game.shipments.filter((shipment) => shipment.arriveAt > now);

		await this._progress.setShipments(game.uid, stock, shipments);
		this._update({ ...this._requireGame(), stock, shipments });
	}

	/** The village's tile on the world map; Kamianets stands in until the farm has learned it. */
	villageAt(game: GameState): Point {
		return game.farm.at ?? { x: 0, y: 0 };
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

	/**
	 * Sells goods to the NPC merchants of the nearest town, at the rate the marketplace level
	 * earns. The goods leave now; what they fetch arrives once the merchants are back.
	 */
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

		const city = nearestCity(this.villageAt(game));
		const seconds = travelSeconds(this.villageAt(game), city);
		const stock: StockSave = { amounts: ship(available, give, giveAmount), at: now };
		const shipments: Shipment[] = [
			...game.shipments,
			{
				id: crypto.randomUUID(),
				kind: 'npc',
				source: city.name,
				resource: want,
				amount: receive,
				arriveAt: now + seconds * 1000,
			},
		];

		await this._progress.setShipments(game.uid, stock, shipments);
		this._update({ ...game, stock, shipments });
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
			{
				uid: game.uid,
				lordName: game.lordName,
				give,
				giveAmount,
				want,
				wantAmount,
				at: this.villageAt(game),
			},
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

		let shipments = game.shipments;

		await this._market.accept(game.uid, game.lordName, this.villageAt(game), offer.id, (listed, seconds) => {
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

			stock = { amounts: ship(available, listed.want, listed.wantAmount), at: now };
			shipments = [
				...game.shipments,
				{
					id: crypto.randomUUID(),
					kind: 'lord',
					source: listed.lordName,
					resource: listed.give,
					amount: listed.giveAmount,
					arriveAt: now + seconds * 1000,
				},
			];

			return { stock, shipments };
		});

		if (stock) {
			this._update({ ...game, stock, shipments });
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
		clearTimeout(this._shipmentTimer);
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
