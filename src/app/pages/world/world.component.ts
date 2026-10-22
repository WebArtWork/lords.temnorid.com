import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { GameService, GameState } from '../../feature/game/game.service';
import { Point } from '../../feature/map/map-geometry';
import { REGIONS } from '../../feature/region/region.data';
import { RESOURCE_BY_ID, RESOURCES } from '../../feature/resource/resource.data';
import { isExplored, quadrantOf, terrainAt } from '../../feature/world/world.generator';
import { WorldState } from '../../feature/world/world.interface';
import { WorldMapComponent } from '../../feature/world/world-map.component';
import { WorldService } from '../../feature/world/world.service';
import { GameHeaderComponent } from '../../layouts/game-header/game-header.component';

/** Names of the land a resource comes from, as it appears on the world map. */
const RESOURCE_LAND: Record<string, string> = {
	wood: 'Ліс',
	stone: 'Каменоломня',
	iron: 'Залізна руда',
	water: 'Озеро',
	grain: 'Нива',
	clay: 'Глинище',
};

/** The shared world: every lord's village on one grid, growing outward quarter by quarter. */
@Component({
	imports: [GameHeaderComponent, TranslateDirective, WorldMapComponent],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			@if (game(); as game) {
				<app-game-header title="Світ" [lordName]="game.lordName" />

				@if (world(); as world) {
					<div class="mt-6 flex flex-wrap items-end gap-3">
						<button class="btn" (click)="goHome()" type="button">
							<span class="material-symbols-outlined" aria-hidden="true">my_location</span>
							<span translate>Моє поселення</span>
						</button>
						<form class="flex flex-wrap items-end gap-2" (submit)="$event.preventDefault(); jump()">
							<label class="block">
								<span class="writer-label">X</span>
								<input class="writer-input w-24" inputmode="numeric" name="x" type="number" [value]="jumpX()" (input)="jumpX.set($any($event.target).value)" />
							</label>
							<label class="block">
								<span class="writer-label">Y</span>
								<input class="writer-input w-24" inputmode="numeric" name="y" type="number" [value]="jumpY()" (input)="jumpY.set($any($event.target).value)" />
							</label>
							<button class="btn" type="submit">
								<span class="material-symbols-outlined" aria-hidden="true">travel_explore</span>
								<span translate>Перейти</span>
							</button>
						</form>
					</div>

					<div class="world-frame mt-4">
						<app-world-map
							[counts]="world.counts"
							[villages]="world.villages"
							[mineUid]="world.mine.uid"
							[(centre)]="centre"
							[(selected)]="selected"
						/>
					</div>

					<div class="mt-4 min-h-20" aria-live="polite">
						<p class="t-item">
							{{ tileInfo().title }}
							<span class="t-numeral ml-2 text-lg tabular-nums">({{ selected().x }}|{{ selected().y }})</span>
						</p>
						@if (tileInfo().detail) {
							<p class="mt-1 text-[var(--c-text-muted)]">{{ tileInfo().detail }}</p>
						}
						<p class="mt-1 text-sm text-[var(--c-text-muted)]">
							<span translate>Чверть світу</span>: {{ tileInfo().quarter }}
						</p>
					</div>

					<ul class="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm" [translate]="{ ariaLabel: 'Умовні позначки' }">
						@for (resource of resources; track resource.id) {
							<li class="flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[18px]" [style.color]="resource.color" aria-hidden="true">{{ resource.icon }}</span>
								<span [translate]="land[resource.id]">{{ land[resource.id] }}</span>
							</li>
						}
					</ul>
				} @else if (worldError()) {
					<p class="mt-6 text-[var(--c-secondary)]" role="alert" translate>
						Не вдалося завантажити світ. Оновіть сторінку.
					</p>
				} @else {
					<p class="mt-6 text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
				}
			} @else if (error()) {
				<p class="text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося завантажити світ. Оновіть сторінку.
				</p>
			} @else {
				<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
	styles: `
		.world-frame {
			overflow: hidden;
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius-card);
			box-shadow: var(--shadow-md);
		}
	`,
})
export class WorldComponent {
	private readonly _game = inject(GameService);
	private readonly _world = inject(WorldService);
	private readonly _router = inject(Router);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	protected readonly resources = RESOURCES;
	protected readonly land = RESOURCE_LAND;
	protected readonly game = signal<GameState | null>(null);
	protected readonly world = signal<WorldState | null>(null);
	protected readonly error = signal(false);
	protected readonly worldError = signal(false);
	protected readonly centre = signal<Point>({ x: 0, y: 0 });
	protected readonly selected = signal<Point>({ x: 0, y: 0 });
	protected readonly jumpX = signal('0');
	protected readonly jumpY = signal('0');

	/** Plain-language description of the selected tile, in the reader's language. */
	protected readonly tileInfo = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();
		const world = this.world();
		const { x, y } = this.selected();
		const quarter = t(REGIONS.find((region) => region.id === quadrantOf(x, y))!.name);

		if (!world) {
			return { title: '', detail: '', quarter };
		}

		if (!isExplored(x, y, world.counts)) {
			return {
				title: t('Ще не відкриті землі'),
				detail: t('Світ розширюється, коли в цю чверть приходять нові лорди.'),
				quarter,
			};
		}

		const village = world.villages.find((v) => v.x === x && v.y === y);

		if (village) {
			return {
				title: village.uid === world.mine.uid ? t('Ваше поселення') : `${village.lordName}`,
				detail: village.uid === world.mine.uid ? '' : t('Поселення іншого лорда'),
				quarter,
			};
		}

		const terrain = terrainAt(x, y);

		if (terrain === 'heart') {
			return { title: t('Серце світу'), detail: t('Звідси світ почав рости.'), quarter };
		}

		if (terrain === 'grass') {
			return { title: t('Вільна земля'), detail: '', quarter };
		}

		return { title: t(RESOURCE_LAND[terrain]!), detail: t(RESOURCE_BY_ID[terrain].name), quarter };
	});

	constructor() {
		void this._load();
	}

	protected goHome() {
		const mine = this.world()?.mine;

		if (mine) {
			this.centre.set({ x: mine.x, y: mine.y });
			this.selected.set({ x: mine.x, y: mine.y });
		}
	}

	protected jump() {
		const x = Math.round(Number(this.jumpX()));
		const y = Math.round(Number(this.jumpY()));

		if (Number.isFinite(x) && Number.isFinite(y)) {
			this.centre.set({ x, y });
			this.selected.set({ x, y });
		}
	}

	private async _load() {
		let game: GameState | null;

		try {
			game = await this._game.load();
		} catch (error) {
			console.error(error);
			this.error.set(true);
			return;
		}

		if (!game) {
			await this._router.navigateByUrl('/onboarding');
			return;
		}

		this.game.set(game);

		try {
			this.world.set(await this._world.load(game));
			this.goHome();
		} catch (error) {
			console.error(error);
			this.worldError.set(true);
		}
	}
}
