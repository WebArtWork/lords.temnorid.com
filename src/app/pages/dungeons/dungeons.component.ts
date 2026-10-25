import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { formatDuration, nowSignal } from '../../feature/building/building.timing';
import { DUNGEON_BY_ID, DUNGEONS, DungeonId } from '../../feature/dungeon/dungeon.data';
import { cannotGo, HERO_MAX_HEALTH, heroHealth, heroStatus } from '../../feature/dungeon/hero';
import { GameService, GameState } from '../../feature/game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../../feature/resource/resource.data';
import { ResourceId } from '../../feature/resource/resource.interface';

/** Dungeons of Podillia, where the lord's hero goes for loot, as Travian's adventures. */
@Component({
	imports: [TranslateDirective],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 py-6 sm:px-6 sm:py-8">
			<h1 class="t-display" translate>Темниці</h1>

			@if (view(); as view) {
				<section
					class="hero-card t-card mt-6 max-w-[40rem]"
					aria-labelledby="hero-title"
					aria-live="polite"
				>
					<div class="flex items-center gap-3">
						<span class="hero-card__icon material-symbols-outlined" aria-hidden="true"
							>swords</span
						>
						<div class="min-w-0 flex-1">
							<h2 id="hero-title" class="t-item" translate>Герой</h2>
							<p class="text-sm text-[var(--c-text-muted)]">
								@switch (view.status) {
									@case ('home') {
										<span translate>Вдома, готовий до походу</span>
									}
									@case ('away') {
										<span [translate]="view.where">{{ view.where }}</span> ·
										<span translate>повернеться за</span>
										<span
											class="ml-1 font-semibold tabular-nums text-[var(--c-text-strong)]"
											>{{ view.left }}</span
										>
									}
									@case ('back') {
										<span translate>Повернувся зі здобиччю</span>
									}
								}
							</p>
						</div>
					</div>

					<div class="mt-4 flex items-center gap-2">
						<span
							class="material-symbols-outlined text-[20px] text-[var(--c-secondary)]"
							aria-hidden="true"
							>favorite</span
						>
						<div
							class="hero-health"
							role="meter"
							aria-valuemin="0"
							[attr.aria-valuemax]="maxHealth"
							[attr.aria-valuenow]="view.health"
							[attr.aria-label]="labels().health"
						>
							<div class="hero-health__bar" [style.width.%]="view.health"></div>
						</div>
						<span class="w-10 text-right font-semibold tabular-nums">{{
							view.health
						}}</span>
					</div>

					@if (view.status === 'back') {
						<ul
							class="mt-4 flex flex-wrap gap-x-4 gap-y-2"
							[attr.aria-label]="labels().loot"
						>
							@for (part of view.loot; track part.id) {
								<li class="flex items-center gap-1.5" [title]="part.label">
									<span
										class="material-symbols-outlined text-[20px]"
										[style.color]="part.color"
										aria-hidden="true"
										>{{ part.icon }}</span
									>
									<span class="sr-only">{{ part.label }}:</span>
									<span class="font-semibold tabular-nums"
										>+{{ part.amount }}</span
									>
								</li>
							}
						</ul>
						<button
							class="btn btn--primary mt-4"
							[disabled]="working()"
							(click)="collect()"
							type="button"
						>
							<span class="material-symbols-outlined" aria-hidden="true"
								>inventory_2</span
							>
							<span translate>Забрати здобич</span>
						</button>
					}
				</section>

				@if (failed()) {
					<p class="mt-4 text-[var(--c-secondary)]" role="alert" translate>
						Не вдалося. Спробуйте ще раз.
					</p>
				}

				<ul class="mt-8 grid gap-4 md:grid-cols-2">
					@for (dungeon of view.dungeons; track dungeon.id) {
						<li class="dungeon t-card">
							<div class="flex items-start justify-between gap-3">
								<h2 class="t-item" [translate]="dungeon.name">
									{{ dungeon.name }}
								</h2>
								<span
									class="dungeon__danger"
									[attr.aria-label]="dungeon.dangerLabel"
									[title]="dungeon.dangerLabel"
								>
									@for (skull of dungeon.skulls; track $index) {
										<span
											class="material-symbols-outlined text-[18px]"
											[class.dungeon__skull--on]="skull"
											aria-hidden="true"
											>skull</span
										>
									}
								</span>
							</div>
							<p
								class="mt-2 text-sm leading-6 text-[var(--c-text-muted)]"
								[translate]="dungeon.description"
							>
								{{ dungeon.description }}
							</p>

							<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
								<li class="flex items-center gap-1" [title]="labels().time">
									<span
										class="material-symbols-outlined text-[18px] text-[var(--c-text-muted)]"
										aria-hidden="true"
										>schedule</span
									>
									<span class="sr-only">{{ labels().time }}:</span>
									<span class="tabular-nums">{{ dungeon.time }}</span>
								</li>
								<li class="flex items-center gap-1" [title]="labels().damage">
									<span
										class="material-symbols-outlined text-[18px] text-[var(--c-secondary)]"
										aria-hidden="true"
										>heart_minus</span
									>
									<span class="sr-only">{{ labels().damage }}:</span>
									<span class="tabular-nums">−{{ dungeon.damage }}</span>
								</li>
								@for (part of dungeon.loot; track part.id) {
									<li class="flex items-center gap-1" [title]="part.label">
										<span
											class="material-symbols-outlined text-[18px]"
											[style.color]="part.color"
											aria-hidden="true"
											>{{ part.icon }}</span
										>
										<span class="sr-only">{{ part.label }}:</span>
										<span class="tabular-nums">{{ part.range }}</span>
									</li>
								}
							</ul>

							<div class="mt-4 flex items-center justify-between gap-3">
								<p class="text-sm text-[var(--c-text-muted)]">
									{{ dungeon.blocked }}
								</p>
								<button
									class="btn btn--primary"
									[disabled]="!!dungeon.blocked || working()"
									(click)="send(dungeon.id)"
									type="button"
								>
									<span class="material-symbols-outlined" aria-hidden="true"
										>explore</span
									>
									<span translate>Вирушити</span>
								</button>
							</div>
						</li>
					}
				</ul>
			} @else if (error()) {
				<p class="mt-6 text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося завантажити темниці. Оновіть сторінку.
				</p>
			} @else {
				<p class="mt-6 text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
	styles: `
		.hero-card__icon {
			display: inline-flex;
			width: 3rem;
			height: 3rem;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--c-border);
			border-radius: 50%;
			background: var(--c-bg-tertiary);
			color: var(--c-primary-text);
			font-size: 26px;
		}

		.hero-health {
			height: 0.625rem;
			flex: 1;
			overflow: hidden;
			border-radius: 999px;
			background: var(--c-bg-tertiary);
		}

		.hero-health__bar {
			height: 100%;
			border-radius: inherit;
			background: var(--c-secondary);
			transition: width 1s linear;
		}

		.dungeon {
			display: flex;
			flex-direction: column;
			justify-content: space-between;
		}

		.dungeon__danger {
			display: inline-flex;
			color: var(--c-border);
		}

		.dungeon__skull--on {
			color: var(--c-secondary);
		}
	`,
})
export class DungeonsComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	protected readonly maxHealth = HERO_MAX_HEALTH;
	protected readonly state = computed<GameState | null>(() => this._game.game());
	protected readonly error = signal(false);
	protected readonly working = signal(false);
	protected readonly failed = signal(false);
	protected readonly labels = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();

		return {
			time: t('Тривалість походу'),
			damage: t("Втрата здоров'я"),
			health: t("Здоров'я героя"),
			loot: t('Здобич'),
		};
	});

	protected readonly view = computed(() => {
		this._languageService.language();
		const game = this.state();

		if (!game) {
			return null;
		}

		const t = (text: string) => this._translateService.translate(text)();
		const now = this._now();
		const hero = game.hero;
		const status = heroStatus(hero, now);
		const expedition = hero.expedition;
		const parts = (amounts: Partial<Record<ResourceId, unknown>>) =>
			RESOURCES.filter((r) => amounts[r.id] !== undefined).map((r) => ({
				id: r.id,
				icon: r.icon,
				color: r.color,
				label: t(RESOURCE_BY_ID[r.id].name),
			}));
		const dangers = ['', t('Легко'), t('Небезпечно'), t('Смертельно')];

		return {
			status,
			health: Math.floor(heroHealth(hero, now)),
			where: expedition ? DUNGEON_BY_ID[expedition.dungeon].name : '',
			left: expedition ? formatDuration((expedition.endsAt - now) / 1000) : '',
			loot: expedition
				? parts(expedition.loot).map((part) => ({
						...part,
						amount: expedition.loot[part.id]!,
					}))
				: [],
			dungeons: DUNGEONS.map((dungeon) => {
				const reason = cannotGo(hero, dungeon, now);

				return {
					...dungeon,
					time: formatDuration(dungeon.minutes * 60),
					skulls: [1, 2, 3].map((n) => n <= dungeon.danger),
					dangerLabel: dangers[dungeon.danger]!,
					loot: parts(dungeon.loot).map((part) => {
						const [min, max] = dungeon.loot[part.id]!;

						return { ...part, range: `${min}–${max}` };
					}),
					blocked:
						reason === 'busy'
							? t('Герой у поході')
							: reason === 'weak'
								? t("Замало здоров'я")
								: '',
				};
			}),
		};
	});

	constructor() {
		void this._load();
	}

	protected async send(id: DungeonId) {
		await this._act(() => this._game.sendHero(id));
	}

	protected async collect() {
		await this._act(() => this._game.collectLoot());
	}

	private async _act(action: () => Promise<void>) {
		this.working.set(true);
		this.failed.set(false);

		try {
			await action();
		} catch (error) {
			console.error(error);
			this.failed.set(true);
		} finally {
			this.working.set(false);
		}
	}

	private async _load() {
		try {
			const state = await this._game.load();

			if (!state) {
				await this._router.navigateByUrl('/onboarding');
			}
		} catch (error) {
			console.error(error);
			this.error.set(true);
		}
	}
}
