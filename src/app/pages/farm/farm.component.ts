import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { ModalService } from '@wawjs/ngx-ui';
import { generateFarm } from '../../feature/farm/farm.generator';
import { FarmMapComponent } from '../../feature/farm/farm-map.component';
import { FarmPlotModalComponent } from '../../feature/farm/farm-plot-modal.component';
import { GameService, GameState } from '../../feature/game/game.service';
import { GameHeaderComponent } from '../../layouts/game-header/game-header.component';

/** The land outside the village: plots that yield the six resources. */
@Component({
	imports: [FarmMapComponent, GameHeaderComponent, TranslateDirective],
	template: `
		@if (state(); as state) {
			<section class="h-full">
				<app-game-header title="Угіддя" />
				<!-- Fills everything under the top bar; the map keeps every plot in view. -->
				<app-farm-map class="h-full" [map]="map()!" [fill]="true" [(selected)]="selected" />
			</section>
		} @else {
			<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				@if (error()) {
					<p class="text-[var(--c-secondary)]" role="alert" translate>
						Не вдалося завантажити угіддя. Оновіть сторінку.
					</p>
				} @else {
					<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
				}
			</section>
		}
	`,
	styles: `
		:host {
			display: block;
			height: 100%;
		}
	`,
})
export class FarmComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _modal = inject(ModalService);

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
	constructor() {
		void this._load();

		// Picking a plot opens what it yields; closing the modal lets go of the plot.
		effect(() => {
			const plot = this.selectedPlot();

			if (plot) {
				untracked(() =>
					this._modal.show({
						component: FarmPlotModalComponent,
						size: 'small',
						plot,
						ariaLabelledBy: 'farm-plot-modal-title',
						onClose: () => this.selected.set(null),
					}),
				);
			}
		});
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
