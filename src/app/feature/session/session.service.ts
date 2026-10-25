import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injector, PLATFORM_ID, Service, signal } from '@angular/core';
import type { FirebaseService } from '../firebase/firebase.service';
import type { GameService } from '../game/game.service';

/**
 * The signed-in player and their game, for chrome that is always on screen (top bar, bottom bar).
 * Firebase loads on demand, as in authGuard, so it stays out of the initial bundle.
 */
@Service()
export class SessionService {
	private readonly _firebase = signal<FirebaseService | null>(null);
	private readonly _game = signal<GameService | null>(null);

	/** The signed-in player, once Firebase has loaded. Null on the server and when signed out. */
	readonly user = computed(() => this._firebase()?.user() ?? null);
	/** The lord's game, once loaded. */
	readonly game = computed(() => this._game()?.game() ?? null);

	constructor() {
		if (!isPlatformBrowser(inject(PLATFORM_ID))) {
			return;
		}

		const injector = inject(Injector);

		void Promise.all([
			import('../firebase/firebase.service'),
			import('../game/game.service'),
		]).then(([{ FirebaseService }, { GameService }]) => {
			this._firebase.set(injector.get(FirebaseService));
			this._game.set(injector.get(GameService));
		});

		// Loads the lord once someone signs in, so their name and resources show on every page.
		effect(() => {
			const game = this._game();

			if (this.user() && game) {
				game.load().catch((error) => console.error(error));
			}
		});
	}
}
