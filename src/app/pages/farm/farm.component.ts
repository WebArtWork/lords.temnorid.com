import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { farmResourceCounts, FARM_MIN_PER_RESOURCE, generateFarm } from '../../feature/farm/farm.generator';
import { FarmMapComponent } from '../../feature/farm/farm-map.component';
import { GameService, GameState } from '../../feature/game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../../feature/resource/resource.data';
import { GameHeaderComponent } from '../../layouts/game-header/game-header.component';

/** At or above this many plots a resource counts as plentiful on this farm. */
const PLENTIFUL = 5;

/** The land outside the village: plots that yield the six resources. */
@Component({
	imports: [FarmMapComponent, GameHeaderComponent, TranslateDirective],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			@if (state(); as state) {
				<app-game-header title="Угіддя" [lordName]="state.lordName" />

				<div class="game-map-frame mt-6">
					<app-farm-map [map]="map()!" [(selected)]="selected" />
				</div>

				<div class="mt-4 min-h-14" aria-live="polite">
					@if (selectedPlot(); as plot) {
						<p class="t-item">
							<span [translate]="resources[plot.resource].name">{{ resources[plot.resource].name }}</span>,
							<span translate>ділянка</span> {{ plot.id }}
						</p>
						<p class="mt-1 text-[var(--c-text-muted)]" translate>Видобуток з'явиться згодом.</p>
					} @else {
						<p class="text-[var(--c-text-muted)]" translate>
							Оберіть ділянку на мапі. Чого бракує, можна буде виміняти в інших лордів.
						</p>
					}
				</div>

				<h2 class="mt-10 t-heading" translate>Ваші угіддя</h2>
				<ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					@for (row of summary(); track row.id) {
						<li class="t-card flex items-center gap-3">
							<span
								class="material-symbols-outlined resource-icon"
								[style.color]="row.color"
								aria-hidden="true"
							>
								{{ row.icon }}
							</span>
							<span class="flex-1">
								<span class="t-item block" [translate]="row.name">{{ row.name }}</span>
								@switch (row.level) {
									@case ('plentiful') {
										<span class="text-sm text-[var(--c-primary-text)]" translate>Багато</span>
									}
									@case ('scarce') {
										<span class="text-sm text-[var(--c-secondary)]" translate>Мало</span>
									}
									@case ('normal') {
										<span class="text-sm text-[var(--c-text-muted)]" translate>Достатньо</span>
									}
								}
							</span>
							<span class="t-numeral text-2xl tabular-nums">{{ row.count }}</span>
						</li>
					}
				</ul>
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
		.resource-icon {
			font-size: 32px;
		}
	`,
})
export class FarmComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);

	protected readonly resources = RESOURCE_BY_ID;
	protected readonly state = signal<GameState | null>(null);
	protected readonly error = signal(false);
	protected readonly selected = signal<number | null>(null);
	protected readonly map = computed(() => {
		const state = this.state();

		return state
			? generateFarm(state.farm.seed, state.element, state.region, state.farm.plots)
			: null;
	});
	protected readonly selectedPlot = computed(
		() => this.state()?.farm.plots.find((plot) => plot.id === this.selected()) ?? null,
	);
	/** Plots per resource, most first, so the farm's speciality leads. */
	protected readonly summary = computed(() => {
		const plots = this.state()?.farm.plots ?? [];
		const counts = farmResourceCounts(plots);

		return RESOURCES.map((resource) => {
			const count = counts[resource.id];
			const level: 'plentiful' | 'scarce' | 'normal' =
				count >= PLENTIFUL ? 'plentiful' : count <= FARM_MIN_PER_RESOURCE ? 'scarce' : 'normal';

			return { ...resource, count, level };
		}).sort((a, b) => b.count - a.count);
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
