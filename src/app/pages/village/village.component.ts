import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { ModalService } from '@wawjs/ngx-ui';
import { BuildingId, CENTER_PLACE } from '../../feature/building/building.interface';
import { nowSignal } from '../../feature/building/building.timing';
import { farmSurroundings } from '../../feature/farm/farm.generator';
import { farmLand } from '../../feature/farm/farm.land';
import { GameService, GameState } from '../../feature/game/game.service';
import { generateVillage, villageSlots } from '../../feature/village/village.generator';
import { VillageMapComponent } from '../../feature/village/village-map.component';
import { VillageSlotModalComponent } from '../../feature/village/village-slot-modal.component';
import { GameHeaderComponent } from '../../layouts/game-header/game-header.component';

/** The lord's village: a generated map with empty places to build on. */
@Component({
	imports: [GameHeaderComponent, TranslateDirective, VillageMapComponent],
	template: `
		@if (state(); as state) {
			<section class="h-full">
				<app-game-header title="Поселення" />
				<!-- Fills everything under the top bar; the map keeps every place in view. -->
				<app-village-map
					class="h-full"
					[map]="map()!"
					[element]="state.element"
					[fill]="true"
					[buildings]="state.village.buildings ?? {}"
					[now]="now()"
					[(selected)]="selected"
				/>
			</section>
		} @else {
			<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				@if (error()) {
					<p class="text-[var(--c-secondary)]" role="alert" translate>
						Не вдалося завантажити поселення. Оновіть сторінку.
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
export class VillageComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _modal = inject(ModalService);

	protected readonly state = signal<GameState | null>(null);
	protected readonly error = signal(false);
	protected readonly selected = signal<number | null>(null);
	protected readonly now = nowSignal();
	protected readonly map = computed(() => {
		const state = this.state();

		return state
			? generateVillage(
					state.village.seed,
					state.element,
					state.region,
					villageSlots(state.village),
					// The land beyond the walls is the lord's farm.
					farmSurroundings(
						state.farm.seed,
						state.farm.plots,
						state.farm.at ? farmLand(state.farm.at) : null,
					),
				)
			: null;
	});

	constructor() {
		void this._load();

		// A built place opens its building; a free one opens what can stand there.
		effect(() => {
			const slot = this.selected();

			if (slot !== null) {
				untracked(() => this._openSlot(slot));
			}
		});
	}

	private _openSlot(slot: number) {
		const buildings = this.state()?.village.buildings ?? {};

		if (buildings[slot]) {
			void this._router.navigate(['/building', slot]);
			return;
		}

		this._modal.show({
			component: VillageSlotModalComponent,
			size: 'big',
			game: this.state(),
			center: slot === CENTER_PLACE,
			build: (type: BuildingId) => this._build(slot, type),
			ariaLabelledBy: 'village-slot-modal-title',
			// Closing lets go of the place.
			onClose: () => this.selected.set(null),
		});
	}

	/** Raises the building; the modal closes and the lord stays on the village. */
	private async _build(slot: number, type: BuildingId) {
		await this._game.build(slot, type);
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
