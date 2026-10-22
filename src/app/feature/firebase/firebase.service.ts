import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
	Auth,
	GoogleAuthProvider,
	getAuth,
	onAuthStateChanged,
	signInAnonymously,
	signInWithPopup,
	signOut,
	User,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

/**
 * Firebase app, auth and Firestore for the game. Only imported by lazy pages, so it is split out
 * of the initial bundle. Nothing starts during prerender.
 */
@Service()
export class FirebaseService {
	private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private _app?: FirebaseApp;
	private _auth?: Auth;
	private _db?: Firestore;

	/** Signed-in player (Google or guest), or null. */
	readonly user = signal<User | null>(null);
	/** False until Firebase has restored (or ruled out) a saved session. Stays false on the server. */
	readonly authReady = signal(false);

	constructor() {
		if (!this._isBrowser) {
			return;
		}

		this._app = getApps()[0] ?? initializeApp(environment.firebase);
		this._auth = getAuth(this._app);
		this._db = getFirestore(this._app);

		onAuthStateChanged(this._auth, (user) => {
			this.user.set(user);
			this.authReady.set(true);
		});
	}

	get db(): Firestore {
		if (!this._db) {
			throw new Error('Firestore is only available in the browser.');
		}

		return this._db;
	}

	/** Resolves once the saved session has been restored, with the player or null. */
	whenReady(): Promise<User | null> {
		const auth = this._auth;

		if (!auth) {
			return Promise.resolve(null);
		}

		return auth.authStateReady().then(() => auth.currentUser);
	}

	async signInWithGoogle() {
		if (this._auth) {
			await signInWithPopup(this._auth, new GoogleAuthProvider());
		}
	}

	async signInAsGuest() {
		if (this._auth) {
			await signInAnonymously(this._auth);
		}
	}

	async signOut() {
		if (this._auth) {
			await signOut(this._auth);
		}
	}
}
