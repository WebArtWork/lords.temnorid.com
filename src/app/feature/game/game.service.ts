import { computed, inject, Service, signal } from '@angular/core';
import { BuildingId, VillageBuilding } from '../building/building.interface';
import { ElementId } from '../element/element.interface';
import { FARM_LAYOUT, farmResourceCounts, generateFarmPlots } from '../farm/farm.generator';
import { FarmSave } from '../farm/farm.interface';
import { FirebaseService } from '../firebase/firebase.service';
import { createSeed } from '../map/map-geometry';
import { isOnboarded, LordsProgress, ProgressService } from '../progress/progress.service';
import { RegionId } from '../region/region.interface';
import { generateVillageSlots, VILLAGE_LAYOUT } from '../village/village.generator';
import { VillageSave } from '../village/village.interface';

/** Everything the in-game pages need about the signed-in lord. */
export interface GameState {
	uid: string;
	lordName: string;
	element: ElementId;
	region: RegionId;
	village: VillageSave;
	farm: FarmSave;
}

/**
 * Loads the lord's save for the in-game pages and founds their maps on first visit. Kept for the
 * session, so moving between the village and the farm does not read Firestore again.
 */
@Service()
export class GameService {
	private readonly _firebase = inject(FirebaseService);
	private readonly _progress = inject(ProgressService);
	private _cache: GameState | null = null;
	/** The load in flight, shared so the top bar and a page never found the maps twice. */
	private _loading: Promise<GameState | null> | null = null;

	/** The last loaded game, for chrome such as the top bar that only shows it. */
	readonly game = signal<GameState | null>(null);
	/** Farm plots per resource, shown in the top bar. Null until a game is loaded. */
	readonly resourceCounts = computed(() => {
		const game = this.game();

		return game ? farmResourceCounts(game.farm.plots) : null;
	});

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
		const maps = this._missingMaps(progress, element, region);

		if (maps.village || maps.farm) {
			await this._progress.setMaps(user.uid, maps);
		}

		this._cache = {
			uid: user.uid,
			lordName: progress.lord!.name!,
			element,
			region,
			village: progress.village ?? maps.village!,
			farm: progress.farm ?? maps.farm!,
		};

		this.game.set(this._cache);

		return this._cache;
	}

	/** Raises a building on a free village place, at level 1, and saves it. */
	async build(slot: number, type: BuildingId): Promise<void> {
		const game = this._cache;

		if (!game) {
			throw new Error('No game loaded.');
		}

		const building: VillageBuilding = { type, level: 1 };

		await this._progress.setBuilding(game.uid, slot, building);
		this._cache = {
			...game,
			village: {
				...game.village,
				buildings: { ...game.village.buildings, [slot]: building },
			},
		};
		this.game.set(this._cache);
	}

	async signOut() {
		this._cache = null;
		this._loading = null;
		this.game.set(null);
		await this._firebase.signOut();
	}

	/** Generates whichever maps this lord does not have yet. */
	private _missingMaps(progress: LordsProgress, element: ElementId, region: RegionId) {
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
				plots: generateFarmPlots(seed, element, region),
			};
		}

		return maps;
	}
}
