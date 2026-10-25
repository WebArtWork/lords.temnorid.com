import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { costAtLevel } from '../../feature/building/building.cost';
import { GameService, GameState } from '../../feature/game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../../feature/resource/resource.data';
import { ResourceId } from '../../feature/resource/resource.interface';

/** What the first level of any plot costs, as a Travian resource field does. */
const PLOT_COST: Partial<Record<ResourceId, number>> = { wood: 40, stone: 50, clay: 60, grain: 30 };

/**
 * One plot of the farm, Travian's resource field: what it yields and what working it harder will
 * cost. Plots start untended, at level 0.
 */
@Component({
	imports: [RouterLink, TranslateDirective],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			<a class="btn" routerLink="/farm">
				<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
				<span translate>До угідь</span>
			</a>

			@if (view(); as view) {
				<div class="mt-6 flex flex-wrap items-center gap-4">
					<span
						class="plot-icon material-symbols-outlined"
						[style.color]="view.resource.color"
						aria-hidden="true"
						>{{ view.resource.icon }}</span
					>
					<div>
						<h1 class="t-display">
							<span [translate]="view.resource.name">{{ view.resource.name }}</span>
						</h1>
						<p class="mt-1 t-lead">
							<span translate>Ділянка</span> {{ id() }} ·
							<span translate>Рівень</span> {{ view.level }}
						</p>
					</div>
				</div>

				<p class="mt-6 max-w-[var(--reading)] leading-8" translate>
					Ділянка дає один ресурс. Що вищий її рівень, то більше вона приносить щогодини.
				</p>

				<section class="mt-8 max-w-[36rem] t-card" aria-labelledby="plot-upgrade">
					<h2 id="plot-upgrade" class="t-item">
						<span translate>Покращення до рівня</span> {{ view.level + 1 }}
					</h2>
					<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-2" [attr.aria-label]="costLabel()">
						@for (part of view.nextCost; track part.id) {
							<li class="flex items-center gap-1.5" [title]="part.label">
								<span
									class="material-symbols-outlined text-[20px]"
									[style.color]="part.color"
									aria-hidden="true"
									>{{ part.icon }}</span
								>
								<span class="sr-only">{{ part.label }}:</span>
								<span class="font-semibold tabular-nums">{{ part.amount }}</span>
							</li>
						}
					</ul>
					<button class="btn btn--primary mt-5" disabled type="button">
						<span class="material-symbols-outlined" aria-hidden="true">upgrade</span>
						<span translate>Покращити</span>
					</button>
					<p class="mt-2 text-sm text-[var(--c-text-muted)]" translate>
						Покращення з'явиться разом із запасами ресурсів.
					</p>
				</section>
			} @else if (missing()) {
				<p class="mt-6 text-[var(--c-text-muted)]" translate>
					Такої ділянки немає у ваших угіддях.
				</p>
			} @else if (error()) {
				<p class="mt-6 text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося завантажити угіддя. Оновіть сторінку.
				</p>
			} @else {
				<p class="mt-6 text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
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
	`,
})
export class PlotComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	/** Farm plot id, from the route. */
	readonly id = input.required<string>();

	protected readonly state = signal<GameState | null>(null);
	protected readonly error = signal(false);
	protected readonly plot = computed(
		() => this.state()?.farm.plots.find((plot) => String(plot.id) === this.id()) ?? null,
	);
	protected readonly missing = computed(() => !!this.state() && !this.plot());
	protected readonly costLabel = computed(() => {
		this._languageService.language();
		return this._translateService.translate('Вартість')();
	});
	protected readonly view = computed(() => {
		this._languageService.language();
		const plot = this.plot();

		if (!plot) {
			return null;
		}

		const level = 0;
		const next = costAtLevel(PLOT_COST, level + 1);

		return {
			resource: RESOURCE_BY_ID[plot.resource],
			level,
			nextCost: RESOURCES.filter((resource) => next[resource.id]).map((resource) => ({
				id: resource.id,
				icon: resource.icon,
				color: resource.color,
				label: this._translateService.translate(resource.name)(),
				amount: next[resource.id]!,
			})),
		};
	});

	constructor() {
		void this._load();
	}

	private async _load() {
		try {
			const state = await this._game.load();

			if (state) {
				this.state.set(state);
			} else {
				await this._router.navigateByUrl('/onboarding');
			}
		} catch (error) {
			console.error(error);
			this.error.set(true);
		}
	}
}
