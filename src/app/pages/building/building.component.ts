import { Location } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { BUILDING_BY_ID } from '../../feature/building/building.data';
import { demolishBlocker, demolishRefund, demolishSeconds, lowestLevel } from '../../feature/building/building.demolish';
import { costAtLevel } from '../../feature/building/building.cost';
import {
	buildersBusyUntil,
	buildSeconds,
	formatDuration,
	hallLevel,
	isGone,
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
				<section
					class="t-card mt-6"
					aria-labelledby="building-work"
					aria-live="polite"
				>
					@if (view.running; as running) {
						<h2 id="building-work" class="t-item">
							@if (!running.down) {
								<span translate>Будується рівень</span> {{ running.level }}
							} @else if (running.level) {
								<span translate>Розбирається до рівня</span> {{ running.level }}
							} @else {
								<span translate>Розбирається</span>
							}
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
				@if (view.level) {
					<section class="t-card mt-4" aria-labelledby="building-demolish">
						<h2 id="building-demolish" class="t-item" translate>Розібрати</h2>
						@if (!view.demolish.options.length) {
							<p class="mt-3 text-sm text-[var(--c-text-muted)]" translate>
								Так розібрати не можна.
							</p>
						} @else {
							<label class="sr-only" for="demolish-to" translate>Розібрати</label>
							<select
								id="demolish-to"
								class="writer-input mt-3 w-full"
								(change)="pickDemolish(+$any($event.target).value)"
							>
								@for (option of view.demolish.options; track option.to) {
									<option [value]="option.to" [selected]="option.to === view.demolish.to">
										{{ option.label }}
									</option>
								}
							</select>
							@if (view.demolish.blocker) {
								<p
									class="mt-4 text-sm text-[var(--c-text-muted)]"
									[translate]="view.demolish.blocker"
								>
									{{ view.demolish.blocker }}
								</p>
							} @else {
							<p class="mt-4 text-sm text-[var(--c-text-muted)]" translate>
								Повернеться половина вартості
							</p>
							<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
								<li class="flex items-center gap-1.5" [title]="labels().time">
									<span
										class="material-symbols-outlined text-[20px] text-[var(--c-text-muted)]"
										aria-hidden="true"
										>schedule</span
									>
									<span class="sr-only">{{ labels().time }}:</span>
									<span class="font-semibold tabular-nums">{{ view.demolish.time }}</span>
								</li>
								@for (part of view.demolish.refund; track part.id) {
									<li class="flex items-center gap-1.5" [title]="part.label">
										<span
											class="material-symbols-outlined text-[20px]"
											[style.color]="part.color"
											aria-hidden="true"
											>{{ part.icon }}</span
										>
										<span class="sr-only">{{ part.label }}:</span>
										<span class="font-semibold tabular-nums">+{{ part.amount }}</span>
									</li>
								}
							</ul>
							@if (confirmingDemolish()) {
								<p class="mt-4 text-sm text-[var(--c-secondary)]" translate>
									Це не можна скасувати.
								</p>
								<div class="mt-2 flex flex-wrap gap-3">
									<button
										class="btn btn--primary"
										[disabled]="demolishing()"
										(click)="demolish()"
										type="button"
									>
										<span translate>Підтвердити</span>
									</button>
									<button class="btn" (click)="confirmingDemolish.set(false)" type="button">
										<span translate>Скасувати</span>
									</button>
								</div>
							} @else {
								<button class="btn mt-4" (click)="confirmingDemolish.set(true)" type="button">
									<span class="material-symbols-outlined" aria-hidden="true">delete</span>
									<span translate>Розібрати</span>
								</button>
							}
							@if (demolishFailed()) {
								<p class="mt-2 text-sm text-[var(--c-secondary)]" role="alert" translate>
									Не вдалося розібрати. Спробуйте ще раз.
								</p>
							}
							}
						}
					</section>
				}
				</aside>

				@if (view.type.id === 'marketplace' && view.level) {
					<app-market class="block" />
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
	/** The level the dismantle goes down to; null until the lord picks, then the first choice. */
	protected readonly demolishTo = signal<number | null>(null);
	protected readonly confirmingDemolish = signal(false);
	protected readonly demolishing = signal(false);
	protected readonly demolishFailed = signal(false);
	protected readonly building = computed(
		() => {
			const building = this.state()?.village.buildings?.[this.slot()] ?? null;

			return building && !isGone(building, this._now()) ? building : null;
		},
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

		const t = (text: string) => this._translateService.translate(text)();
		const now = this._now();
		const buildings = this.state()?.village.buildings ?? {};
		const level = levelAt(building, now);
		const running = runningUpgrade(building, now);
		const game = this.state()!;
		const busyUntil = buildersBusyUntil(buildings, now, game.farm.levels ?? {});
		const next = costAtLevel(type.cost, level + 1);
		const lacking = shortfall(this._game.stockNow(game, now), next);

		const options: { to: number; label: string }[] = [];

		for (let to = level - 1; to >= lowestLevel(type.id); to--) {
			options.push({ to, label: to ? `${t('До рівня')} ${to}` : t('Повністю') });
		}

		// Down as far as it goes, unless the lord picked a level.
		const chosen =
			options.find((o) => o.to === this.demolishTo())?.to ?? options[options.length - 1]?.to ?? 0;
		const back = demolishRefund(type.cost, level, chosen);

		return {
			demolish: {
				blocker: demolishBlocker(buildings, this.slot(), chosen, now, game.farm.levels ?? {}),
				time: formatDuration(demolishSeconds(type, level, chosen, hallLevel(buildings, now))),
				options,
				to: chosen,
				refund: RESOURCES.filter((resource) => back[resource.id]).map((resource) => ({
					id: resource.id,
					icon: resource.icon,
					color: resource.color,
					label: this._translateService.translate(resource.name)(),
					amount: back[resource.id]!,
				})),
			},
			type,
			level,
			running: running && {
				level: running.level,
				down: !!running.down,
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

	protected pickDemolish(to: number) {
		this.demolishTo.set(to);
		this.confirmingDemolish.set(false);
	}

	/** Starts taking the building down to the picked level and leaves, as an upgrade does. */
	protected async demolish() {
		const to = this.view()?.demolish.to ?? 0;

		this.demolishing.set(true);
		this.demolishFailed.set(false);

		try {
			await this._game.demolish(Number(this.slot()), to);
			this.confirmingDemolish.set(false);
			this.demolishTo.set(null);
			await this._leave();
		} catch (error) {
			console.error(error);
			this.demolishFailed.set(true);
		} finally {
			this.demolishing.set(false);
		}
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
