import { Location } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { BUILDING_BY_ID } from '../../feature/building/building.data';
import { costAtLevel } from '../../feature/building/building.cost';
import {
	buildersBusyUntil,
	buildSeconds,
	formatDuration,
	hallLevel,
	levelAt,
	nowSignal,
	runningUpgrade,
} from '../../feature/building/building.timing';
import { GameService, GameState } from '../../feature/game/game.service';
import { shortfall } from '../../feature/economy/economy';
import { MarketComponent } from '../../feature/market/market.component';
import { RESOURCES } from '../../feature/resource/resource.data';

/** One building in the village: what it is, its level, and its construction or next upgrade. */
@Component({
	imports: [MarketComponent, TranslateDirective],
	template: `
		<section class="w-full px-4 py-6 sm:px-6 sm:py-8">
			@if (view(); as view) {
				<div class="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
				<aside class="lg:sticky lg:top-6">
				<div class="flex flex-wrap items-center gap-4">
					<span class="building-icon material-symbols-outlined" aria-hidden="true">{{
						view.type.icon
					}}</span>
					<div>
						<h1 class="t-display" [translate]="view.type.name">{{ view.type.name }}</h1>
						<p class="mt-1 t-lead">
							@if (view.level) {
								<span translate>Рівень</span> {{ view.level }}
							} @else {
								<span translate>Будується</span>
							}
						</p>
					</div>
				</div>

				<p class="mt-6 leading-8" [translate]="view.type.description">
					{{ view.type.description }}
				</p>
				</aside>

				<section
					class="t-card max-w-[36rem]"
					aria-labelledby="building-work"
					aria-live="polite"
				>
					@if (view.running; as running) {
						<h2 id="building-work" class="t-item">
							<span translate>Будується рівень</span> {{ running.level }}
						</h2>
						<div
							class="building-progress mt-4"
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax="100"
							[attr.aria-valuenow]="running.percent"
						>
							<div
								class="building-progress__bar"
								[style.width.%]="running.percent"
							></div>
						</div>
						<p class="mt-2 flex items-center gap-1.5 text-[var(--c-text-muted)]">
							<span class="material-symbols-outlined text-[20px]" aria-hidden="true"
								>schedule</span
							>
							<span translate>Залишилось</span>
							<span class="font-semibold tabular-nums text-[var(--c-text-strong)]">{{
								running.left
							}}</span>
						</p>
					} @else {
						<h2 id="building-work" class="t-item">
							<span translate>Покращення до рівня</span> {{ view.level + 1 }}
						</h2>
						<ul
							class="mt-3 flex flex-wrap gap-x-4 gap-y-2"
							[attr.aria-label]="labels().cost"
						>
							@for (part of view.nextCost; track part.id) {
								<li class="flex items-center gap-1.5" [title]="part.label">
									<span
										class="material-symbols-outlined text-[20px]"
										[style.color]="part.color"
										aria-hidden="true"
										>{{ part.icon }}</span
									>
									<span class="sr-only">{{ part.label }}:</span>
									<span
										class="font-semibold tabular-nums"
										[class.cost-short]="part.short"
										>{{ part.amount }}</span
									>
								</li>
							}
							<li class="flex items-center gap-1.5" [title]="labels().time">
								<span
									class="material-symbols-outlined text-[20px] text-[var(--c-text-muted)]"
									aria-hidden="true"
									>schedule</span
								>
								<span class="sr-only">{{ labels().time }}:</span>
								<span class="font-semibold tabular-nums">{{ view.nextTime }}</span>
							</li>
						</ul>
						<button
							class="btn btn--primary mt-5"
							[disabled]="!!view.busyFor || view.short || upgrading()"
							(click)="upgrade()"
							type="button"
						>
							<span class="material-symbols-outlined" aria-hidden="true"
								>upgrade</span
							>
							<span translate>Покращити</span>
						</button>
						@if (view.busyFor) {
							<p class="mt-2 text-sm text-[var(--c-text-muted)]">
								<span translate>Будівельники зайняті ще</span> {{ view.busyFor }}
							</p>
						} @else if (view.short) {
							<p class="mt-2 text-sm text-[var(--c-secondary)]" translate>
								Бракує ресурсів
							</p>
						}
						@if (failed()) {
							<p
								class="mt-2 text-sm text-[var(--c-secondary)]"
								role="alert"
								translate
							>
								Не вдалося почати покращення. Спробуйте ще раз.
							</p>
						}
					}
				</section>
				@if (view.type.id === 'marketplace' && view.level) {
					<app-market class="mt-6 block lg:col-start-2" />
				}
				</div>
			} @else if (missing()) {
				<p class="text-[var(--c-text-muted)]" translate>
					На цьому місці ще нічого не збудовано.
				</p>
			} @else if (error()) {
				<p class="text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося завантажити будівлю. Оновіть сторінку.
				</p>
			} @else {
				<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
	styles: `
		.building-icon {
			display: inline-flex;
			width: 4.5rem;
			height: 4.5rem;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--c-border);
			border-radius: 50%;
			background: var(--c-bg-tertiary);
			color: var(--c-primary-text);
			font-size: 40px;
		}

		.cost-short {
			color: var(--c-secondary);
		}

		.building-progress {
			height: 0.625rem;
			overflow: hidden;
			border-radius: 999px;
			background: var(--c-bg-tertiary);
		}

		.building-progress__bar {
			height: 100%;
			border-radius: inherit;
			background: var(--c-primary);
			transition: width 1s linear;
		}
	`,
})
export class BuildingComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _location = inject(Location);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	/** Village place id, from the route. */
	readonly slot = input.required<string>();

	/** The game from GameService, so an upgrade started here shows at once. */
	protected readonly state = computed<GameState | null>(() => this._game.game());
	protected readonly loaded = signal(false);
	protected readonly error = signal(false);
	protected readonly upgrading = signal(false);
	protected readonly failed = signal(false);
	protected readonly building = computed(
		() => this.state()?.village.buildings?.[this.slot()] ?? null,
	);
	protected readonly missing = computed(() => this.loaded() && !this.building());
	protected readonly labels = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();

		return { cost: t('Вартість'), time: t('Час будівництва') };
	});
	protected readonly view = computed(() => {
		this._languageService.language();
		const building = this.building();
		const type = building && BUILDING_BY_ID[building.type];

		if (!building || !type) {
			return null;
		}

		const now = this._now();
		const buildings = this.state()?.village.buildings ?? {};
		const level = levelAt(building, now);
		const running = runningUpgrade(building, now);
		const game = this.state()!;
		const busyUntil = buildersBusyUntil(buildings, now, game.farm.levels ?? {});
		const next = costAtLevel(type.cost, level + 1);
		const lacking = shortfall(this._game.stockNow(game, now), next);

		return {
			type,
			level,
			running: running && {
				level: running.level,
				left: formatDuration((running.endsAt - now) / 1000),
				percent: Math.round(
					((now - running.startedAt) / (running.endsAt - running.startedAt)) * 100,
				),
			},
			busyFor: busyUntil ? formatDuration((busyUntil - now) / 1000) : '',
			short: Object.keys(lacking).length > 0,
			nextTime: formatDuration(buildSeconds(type, level + 1, hallLevel(buildings, now))),
			nextCost: RESOURCES.filter((resource) => next[resource.id]).map((resource) => ({
				id: resource.id,
				icon: resource.icon,
				color: resource.color,
				label: this._translateService.translate(resource.name)(),
				amount: next[resource.id]!,
				short: !!lacking[resource.id],
			})),
		};
	});

	constructor() {
		void this._load();
	}

	/** Starts the upgrade and leaves at once; the game updates itself when the save lands. */
	protected async upgrade() {
		this.upgrading.set(true);
		this.failed.set(false);

		this._game.upgrade(Number(this.slot())).catch((error) => console.error(error));
		await this._leave();
	}

	/** Back to the page the lord came from; the village when the page was opened directly. */
	private async _leave() {
		if (history.state?.navigationId > 1) {
			this._location.back();
		} else {
			await this._router.navigateByUrl('/village');
		}
	}

	private async _load() {
		try {
			const state = await this._game.load();

			if (state) {
				this.loaded.set(true);
			} else {
				await this._router.navigateByUrl('/onboarding');
			}
		} catch (error) {
			console.error(error);
			this.error.set(true);
		}
	}
}
