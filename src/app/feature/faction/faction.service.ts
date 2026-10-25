import { inject, Service } from '@angular/core';
import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	onSnapshot,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	Unsubscribe,
	where,
	writeBatch,
} from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { Candidate, Election, VOTE_MS } from './election';
import { FactionId } from './faction.data';

/** A lord in a faction. Stored in `lordsMembers/{uid}`, readable by every signed-in lord. */
export interface FactionMember {
	uid: string;
	faction: FactionId;
	lordName: string;
	/** Epoch milliseconds; 0 until the server has stamped it. */
	joinedAt: number;
}

/**
 * The shared side of factions in Firestore, so every member sees the same election:
 * - `lordsMembers/{uid}`: who stands with which faction;
 * - `lordsFactions/{faction}`: the faction's latest election, by id and start;
 * - `lordsElections/{id}`, with `candidates/{uid}` and `votes/{uid}`.
 * Rules live in temnorid.com/firestore.rules and allow one candidacy and one vote per lord.
 */
@Service()
export class FactionService {
	private readonly _firebase = inject(FirebaseService);

	async join(uid: string, faction: FactionId, lordName: string) {
		await setDoc(doc(this._firebase.db, 'lordsMembers', uid), {
			uid,
			faction,
			lordName,
			joinedAt: serverTimestamp(),
		});
	}

	/**
	 * Makes sure the shared list has the lord in their faction, for lords who chose one before the
	 * list existed. Keeps the original joining time when they are already listed.
	 */
	async ensureMember(uid: string, faction: FactionId, lordName: string) {
		const listed = await getDoc(doc(this._firebase.db, 'lordsMembers', uid));

		if (listed.data()?.['faction'] !== faction) {
			await this.join(uid, faction, lordName);
		}
	}

	async leave(uid: string) {
		await deleteDoc(doc(this._firebase.db, 'lordsMembers', uid));
	}

	/** Members of a faction, kept up to date. Returns the unsubscribe function. */
	watchMembers(faction: FactionId, next: (members: FactionMember[]) => void): Unsubscribe {
		return onSnapshot(
			query(collection(this._firebase.db, 'lordsMembers'), where('faction', '==', faction)),
			(snapshot) =>
				next(
					snapshot.docs.map((d) => {
						const data = d.data();

						return {
							uid: d.id,
							faction: data['faction'],
							lordName: data['lordName'],
							joinedAt: _millis(data['joinedAt']),
						};
					}),
				),
			(error) => console.error(error),
		);
	}

	/**
	 * The faction's latest election with its candidates and votes, kept up to date; null when the
	 * faction has never voted. Returns the unsubscribe function.
	 */
	watchElection(
		faction: FactionId,
		uid: string,
		next: (election: Election | null) => void,
	): Unsubscribe {
		const db = this._firebase.db;
		let inner: Unsubscribe[] = [];
		const stopInner = () => {
			inner.forEach((stop) => stop());
			inner = [];
		};

		const outer = onSnapshot(
			doc(db, 'lordsFactions', faction),
			(snapshot) => {
				stopInner();
				const data = snapshot.data();

				if (!data?.['election']) {
					next(null);
					return;
				}

				const id = data['election'] as string;
				const startedAt = _millis(data['startedAt']);
				let candidates: Omit<Candidate, 'votes'>[] = [];
				let votes: { uid: string; candidate: string }[] = [];
				const emit = () => {
					const counts = new Map<string, number>();

					votes.forEach((vote) =>
						counts.set(vote.candidate, (counts.get(vote.candidate) ?? 0) + 1),
					);
					next({
						id,
						startedAt,
						endsAt: startedAt + VOTE_MS,
						candidates: candidates.map((c) => ({
							...c,
							votes: counts.get(c.uid) ?? 0,
						})),
						myVote: votes.find((vote) => vote.uid === uid)?.candidate ?? null,
					});
				};

				inner = [
					onSnapshot(collection(db, 'lordsElections', id, 'candidates'), (s) => {
						candidates = s.docs.map((d) => ({
							uid: d.id,
							lordName: d.data()['lordName'],
							at: _millis(d.data()['at']),
						}));
						emit();
					}),
					onSnapshot(collection(db, 'lordsElections', id, 'votes'), (s) => {
						votes = s.docs.map((d) => ({
							uid: d.id,
							candidate: d.data()['candidate'],
						}));
						emit();
					}),
				];
			},
			(error) => console.error(error),
		);

		return () => {
			stopInner();
			outer();
		};
	}

	/**
	 * Stands for president. With no vote open, this opens one: a new election, pointed to from the
	 * faction, with this lord as its first candidate.
	 */
	async stand(faction: FactionId, uid: string, lordName: string, openElection: string | null) {
		const db = this._firebase.db;
		const batch = writeBatch(db);
		let election = openElection;

		if (!election) {
			election = doc(collection(db, 'lordsElections')).id;
			batch.set(doc(db, 'lordsElections', election), {
				faction,
				startedAt: serverTimestamp(),
			});
			batch.set(doc(db, 'lordsFactions', faction), {
				election,
				startedAt: serverTimestamp(),
			});
		}

		batch.set(doc(db, 'lordsElections', election, 'candidates', uid), {
			lordName,
			at: serverTimestamp(),
		});
		await batch.commit();
	}

	/** Casts or changes the lord's vote. */
	async vote(election: string, uid: string, candidate: string) {
		await setDoc(doc(this._firebase.db, 'lordsElections', election, 'votes', uid), {
			candidate,
			at: serverTimestamp(),
		});
	}
}

function _millis(value: unknown): number {
	return value instanceof Timestamp ? value.toMillis() : 0;
}
