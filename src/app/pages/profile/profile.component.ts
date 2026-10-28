import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { HeroStatusComponent } from '../../feature/dungeon/hero-status.component';
import { HeroLootCardComponent } from '../../feature/dungeon/hero-loot-card.component';
import { ELEMENTS } from '../../feature/element/element.data';
import { FirebaseService } from '../../feature/firebase/firebase.service';
import { GameService, GameState } from '../../feature/game/game.service';
import { FactionPickerComponent } from '../../feature/faction/faction-picker.component';
import { ELECTIONS_LIVE } from '../../feature/faction/election';
import { FactionElectionComponent } from '../../feature/faction/faction-election.component';
import { FACTION_BY_ID, FactionId } from '../../feature/faction/faction.data';
import { FactionService } from '../../feature/faction/faction.service';
import { AvatarComponent } from '../../feature/profile/avatar.component';
import { SettingsComponent } from '../../feature/profile/settings.component';
import { REGIONS } from '../../feature/region/region.data';
import { WorldVillage } from '../../feature/world/world.interface';
import { WorldService } from '../../feature/world/world.service';

/** The player's account, their lord, and the site's language and theme. */
@Component({
	imports: [
		AvatarComponent,
		FactionElectionComponent,
		FactionPickerComponent,
		HeroLootCardComponent,
		HeroStatusComponent,
		RouterLink,
		SettingsComponent,
		TranslateDirective,
	],
	template: `
		<section class="w-full px-4 sm:px-6 t-page">
			@if (user(); as user) {
				<div class="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
				<aside class="grid gap-6 lg:sticky lg:top-6">
				<div class="flex flex-wrap items-center gap-5">
					<app-avatar [size]="96" />
					<div class="min-w-0">
						<h1 class="t-display">
							@if (user.isAnonymous) {
								<span translate>Гість</span>
							} @else if (game(); as game) {
								{{ game.lordName }}
							} @else {
								<span translate>Лорд</span>
							}
						</h1>
						@if (!user.isAnonymous && user.email) {
							<p class="mt-2 flex items-center gap-2 text-[var(--c-text-muted)]">
								<span class="break-all">{{ user.email }}</span>
								<button class="btn shrink-0 !px-2" (click)="signOut()" type="button">
									<span class="material-symbols-outlined" aria-hidden="true">logout</span>
									<span class="sr-only" translate>Вийти</span>
								</button>
							</p>
						}
					</div>
				</div>

				<app-hero-status />
				<app-hero-loot-card />
				</aside>

				<div class="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] items-start gap-4">
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

					@if (game()) {
						<section class="t-card" aria-labelledby="profile-faction">
							<h2 id="profile-faction" class="t-item" translate>Фракція</h2>
							@if (chosenFaction(); as faction) {
								<div class="faction-chosen mt-4" [style.--faction]="faction.color">
									<div class="flex items-center gap-3">
										<span
											class="faction-chosen__icon material-symbols-outlined"
											aria-hidden="true"
											>{{ faction.icon }}</span
										>
										<span
											class="min-w-0 flex-1 font-semibold text-[var(--c-text-strong)]"
											[translate]="faction.name"
											>{{ faction.name }}</span
										>
									</div>
									<p
										class="mt-2 text-sm leading-6 text-[var(--c-text-muted)]"
										[translate]="faction.summary"
									>
										{{ faction.summary }}
									</p>
									<p class="mt-2 text-sm leading-6">
										<span class="text-[var(--c-text-muted)]" translate
											>Мета</span
										>:
										<span [translate]="faction.goal">{{ faction.goal }}</span>
									</p>
								</div>

								@if (electionsLive) {
									<app-faction-election
										class="mt-6 block"
										[faction]="faction.id"
										[uid]="game()!.uid"
										[lordName]="game()!.lordName"
									/>
								} @else {
									<p
										class="mt-6 flex items-center gap-2 text-sm text-[var(--c-text-muted)]"
									>
										<span
											class="material-symbols-outlined text-[20px]"
											aria-hidden="true"
											>how_to_vote</span
										>
										<span translate
											>Вибори президента фракції з'являться найближчим
											часом.</span
										>
									</p>
								}

								<div class="mt-6 flex flex-wrap items-center gap-3">
									@if (confirmLeave()) {
										<span class="text-sm" translate
											>Точно покинути фракцію?</span
										>
										<button
											class="btn"
											[disabled]="joining()"
											(click)="leaveFaction()"
											type="button"
											translate
										>
											Так, покинути
										</button>
										<button
											class="btn"
											(click)="confirmLeave.set(false)"
											type="button"
											translate
										>
											Ні
										</button>
									} @else {
										<button
											class="btn"
											(click)="confirmLeave.set(true)"
											type="button"
										>
											<span
												class="material-symbols-outlined"
												aria-hidden="true"
												>logout</span
											>
											<span translate>Покинути фракцію</span>
										</button>
									}
								</div>
							} @else {
								<p class="mt-1 text-sm text-[var(--c-text-muted)]" translate>
									Оберіть, з ким стоїте. Пізніше фракцію можна покинути.
								</p>
								<app-faction-picker
									class="mt-4 block"
									[chosen]="faction()"
									[busy]="joining()"
									(pick)="joinFaction($event)"
								/>
							}
							@if (factionFailed()) {
								<p
									class="mt-3 text-sm text-[var(--c-secondary)]"
									role="alert"
									translate
								>
									Не вдалося змінити фракцію. Спробуйте ще раз.
								</p>
							}
						</section>
					}

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
				</div>
			} @else {
				<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
	styles: `
		.faction-chosen {
			border: 1px solid var(--faction);
			border-left-width: 4px;
			border-radius: var(--t-radius);
			background: color-mix(in srgb, var(--faction) 12%, transparent);
			padding: 0.875rem;
		}

		.faction-chosen__icon {
			color: var(--faction);
			font-size: 28px;
		}

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
	private readonly _factions = inject(FactionService);

	protected readonly user = this._firebase.user;
	protected readonly game = signal<GameState | null>(null);
	protected readonly village = signal<WorldVillage | null>(null);
	protected readonly loading = signal(true);
	/** From GameService, so a new choice shows at once. */
	protected readonly faction = computed(() => this._game.game()?.faction ?? null);
	protected readonly chosenFaction = computed(() => {
		const faction = this.faction();

		return faction ? FACTION_BY_ID[faction] : null;
	});
	protected readonly confirmLeave = signal(false);
	protected readonly electionsLive = ELECTIONS_LIVE;
	protected readonly joining = signal(false);
	protected readonly factionFailed = signal(false);
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

	protected async joinFaction(faction: FactionId) {
		await this._changeFaction(async (game) => {
			await this._game.chooseFaction(faction);
			// The shared member list only feeds elections; joining must not hang on it.
			this._factions.join(game.uid, faction, game.lordName).catch((e) => console.error(e));
		});
	}

	protected async leaveFaction() {
		await this._changeFaction(async (game) => {
			await this._game.leaveFaction();
			this._factions.leave(game.uid).catch((e) => console.error(e));
		});
		this.confirmLeave.set(false);
	}

	private async _changeFaction(change: (game: GameState) => Promise<void>) {
		const game = this.game();

		if (!game) {
			return;
		}

		this.joining.set(true);
		this.factionFailed.set(false);

		try {
			await change(game);
		} catch (error) {
			console.error(error);
			this.factionFailed.set(true);
		} finally {
			this.joining.set(false);
		}
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
				// Lords who chose a faction before the shared list existed get listed now.
				if (game.faction) {
					this._factions
						.ensureMember(game.uid, game.faction, game.lordName)
						.catch((error) => console.error(error));
				}

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
