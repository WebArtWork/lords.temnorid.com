import { inject, Service } from '@angular/core';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ElementId } from '../element/element.interface';
import { FirebaseService } from '../firebase/firebase.service';
import { RegionId } from '../region/region.interface';
import { FarmSave } from '../farm/farm.interface';
import { VillageSave } from '../village/village.interface';

/** A player's Lords save. */
export interface LordsProgress {
	firstLocation?: {
		element?: ElementId;
		region?: RegionId;
	};
	/** The character who leads the village. */
	lord?: {
		name?: string;
	};
	/** Generated maps, saved the first time the game opens and never regenerated. */
	village?: VillageSave;
	farm?: FarmSave;
}

/** Limits for the lord's name. The onboarding hint text repeats these numbers. */
export const LORD_NAME_MIN = 2;
export const LORD_NAME_MAX = 40;

/** True once every onboarding step is saved. */
export function isOnboarded(progress: LordsProgress | null): boolean {
	return !!(
		progress?.firstLocation?.element &&
		progress.firstLocation.region &&
		progress.lord?.name
	);
}

/**
 * Lords progress lives in `users/{uid}/progress/lords`, the per-player progress path that
 * firestore.rules (in temnorid.com) already lets only that player read and write.
 */
@Service()
export class ProgressService {
	private readonly _firebase = inject(FirebaseService);

	async load(uid: string): Promise<LordsProgress | null> {
		const snapshot = await getDoc(this._ref(uid));

		return snapshot.exists() ? (snapshot.data() as LordsProgress) : null;
	}

	async setFirstLocationElement(uid: string, element: ElementId) {
		await this._saveFirstLocation(uid, { element });
	}

	async setFirstLocationRegion(uid: string, region: RegionId) {
		await this._saveFirstLocation(uid, { region });
	}

	async setLordName(uid: string, name: string) {
		await this._merge(uid, { lord: { name } });
	}

	async setMaps(uid: string, maps: Pick<LordsProgress, 'village' | 'farm'>) {
		await this._merge(uid, maps);
	}

	private async _saveFirstLocation(uid: string, firstLocation: LordsProgress['firstLocation']) {
		await this._merge(uid, { firstLocation });
	}

	/** Merges, so each onboarding step keeps what the others saved. */
	private async _merge(uid: string, data: LordsProgress) {
		await setDoc(this._ref(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
	}

	private _ref(uid: string) {
		return doc(this._firebase.db, 'users', uid, 'progress', 'lords');
	}
}
