import { inject, Service } from '@angular/core';
import {
	collection,
	doc,
	getDoc,
	getDocs,
	limit,
	query,
	runTransaction,
	serverTimestamp,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import type { GameState } from '../game/game.service';
import { REGIONS } from '../region/region.data';
import { settleSpot } from './world.generator';
import { WorldCounts, WorldState, WorldVillage } from './world.interface';

/** Enough for the early world. Past this, load villages by area instead of all at once. */
const VILLAGE_LIMIT = 1000;

/**
 * The shared world in Firestore: `lordsWorld/quadrants` counts villages per quarter and
 * `lordsVillages/{uid}` places each lord. Rules live in temnorid.com/firestore.rules.
 */
@Service()
export class WorldService {
	private readonly _firebase = inject(FirebaseService);

	/** Loads the world, settling the lord's village on the map first if it is not there yet. */
	async load(game: GameState): Promise<WorldState> {
		const mine = await this.settle(game);
		const [counts, villages] = await Promise.all([this._counts(), this._villages()]);

		// Our own village is always shown, even if the list was cut off.
		if (!villages.some((village) => village.uid === mine.uid)) {
			villages.push(mine);
		}

		return { counts, villages, mine };
	}

	/** The lord's village on the map, or null if the game has not settled it yet. Read only. */
	async mine(uid: string): Promise<WorldVillage | null> {
		const snapshot = await getDoc(doc(this._firebase.db, 'lordsVillages', uid));

		return snapshot.exists() ? (snapshot.data() as WorldVillage) : null;
	}

	/**
	 * The lord's village on the world map, taking the next spot in their quarter if it has none yet.
	 * One transaction bumps the quarter's count and writes the village, so two lords founding at
	 * once never get the same spot.
	 */
	async settle(
		game: Pick<GameState, 'uid' | 'lordName' | 'element' | 'region'>,
	): Promise<WorldVillage> {
		const db = this._firebase.db;
		const villageRef = doc(db, 'lordsVillages', game.uid);
		const existing = await getDoc(villageRef);

		if (existing.exists()) {
			return existing.data() as WorldVillage;
		}

		const countsRef = doc(db, 'lordsWorld', 'quadrants');

		return runTransaction(db, async (transaction) => {
			const counts = await transaction.get(countsRef);
			const settled = await transaction.get(villageRef);

			// Another tab may have founded it a moment ago.
			if (settled.exists()) {
				return settled.data() as WorldVillage;
			}

			const index = (counts.data()?.[game.region] as number | undefined) ?? 0;
			const spot = settleSpot(game.region, index);
			const village: WorldVillage = {
				uid: game.uid,
				lordName: game.lordName,
				element: game.element,
				region: game.region,
				index,
				...spot,
			};

			transaction.set(countsRef, { [game.region]: index + 1 }, { merge: true });
			transaction.set(villageRef, { ...village, createdAt: serverTimestamp() });

			return village;
		});
	}

	private async _counts(): Promise<WorldCounts> {
		const snapshot = await getDoc(doc(this._firebase.db, 'lordsWorld', 'quadrants'));
		const data = snapshot.data() ?? {};

		return Object.fromEntries(
			REGIONS.map((region) => [region.id, (data[region.id] as number | undefined) ?? 0]),
		) as WorldCounts;
	}

	private async _villages(): Promise<WorldVillage[]> {
		const snapshot = await getDocs(
			query(collection(this._firebase.db, 'lordsVillages'), limit(VILLAGE_LIMIT)),
		);

		return snapshot.docs.map((d) => {
			const { uid, lordName, element, region, index, x, y } = d.data() as WorldVillage;

			return { uid, lordName, element, region, index, x, y };
		});
	}
}
