import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { ModalService } from '@wawjs/ngx-ui';
import { GameService, GameState } from '../../feature/game/game.service';
import { Point } from '../../feature/map/map-geometry';
import { REGIONS } from '../../feature/region/region.data';
import { RESOURCE_BY_ID } from '../../feature/resource/resource.data';
import { cityAt, geoAt, WorldCity } from '../../feature/world/world.geography';
import { isExplored, quadrantOf, terrainAt } from '../../feature/world/world.generator';
import { WorldCitiesModalComponent } from '../../feature/world/world-cities-modal.component';
import { WorldJumpModalComponent } from '../../feature/world/world-jump-modal.component';
import {
	WorldTileInfo,
	WorldTileModalComponent,
} from '../../feature/world/world-tile-modal.component';
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

/** The shared world: every lord's village on one grid, filling the window under the top bar. */
@Component({
	imports: [GameHeaderComponent, TranslateDirective, WorldMapComponent],
	template: `
		@if (world(); as world) {
			<section class="h-full">
				<app-game-header title="Світ" />
				<app-world-map
					class="h-full"
					[counts]="world.counts"
					[villages]="world.villages"
					[mineUid]="world.mine.uid"
					[(centre)]="centre"
					[(selected)]="selected"
					[(zoom)]="zoom"
					(home)="goHome()"
					(navigate)="openJump()"
					(cities)="openCities()"
					(pick)="openTile($event)"
				/>
			</section>
		} @else {
			<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				@if (error()) {
					<p class="text-[var(--c-secondary)]" role="alert" translate>
						Не вдалося завантажити світ. Оновіть сторінку.
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
export class WorldComponent {
	private readonly _game = inject(GameService);
	private readonly _world = inject(WorldService);
	private readonly _router = inject(Router);
	private readonly _modal = inject(ModalService);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	protected readonly world = signal<WorldState | null>(null);
	protected readonly error = signal(false);
	protected readonly centre = signal<Point>({ x: 0, y: 0 });
	protected readonly selected = signal<Point>({ x: 0, y: 0 });
	protected readonly zoom = signal(0);

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

	protected openJump() {
		this._modal.show({
			component: WorldJumpModalComponent,
			size: 'small',
			from: this.selected(),
			go: (point: Point) => this._goTo(point),
			ariaLabelledBy: 'world-jump-modal-title',
		});
	}

	protected openCities() {
		this._modal.show({
			component: WorldCitiesModalComponent,
			size: 'mid',
			go: (city: WorldCity) => this._goTo(city),
			ariaLabelledBy: 'world-cities-modal-title',
		});
	}

	protected openTile(point: Point) {
		const info = this._describe(point);

		if (info) {
			this._modal.show({
				component: WorldTileModalComponent,
				size: 'small',
				info,
				ariaLabelledBy: 'world-tile-modal-title',
			});
		}
	}

	/** Plain-language description of a tile, in the reader's language. */
	private _describe({ x, y }: Point): WorldTileInfo | null {
		const world = this.world();

		if (!world) {
			return null;
		}

		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();
		const base = {
			x,
			y,
			quarter: t(REGIONS.find((region) => region.id === quadrantOf(x, y))!.name),
		};
		// Towns of the 14th century are known to everyone, even beyond the explored land.
		const city = cityAt(x, y);

		if (city) {
			return {
				...base,
				icon: 'castle',
				color: 'var(--c-primary-text)',
				title: t(city.name),
				detail: t(city.about),
			};
		}

		if (!isExplored(x, y, world.counts)) {
			return {
				...base,
				icon: 'visibility_off',
				color: 'var(--c-text-muted)',
				title: t('Ще не відкриті землі'),
				detail: t('Світ розширюється, коли в цю чверть приходять нові лорди.'),
			};
		}

		const village = world.villages.find((v) => v.x === x && v.y === y);

		if (village) {
			const mine = village.uid === world.mine.uid;

			return {
				...base,
				icon: mine ? 'home' : 'cottage',
				color: 'var(--c-primary-text)',
				title: mine ? t('Ваше поселення') : village.lordName,
				detail: mine ? '' : t('Поселення іншого лорда'),
			};
		}

		const terrain = terrainAt(x, y);

		if (terrain === 'water' && geoAt(x, y).riverDistance <= 1) {
			return {
				...base,
				icon: 'water',
				color: '#3f6f86',
				title: t('Річка'),
				detail: t(RESOURCE_BY_ID.water.name),
			};
		}

		if (terrain === 'grass' || terrain === 'heart') {
			return {
				...base,
				icon: 'nature',
				color: '#5d7d40',
				title: t('Вільна земля'),
				detail: '',
			};
		}

		const resource = RESOURCE_BY_ID[terrain];

		return {
			...base,
			icon: resource.icon,
			color: resource.color,
			title: t(RESOURCE_LAND[terrain]!),
			detail: t(resource.name),
		};
	}

	private _goTo({ x, y }: Point) {
		this.centre.set({ x, y });
		this.selected.set({ x, y });
	}

	private async _load() {
		try {
			const game: GameState | null = await this._game.load();

			if (!game) {
				await this._router.navigateByUrl('/onboarding');
				return;
			}

			this.world.set(await this._world.load(game));
			this.goHome();
		} catch (error) {
			console.error(error);
			this.error.set(true);
		}
	}
}
