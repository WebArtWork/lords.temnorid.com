import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { FirebaseService } from '../../feature/firebase/firebase.service';

type SignInMethod = 'google' | 'guest';

@Component({
	imports: [TranslateDirective],
	template: `
		<section class="mx-auto flex max-w-[var(--container)] justify-center px-4 sm:px-6 t-page">
			<div class="w-full max-w-[30rem] t-card">
				<p class="t-numeral text-lg" translate>Темнорід</p>
				<h1 class="mt-1 t-display" translate>Лорди</h1>
				<p class="mt-4 t-lead" translate>
					Здобудь землі, збудуй свій дім і правь у світі Темнороду.
				</p>
				<p class="mt-4 leading-7 text-[var(--c-text-muted)]" translate>
					Браузерна фентезі-стратегія. Оберіть Камінь або Вогонь і заснуйте поселення. Гра
					в розробці.
				</p>

				@if (authReady()) {
					<div class="mt-8 grid gap-3">
						<button
							class="btn btn--primary"
							[disabled]="busy() !== null"
							(click)="signIn('google')"
							type="button"
						>
							<span class="material-symbols-outlined" aria-hidden="true">login</span>
							<span translate>Увійти через Google</span>
						</button>
						<button
							class="btn"
							[disabled]="busy() !== null"
							(click)="signIn('guest')"
							type="button"
						>
							<span class="material-symbols-outlined" aria-hidden="true">person</span>
							<span translate>Грати як гість</span>
						</button>
					</div>
					<p class="mt-3 text-sm text-[var(--c-text-muted)]" translate>
						Прогрес гостя зберігається лише на цьому пристрої.
					</p>

					@if (error()) {
						<p class="mt-3 text-[var(--c-secondary)]" role="alert" translate>
							Не вдалося увійти. Спробуйте ще раз.
						</p>
					}
				} @else {
					<p class="mt-8 text-[var(--c-text-muted)]" role="status" translate>
						Завантаження…
					</p>
				}
			</div>
		</section>
	`,
})
export class SignInComponent {
	private readonly _firebase = inject(FirebaseService);
	private readonly _router = inject(Router);

	protected readonly authReady = this._firebase.authReady;
	protected readonly busy = signal<SignInMethod | null>(null);
	protected readonly error = signal(false);

	constructor() {
		// Signed in, now or from a saved session: continue to onboarding.
		effect(() => {
			if (this._firebase.user()) {
				void this._router.navigateByUrl('/onboarding');
			}
		});
	}

	protected async signIn(method: SignInMethod) {
		this.busy.set(method);
		this.error.set(false);

		try {
			if (method === 'google') {
				await this._firebase.signInWithGoogle();
			} else {
				await this._firebase.signInAsGuest();
			}
		} catch (error) {
			// Closing the popup is a choice, not a failure.
			if ((error as { code?: string }).code !== 'auth/popup-closed-by-user') {
				this.error.set(true);
			}
		} finally {
			this.busy.set(null);
		}
	}
}
