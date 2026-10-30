import { inject, Service } from '@angular/core';
import {
	collection,
	doc,
	limit,
	onSnapshot,
	query,
	runTransaction,
	serverTimestamp,
	Timestamp,
	Unsubscribe,
	where,
	writeBatch,
} from 'firebase/firestore';
import { StockSave } from '../economy/economy';
import { FirebaseService } from '../firebase/firebase.service';
import { ProgressService } from '../progress/progress.service';
import { Point } from '../map/map-geometry';
import { Offer, Shipment, TradeError, travelSeconds } from './market';

/** Where offers without a place are taken to stand: the heart of the world, Kamianets. */
const CENTRE: Point = { x: 0, y: 0 };

/** Most offers the board lists at once. */
const BOARD_LIMIT = 100;

/**
 * The shared side of the marketplace in Firestore: `lordsOffers/{id}`, readable by every signed-in
 * lord. Each write also saves the poster's or buyer's stores in the same batch or transaction, so
 * goods are never counted twice or lost. Rules live in temnorid.com/firestore.rules.
 *
 * The buyer cannot write the seller's stores, so a bought offer stays on the board as `filled`
 * until the seller collects the payment (see `collect`).
 */
@Service()
export class MarketService {
	private readonly _firebase = inject(FirebaseService);
	private readonly _progress = inject(ProgressService);

	private get _offers() {
		return collection(this._firebase.db, 'lordsOffers');
	}

	/** Live list of open offers from every lord. */
	watchOpen(next: (offers: Offer[]) => void, failed: (error: unknown) => void): Unsubscribe {
		return onSnapshot(
			query(this._offers, where('status', '==', 'open'), limit(BOARD_LIMIT)),
			(snapshot) => next(snapshot.docs.map((d) => this._offer(d.id, d.data()))),
			failed,
		);
	}

	/** Live list of this lord's own offers, open or bought. */
	watchMine(
		uid: string,
		next: (offers: Offer[]) => void,
		failed: (error: unknown) => void,
	): Unsubscribe {
		return onSnapshot(
			query(this._offers, where('uid', '==', uid)),
			(snapshot) => next(snapshot.docs.map((d) => this._offer(d.id, d.data()))),
			failed,
		);
	}

	/** Lists a new offer and saves the stores with its goods taken out. */
	async post(
		offer: Pick<Offer, 'uid' | 'lordName' | 'give' | 'giveAmount' | 'want' | 'wantAmount' | 'at'>,
		stock: StockSave,
	) {
		const batch = writeBatch(this._firebase.db);

		batch.set(doc(this._offers), { ...offer, status: 'open', createdAt: serverTimestamp() });
		batch.set(this._progress.ref(offer.uid), { stock, updatedAt: serverTimestamp() }, { merge: true });
		await batch.commit();
	}

	/** Takes an offer back, if nobody has bought it yet, and saves the stores with the goods returned. */
	async cancel(uid: string, id: string, stock: StockSave) {
		await runTransaction(this._firebase.db, async (tx) => {
			const ref = doc(this._offers, id);
			const snapshot = await tx.get(ref);

			if (!snapshot.exists() || snapshot.data()['status'] !== 'open') {
				throw new TradeError('Пропозиція вже недоступна.');
			}

			tx.delete(ref);
			tx.set(this._progress.ref(uid), { stock, updatedAt: serverTimestamp() }, { merge: true });
		});
	}

	/**
	 * Buys an offer. `planFor` gets the offer as it stands on the server and the seconds the road
	 * between the two villages takes, and returns the buyer's stores after paying plus the goods
	 * now on their way, so the amounts always match what was really listed.
	 */
	async accept(
		uid: string,
		lordName: string,
		buyerAt: Point,
		id: string,
		planFor: (offer: Offer, seconds: number) => { stock: StockSave; shipments: Shipment[] },
	): Promise<void> {
		await runTransaction(this._firebase.db, async (tx) => {
			const ref = doc(this._offers, id);
			const snapshot = await tx.get(ref);

			if (!snapshot.exists() || snapshot.data()['status'] !== 'open') {
				throw new TradeError('Пропозиція вже недоступна.');
			}

			const offer = this._offer(id, snapshot.data());

			if (offer.uid === uid) {
				throw new TradeError('Це ваша власна пропозиція.');
			}

			const seconds = travelSeconds(offer.at ?? CENTRE, buyerAt);
			const { stock, shipments } = planFor(offer, seconds);

			tx.update(ref, {
				status: 'filled',
				buyerUid: uid,
				buyerName: lordName,
				buyerAt,
				travelSeconds: seconds,
				filledAt: serverTimestamp(),
			});
			tx.set(
				this._progress.ref(uid),
				{ stock, shipments, updatedAt: serverTimestamp() },
				{ merge: true },
			);
		});
	}

	/** Hands the seller what the buyer paid, once, and clears the offer from the board. */
	async collect(uid: string, id: string, stockFor: (offer: Offer) => StockSave): Promise<void> {
		await runTransaction(this._firebase.db, async (tx) => {
			const ref = doc(this._offers, id);
			const snapshot = await tx.get(ref);

			if (!snapshot.exists() || snapshot.data()['status'] !== 'filled') {
				throw new TradeError('Нічого забирати.');
			}

			const stock = stockFor(this._offer(id, snapshot.data()));

			tx.delete(ref);
			tx.set(this._progress.ref(uid), { stock, updatedAt: serverTimestamp() }, { merge: true });
		});
	}

	private _offer(id: string, data: Record<string, unknown>): Offer {
		const created = data['createdAt'];
		const filled = data['filledAt'];

		return {
			at: data['at'] as Offer['at'],
			filledAt: filled instanceof Timestamp ? filled.toMillis() : undefined,
			buyerAt: data['buyerAt'] as Offer['buyerAt'],
			travelSeconds: data['travelSeconds'] as Offer['travelSeconds'],
			id,
			uid: data['uid'] as string,
			lordName: data['lordName'] as string,
			give: data['give'] as Offer['give'],
			giveAmount: data['giveAmount'] as number,
			want: data['want'] as Offer['want'],
			wantAmount: data['wantAmount'] as number,
			status: data['status'] as Offer['status'],
			createdAt: created instanceof Timestamp ? created.toMillis() : 0,
		};
	}
}
