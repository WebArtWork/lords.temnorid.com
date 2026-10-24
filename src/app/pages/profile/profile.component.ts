import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { ELEMENTS } from '../../feature/element/element.data';
import { FirebaseService } from '../../feature/firebase/firebase.service';
import { GameService, GameState } from '../../feature/game/game.service';
import { AvatarComponent } from '../../feature/profile/avatar.component';
import { SettingsComponent } from '../../feature/profile/settings.component';
import { REGIONS } from '../../feature/region/region.data';
import { WorldVillage } from '../../feature/world/world.interface';
import { WorldService } from '../../feature/world/world.service';

/** The player's account, their lord, and the site's language and theme. */
@Component({
	imports: [AvatarComponent, RouterLink, SettingsComponent, TranslateDirective],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			@if (user(); as user) {
				<div class="flex flex-wrap items-center gap-5">
					<app-avatar [photoUrl]="user.photoURL" [name]="user.displayName" [size]="96" />
					<div class="min-w-0">
						<h1 class="t-display">
							@if (user.isAnonymous) {
								<span translate>Гість</span>
							} @else {
								{{ user.displayName || user.email }}
							}
						</h1>
						@if (!user.isAnonymous && user.displayName && user.email) {
							<p class="mt-2 break-all text-[var(--c-text-muted)]">
								{{ user.email }}
							</p>
						}
					</div>
				</div>

				<div class="mt-8 grid gap-4 md:grid-cols-2">
					<section class="t-card" aria-labelledby="profile-lord">
						<h2 id="profile-lord" class="t-item" translate>Лорд</h2>
						@if (loading()) {
							<p class="mt-3 text-[var(--c-text-muted)]" role="status" translate>
								Завантаження…
							</p>
						} @else if (error()) {
							<p class="mt-3 text-[var(--c-secondary)]" role="alert" translate>
								Не вдалося завантажити профіль. Оновіть сторінку.
							</p>
						} @else if (lord(); as lord) {
							<dl class="profile-facts mt-3">
								<dt translate>Ім'я</dt>
								<dd>{{ lord.name }}</dd>
								<dt translate>Стихія</dt>
								<dd [translate]="lord.element">{{ lord.element }}</dd>
								<dt translate>Чверть світу</dt>
								<dd [translate]="lord.region">{{ lord.region }}</dd>
								<dt translate>Поселення</dt>
								<dd>
									@if (village(); as village) {
										<a class="profile-link tabular-nums" routerLink="/world"
											>({{ village.x }}|{{ village.y }})</a
										>
									} @else {
										<a class="profile-link" routerLink="/world" translate
											>Ще не на мапі світу</a
										>
									}
								</dd>
							</dl>
							<a class="btn mt-5" routerLink="/village">
								<span class="material-symbols-outlined" aria-hidden="true"
									>cottage</span
								>
								<span translate>До поселення</span>
							</a>
						} @else {
							<p class="mt-3 text-[var(--c-text-muted)]" translate>
								Ви ще не обрали свого лорда.
							</p>
							<a class="btn btn--primary mt-5" routerLink="/onboarding">
								<span class="material-symbols-outlined" aria-hidden="true"
									>arrow_forward</span
								>
								<span translate>Почати гру</span>
							</a>
						}
					</section>

					<section class="t-card" aria-labelledby="profile-settings">
						<h2 id="profile-settings" class="t-item" translate>Налаштування</h2>
						<app-settings class="mt-3 block" />
					</section>

					<section class="t-card" aria-labelledby="profile-account">
						<h2 id="profile-account" class="t-item" translate>Обліковий запис</h2>
						<dl class="profile-facts mt-3">
							<dt translate>Вхід</dt>
							<dd>
								@if (user.isAnonymous) {
									<span translate>Гість</span>
								} @else {
									Google
								}
							</dd>
						</dl>
						@if (user.isAnonymous) {
							<p class="mt-3 text-sm text-[var(--c-text-muted)]" translate>
								Прогрес гостя зберігається лише на цьому пристрої.
							</p>
						}
						<button class="btn mt-5" (click)="signOut()" type="button">
							<span class="material-symbols-outlined" aria-hidden="true">logout</span>
							<span translate>Вийти</span>
						</button>
					</section>
				</div>
			} @else {
				<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
	styles: `
		.profile-facts {
			display: grid;
			grid-template-columns: max-content 1fr;
			gap: 0.5rem 1.5rem;

			dt {
				color: var(--c-text-muted);
			}

			dd {
				color: var(--c-text-strong);
				font-weight: 600;
			}
		}

		.profile-link {
			color: var(--c-primary-text);
			text-decoration: underline;
			text-underline-offset: 3px;
		}
	`,
})
export class ProfileComponent {
	private readonly _firebase = inject(FirebaseService);
	private readonly _game = inject(GameService);
	private readonly _world = inject(WorldService);
	private readonly _router = inject(Router);

	protected readonly user = this._firebase.user;
	protected readonly game = signal<GameState | null>(null);
	protected readonly village = signal<WorldVillage | null>(null);
	protected readonly loading = signal(true);
	protected readonly error = signal(false);

	/** The lord's choices as the Ukrainian source names; the template translates them. */
	protected readonly lord = computed(() => {
		const game = this.game();

		if (!game) {
			return null;
		}

		return {
			name: game.lordName,
			element: ELEMENTS.find((element) => element.id === game.element)?.name ?? '',
			region: REGIONS.find((region) => region.id === game.region)?.name ?? '',
		};
	});

	constructor() {
		void this._load();
	}

	protected async signOut() {
		await this._game.signOut();
		await this._router.navigateByUrl('/');
	}

	private async _load() {
		try {
			const game = await this._game.load();

			this.game.set(game);

			if (game) {
				this.village.set(await this._world.mine(game.uid));
			}
		} catch (error) {
			console.error(error);
			this.error.set(true);
		} finally {
			this.loading.set(false);
		}
	}
}
