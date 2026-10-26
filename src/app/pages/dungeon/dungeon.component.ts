import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { buildingLevel, formatDuration, nowSignal } from '../../feature/building/building.timing';
import { DUNGEON_BY_ID, DungeonId } from '../../feature/dungeon/dungeon.data';
import {
	blockedLabel,
	DANGER_LABELS,
	lootParts,
	riskPercent,
} from '../../feature/dungeon/dungeon.view';
import {
	cannotGo,
	deathChance,
	HERO_MAX_HEALTH,
	heroFate,
	heroHealth,
	heroStatus,
	recoveryHours,
} from '../../feature/dungeon/hero';
import { GameService } from '../../feature/game/game.service';
import { GameHeaderComponent } from '../../layouts/game-header/game-header.component';

/** One dungeon: what lies there, what it costs the hero, and what it can bring back. */
@Component({
	imports: [GameHeaderComponent, RouterLink, TranslateDirective],
	template: `
		<section class="w-full px-4 py-6 sm:px-6 sm:py-8">
			@if (view(); as view) {
				<app-game-header [title]="view.name" />
				<div class="mt-2 grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
				<header class="lg:sticky lg:top-6">
					<div class="flex items-start justify-between gap-3">
						<p class="t-display" aria-hidden="true">{{ view.name }}</p>
						<span class="dungeon-danger" [attr.aria-label]="view.dangerLabel" [title]="view.dangerLabel">
							@for (skull of view.skulls; track $index) {
								<span class="material-symbols-outlined" [class.dungeon-danger__on]="skull" aria-hidden="true">skull</span>
							}
						</span>
					</div>
					<p class="mt-3 t-lead">{{ view.description }}</p>

					@if (view.blocked) {
						<p class="mt-4 text-sm text-[var(--c-text-muted)]" aria-live="polite">{{ view.blocked }}</p>
					} @else if (view.risk) {
						<p class="dungeon-risk mt-4" role="note">
							<span class="material-symbols-outlined" aria-hidden="true">warning</span>
							<span>
								<span translate>Ризик загинути</span>: <strong class="tabular-nums">{{ view.risk }}%</strong>.
								<span translate>Загиблий герой втрачає здобич і одужує у шпиталі.</span>
							</span>
						</p>
					}

					<div class="mt-4 flex flex-wrap gap-3">
						<button class="btn btn--primary" [disabled]="!!view.blocked || working()" (click)="send()" type="button">
							<span class="material-symbols-outlined" aria-hidden="true">explore</span>
							<span translate>Вирушити</span>
						</button>
						@if (view.back) {
							<button class="btn" [disabled]="working()" (click)="collect()" type="button">
								<span class="material-symbols-outlined" aria-hidden="true">inventory_2</span>
								<span translate>Забрати здобич</span>
							</button>
						}
					</div>

					@if (failed()) {
						<p class="mt-3 text-[var(--c-secondary)]" role="alert" translate>Не вдалося. Спробуйте ще раз.</p>
					}
				</header>

				<div class="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] items-start gap-4">
					<section class="t-card" aria-labelledby="dungeon-way">
						<h2 id="dungeon-way" class="t-item" translate>Дорога</h2>
						<dl class="mt-3 grid gap-2">
							<div class="dungeon-fact">
								<dt><span class="material-symbols-outlined" aria-hidden="true">route</span><span translate>Відстань</span></dt>
								<dd class="tabular-nums">{{ view.distance }} {{ view.km }}</dd>
							</div>
							<div class="dungeon-fact">
								<dt><span class="material-symbols-outlined" aria-hidden="true">schedule</span><span translate>Туди й назад</span></dt>
								<dd class="tabular-nums">{{ view.duration }}</dd>
							</div>
							<div class="dungeon-fact">
								<dt><span class="material-symbols-outlined" aria-hidden="true">heart_broken</span><span translate>Герой втратить</span></dt>
								<dd class="tabular-nums">{{ view.damage }} <span translate>здоров'я</span></dd>
							</div>
							<div class="dungeon-fact">
								<dt><span class="material-symbols-outlined" aria-hidden="true">local_hospital</span><span translate>Якщо загине</span></dt>
								<dd class="tabular-nums">{{ view.recovery }}</dd>
							</div>
						</dl>
						<a class="t-link mt-4" routerLink="/world" [queryParams]="{ dungeon: view.id }">
							<span class="material-symbols-outlined text-[18px]" aria-hidden="true">map</span>
							<span translate>Показати на мапі світу</span>
						</a>
					</section>

					<section class="t-card" aria-labelledby="dungeon-loot">
						<h2 id="dungeon-loot" class="t-item" translate>Можлива здобич</h2>
						<ul class="mt-3 grid gap-2">
							@for (part of view.loot; track part.id) {
								<li class="dungeon-fact">
									<span class="flex items-center gap-2">
										<span class="material-symbols-outlined" [style.color]="part.color" aria-hidden="true">{{ part.icon }}</span>
										<span>{{ part.label }}</span>
									</span>
									<span class="tabular-nums">{{ part.min }}–{{ part.max }}</span>
								</li>
							}
						</ul>
						<p class="mt-3 text-sm text-[var(--c-text-muted)]" translate>
							Що саме принесе герой, вирішується, коли він вирушає.
						</p>
					</section>
				</div>
				</div>
			} @else if (missing()) {
				<p class="mt-6" role="alert" translate>Такої темниці немає.</p>
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
		.dungeon-danger {
			display: inline-flex;
			color: var(--c-border);

			.material-symbols-outlined {
				font-size: 28px;
			}
		}

		.dungeon-danger__on {
			color: var(--c-secondary);
		}

		.dungeon-fact {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;

			dt {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				color: var(--c-text-muted);
			}

			dd {
				color: var(--c-text-strong);
				font-weight: 600;
			}

			.material-symbols-outlined {
				font-size: 20px;
			}
		}

		.dungeon-risk {
			display: flex;
			gap: 0.5rem;
			color: var(--c-secondary);
			font-size: 0.95rem;

			.material-symbols-outlined {
				font-size: 20px;
			}
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
	`,
})
export class DungeonComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	/** From the route: /dungeons/:id. */
	readonly id = input.required<string>();

	protected readonly maxHealth = HERO_MAX_HEALTH;
	protected readonly error = signal(false);
	protected readonly working = signal(false);
	protected readonly failed = signal(false);
	protected readonly missing = computed(() => !DUNGEON_BY_ID[this.id() as DungeonId]);

	protected readonly view = computed(() => {
		this._languageService.language();
		const game = this._game.game();
		const dungeon = DUNGEON_BY_ID[this.id() as DungeonId];

		if (!game || !dungeon) {
			return null;
		}

		const t = (text: string) => this._translateService.translate(text)();
		const now = this._now();
		const hero = game.hero;
		const buildings = game.village.buildings ?? {};
		const status = heroStatus(hero, now, buildings);
		const expedition = hero.expedition;
		const here = expedition?.dungeon === dungeon.id;
		const fate = heroFate(hero, buildings);
		const until = status === 'infirmary' ? fate!.recoveredAt : (expedition?.endsAt ?? now);

		return {
			id: dungeon.id,
			name: t(dungeon.name),
			description: t(dungeon.description),
			skulls: [1, 2, 3].map((n) => n <= dungeon.danger),
			dangerLabel: t(DANGER_LABELS[dungeon.danger]),
			distance: dungeon.distance,
			km: t('км'),
			duration: formatDuration(dungeon.minutes * 60),
			damage: `${dungeon.damage[0]}–${dungeon.damage[1]}`,
			// What a fall would cost with the infirmary as it stands now.
			recovery: formatDuration(recoveryHours(buildingLevel(buildings, 'infirmary', now)) * 3600),
			loot: lootParts(dungeon, t),
			health: Math.floor(heroHealth(hero, now, buildings)),
			healthLabel: t("Здоров'я героя"),
			awayHere: here && status === 'away',
			inInfirmary: status === 'infirmary',
			left: formatDuration((until - now) / 1000),
			risk: riskPercent(deathChance(hero, dungeon, now, buildings)),
			back: status === 'back',
			blocked: blockedLabel(cannotGo(hero, dungeon, now, buildings), t),
		};
	});

	constructor() {
		void this._load();
	}

	protected async send() {
		await this._act(() => this._game.sendHero(this.id() as DungeonId));
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
