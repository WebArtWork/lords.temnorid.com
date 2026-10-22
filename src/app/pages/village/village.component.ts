import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { GameService, GameState } from '../../feature/game/game.service';
import { generateVillage } from '../../feature/village/village.generator';
import { VillageMapComponent } from '../../feature/village/village-map.component';
import { GameHeaderComponent } from '../../layouts/game-header/game-header.component';

/** The lord's village: a generated map with empty places to build on. */
@Component({
	imports: [GameHeaderComponent, TranslateDirective, VillageMapComponent],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			@if (state(); as state) {
				<app-game-header title="Поселення" [lordName]="state.lordName" />

				<div class="game-map-frame mt-6">
					<app-village-map [map]="map()!" [element]="state.element" [(selected)]="selected" />
				</div>

				<div class="mt-4 min-h-14" aria-live="polite">
					@if (selected(); as slot) {
						<p class="t-item">
							<span translate>Вільне місце</span> {{ slot }}
						</p>
						<p class="mt-1 text-[var(--c-text-muted)]" translate>
							Тут постане будівля. Будівництво з'явиться згодом.
						</p>
					} @else {
						<p class="text-[var(--c-text-muted)]" translate>
							Оберіть вільне місце на мапі, щоб побачити, що тут можна звести.
						</p>
					}
				</div>
			} @else if (error()) {
				<p class="text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося завантажити поселення. Оновіть сторінку.
				</p>
			} @else {
				<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
})
export class VillageComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);

	protected readonly state = signal<GameState | null>(null);
	protected readonly error = signal(false);
	protected readonly selected = signal<number | null>(null);
	protected readonly map = computed(() => {
		const state = this.state();

		return state
			? generateVillage(state.village.seed, state.element, state.region, state.village.slots)
			: null;
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
