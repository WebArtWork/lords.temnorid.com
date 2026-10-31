import { Location } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { costAtLevel } from '../../feature/building/building.cost';
import {
	buildersBusyUntil,
	buildSeconds,
	formatDuration,
	hallLevel,
	levelAt,
	nowSignal,
	runningUpgrade,
	targetLevel,
	workEndsAt,
} from '../../feature/building/building.timing';
import {
	PLOT_COST,
	plotProduction,
	shortfall,
} from '../../feature/economy/economy';
import { GameService, GameState } from '../../feature/game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../../feature/resource/resource.data';

/**
 * One plot of the farm, Travian's resource field: what it yields each hour and what working it to
 * the next level costs. Plots start at level 0 and share the village's builders.
 */
@Component({
	imports: [TranslateDirective],
	template: `
		<section class="w-full px-4 py-6 sm:px-6 sm:py-8">
			@if (view(); as view) {
				<div class="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
				<aside class="lg:sticky lg:top-6">
				<div class="flex flex-wrap items-center gap-4">
					<span
						class="plot-icon material-symbols-outlined"
						[style.color]="view.resource.color"
						aria-hidden="true"
						>{{ view.resource.icon }}</span
					>
					<div>
						<h1 class="t-display" [translate]="view.resource.name">
							{{ view.resource.name }}
						</h1>
						<p class="mt-1 t-lead"><span translate>Рівень</span> {{ view.level }}</p>
					</div>
				</div>

				<p class="mt-6 flex items-center gap-2 text-lg">
					<span translate>Видобуток</span>
					<span class="font-semibold tabular-nums">{{ view.perHour }}</span>
					<span translate>за годину</span>
				</p>

				<section
					class="t-card mt-6"
					aria-labelledby="plot-work"
					aria-live="polite"
				>
					@if (view.running; as running) {
						<h2 id="plot-work" class="t-item">
							<span translate>Покращується до рівня</span> {{ running.level }}
						</h2>
						<div
							class="plot-progress mt-4"
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax="100"
							[attr.aria-valuenow]="running.percent"
						>
							<div class="plot-progress__bar" [style.width.%]="running.percent"></div>
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
					}

						@if (view.nextLevel) {
						<h2 [attr.id]="view.running ? null : 'plot-work'" class="t-item" [class.mt-6]="!!view.running">
							<span translate>Покращення до рівня</span> {{ view.nextLevel }}
						</h2>
						<p class="mt-1 text-sm text-[var(--c-text-muted)]">
							<span translate>Видобуток</span> {{ view.nextPerHour }}
							<span translate>за годину</span>
						</p>
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
				</aside>
				</div>
			} @else if (missing()) {
				<p class="text-[var(--c-text-muted)]" translate>
					Такої ділянки немає у ваших угіддях.
				</p>
			} @else if (error()) {
				<p class="text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося завантажити угіддя. Оновіть сторінку.
				</p>
			} @else {
				<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
	styles: `
		.plot-icon {
			display: inline-flex;
			width: 4.5rem;
			height: 4.5rem;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--c-border);
			border-radius: 50%;
			background: var(--c-bg-tertiary);
			font-size: 40px;
		}

		.cost-short {
			color: var(--c-secondary);
		}

		.plot-progress {
			height: 0.625rem;
			overflow: hidden;
			border-radius: 999px;
			background: var(--c-bg-tertiary);
		}

		.plot-progress__bar {
			height: 100%;
			border-radius: inherit;
			background: var(--c-primary);
			transition: width 1s linear;
		}
	`,
})
export class PlotComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _location = inject(Location);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	/** Farm plot id, from the route. */
	readonly id = input.required<string>();

	/** The game from GameService, so work started here shows at once. */
	protected readonly state = computed<GameState | null>(() => this._game.game());
	protected readonly loaded = signal(false);
	protected readonly error = signal(false);
	protected readonly upgrading = signal(false);
	protected readonly failed = signal(false);
	protected readonly plot = computed(
		() => this.state()?.farm.plots.find((plot) => String(plot.id) === this.id()) ?? null,
	);
	protected readonly missing = computed(() => this.loaded() && !this.plot());
	protected readonly labels = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();

		return { cost: t('Вартість'), time: t('Час будівництва') };
	});
	protected readonly view = computed(() => {
		this._languageService.language();
		const game = this.state();
		const plot = this.plot();

		if (!game || !plot) {
			return null;
		}

		const now = this._now();
		const levels = game.farm.levels ?? {};
		const saved = levels[plot.id] ?? { level: 0 };
		const level = levelAt(saved, now);
		const running = runningUpgrade(saved, now);
		const buildings = game.village.buildings ?? {};
		const busyUntil = buildersBusyUntil(buildings, now, levels);
		// Work already running carries on with its builder, so more levels only join the queue.
		const target = targetLevel(saved, now);
		const next = costAtLevel(PLOT_COST, target + 1);
		const lacking = shortfall(this._game.stockNow(game, now), next);

		return {
			resource: RESOURCE_BY_ID[plot.resource],
			level,
			perHour: plotProduction(level),
			nextPerHour: plotProduction(target + 1),
			running: running && {
				level: target,
				left: formatDuration((workEndsAt(saved, now) - now) / 1000),
				percent: Math.round(
					((now - running.startedAt) / (running.endsAt - running.startedAt)) * 100,
				),
			},
			busyFor: !running && busyUntil ? formatDuration((busyUntil - now) / 1000) : '',
			nextLevel: target + 1,
			short: Object.keys(lacking).length > 0,
			nextTime: formatDuration(
				buildSeconds({ cost: PLOT_COST }, target + 1, hallLevel(buildings, now)),
			),
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

		this._game.upgradePlot(Number(this.id())).catch((error) => console.error(error));
		await this._leave();
	}

	/** Back to the page the lord came from; the farm when the page was opened directly. */
	private async _leave() {
		if (history.state?.navigationId > 1) {
			this._location.back();
		} else {
			await this._router.navigateByUrl('/farm');
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
