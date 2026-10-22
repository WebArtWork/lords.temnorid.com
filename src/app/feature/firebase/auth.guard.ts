import { isPlatformBrowser } from '@angular/common';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Lets signed-in players (Google or guest) through; everyone else goes to the sign-in page. */
export const authGuard: CanActivateFn = async () => {
	// Player pages render on the client only, but never build an auth redirect on the server.
	if (!isPlatformBrowser(inject(PLATFORM_ID))) {
		return true;
	}

	const router = inject(Router);
	const injector = inject(Injector);
	// Loaded on demand so Firebase stays out of the initial bundle.
	const { FirebaseService } = await import('./firebase.service');
	const user = await injector.get(FirebaseService).whenReady();

	return user ? true : router.parseUrl('/');
};
