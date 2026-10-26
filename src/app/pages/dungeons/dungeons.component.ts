import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { buildingLevel, formatDuration, nowSignal } from '../../feature/building/building.timing';
import { DUNGEON_BY_ID, DUNGEONS, DungeonId } from '../../feature/dungeon/dungeon.data';
import {
	cannotGo,
	deathChance,
	HERO_MAX_HEALTH,
	heroFate,
	heroHealth,
	heroStatus,
} from '../../feature/dungeon/hero';
import {
	blockedLabel,
	DANGER_LABELS,
	lootParts,
	riskPercent,
} from '../../feature/dungeon/dungeon.view';
import { HeroLootCardComponent } from '../../feature/dungeon/hero-loot-card.component';
import { GameService, GameState } from '../../feature/game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../../feature/resource/resource.data';
import { ResourceId } from '../../feature/resource/resource.interface';

/** Dungeons of Podillia, where the lord's hero goes for loot, as Travian's adventures. */
@Component({
	imports: [HeroLootCardComponent, RouterLink, TranslateDirective],
	template: `
		<section class="w-full px-4 py-6 sm:px-6 sm:py-8">
			<h1 class="sr-only" translate>Темниці</h1>

			@if (view(); as view) {
				<div
					class="mt-2 grid gap-6 lg:items-start"
					[class]="view.status === 'back' ? 'lg:grid-cols-[18rem_minmax(0,1fr)]' : ''"
				>
				@if (view.status === 'back') {
				<app-hero-loot-card class="lg:sticky lg:top-6" />
				}

				@if (failed()) {
					<p class="mt-4 text-[var(--c-secondary)]" role="alert" translate>
						Не вдалося. Спробуйте ще раз.
					</p>
				}

				<div>
				<ul class="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
					@for (dungeon of view.dungeons; track dungeon.id) {
						<li class="dungeon t-card">
							<div class="flex items-start justify-between gap-3">
								<!-- The whole card opens the dungeon; only the button sends the hero. -->
								<h2 class="t-item">
									<a
										class="dungeon__link"
										[routerLink]="['/dungeons', dungeon.id]"
										[translate]="dungeon.name"
										>{{ dungeon.name }}</a
									>
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
								<li class="flex items-center gap-1" [title]="labels().distance">
									<span
										class="material-symbols-outlined text-[18px] text-[var(--c-text-muted)]"
										aria-hidden="true"
										>route</span
									>
									<span class="sr-only">{{ labels().distance }}:</span>
									<span class="tabular-nums">{{ dungeon.distance }} {{ labels().km }}</span>
								</li>
								@for (part of dungeon.loot; track part.id) {
									<li class="flex items-center gap-1" [title]="labels().main">
										<span
											class="material-symbols-outlined text-[18px]"
											[style.color]="part.color"
											aria-hidden="true"
											>{{ part.icon }}</span
										>
										<span class="sr-only">{{ labels().main }}:</span>
										<span>{{ part.label }}</span>
									</li>
								}
							</ul>

							<div class="mt-4 flex items-center justify-between gap-3">
								@if (dungeon.blocked) {
									<p class="text-sm text-[var(--c-text-muted)]">{{ dungeon.blocked }}</p>
								} @else if (dungeon.risk) {
									<p class="flex items-center gap-1 text-sm text-[var(--c-secondary)]">
										<span class="material-symbols-outlined text-[18px]" aria-hidden="true">warning</span>
										<span translate>Ризик загинути</span> {{ dungeon.risk }}%
									</p>
								} @else {
									<p></p>
								}
								<button
									class="btn btn--primary dungeon__send"
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
				</div>
				</div>
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
			position: relative;
			display: flex;
			flex-direction: column;
			justify-content: space-between;

			&:has(.dungeon__link:focus-visible) {
				box-shadow: var(--focus-ring);
			}

			@media (hover: hover) and (pointer: fine) {
				&:hover {
					border-color: var(--c-primary);
				}
			}
		}

		/* Stretched over the card, so a click anywhere on it opens the dungeon. */
		.dungeon__link {
			color: inherit;
			outline: none;

			&::after {
				position: absolute;
				inset: 0;
				border-radius: var(--t-radius-card);
				content: '';
			}
		}

		/* Sits above the stretched link, so it sends the hero instead of opening the page. */
		.dungeon__send {
			position: relative;
			z-index: 1;
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
			distance: t('Відстань'),
			main: t('Можлива здобич'),
			km: t('км'),
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
		const buildings = game.village.buildings ?? {};
		const status = heroStatus(hero, now, buildings);
		const expedition = hero.expedition;
		const fate = heroFate(hero, buildings);
		// While in the infirmary the countdown is to recovery, not to the return.
		const until = status === 'infirmary' ? fate!.recoveredAt : (expedition?.endsAt ?? now);
		const parts = (amounts: Partial<Record<ResourceId, unknown>>) =>
			RESOURCES.filter((r) => amounts[r.id] !== undefined).map((r) => ({
				id: r.id,
				icon: r.icon,
				color: r.color,
				label: t(RESOURCE_BY_ID[r.id].name),
			}));

		return {
			status,
			health: Math.floor(heroHealth(hero, now, buildings)),
			where: expedition ? DUNGEON_BY_ID[expedition.dungeon].name : '',
			left: formatDuration((until - now) / 1000),
			recoveryPlace: buildingLevel(buildings, 'infirmary', now)
				? 'Одужує у шпиталі ще'
				: 'Без шпиталю одужує повільно, ще',
			loot: expedition
				? parts(expedition.loot).map((part) => ({
						...part,
						amount: expedition.loot[part.id]!,
					}))
				: [],
			dungeons: DUNGEONS.map((dungeon) => {
				return {
					...dungeon,
					skulls: [1, 2, 3].map((n) => n <= dungeon.danger),
					dangerLabel: t(DANGER_LABELS[dungeon.danger]),
					// Every kind of loot it can give; the riskier the dungeon, the more kinds.
					loot: lootParts(dungeon, t),
					blocked: blockedLabel(cannotGo(hero, dungeon, now, buildings), t),
					risk: riskPercent(deathChance(hero, dungeon, now, buildings)),
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
