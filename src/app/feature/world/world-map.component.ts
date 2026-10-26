import {
	Component,
	computed,
	DestroyRef,
	ElementRef,
	inject,
	input,
	model,
	output,
	signal,
} from '@angular/core';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import type { DungeonSpot } from '../dungeon/dungeon.map';
import { Point } from '../map/map-geometry';
import { cityAt } from './world.geography';
import { isExplored, terrainAt, tileVariant } from './world.generator';
import { WorldCounts, WorldTerrain, WorldVillage } from './world.interface';
import { buildScene } from './world.scene';

/** Tile sizes on screen, in CSS pixels at 100%, from closest to farthest. */
export const WORLD_ZOOMS = [56, 32, 16] as const;
/** Room for the y labels on the left and the x labels underneath. */
const AXIS_LEFT = 40;
const AXIS_BOTTOM = 26;
/** Below this tile size the map drops per-tile drawings and keeps only the relief. */
const DETAIL_TILE = 30;

interface ViewTile extends Point {
	key: string;
	terrain: WorldTerrain;
	variant: number;
	village: WorldVillage | null;
}

/**
 * A window onto the world grid, drawn as low-poly relief over the real land of Podillia. Drag or
 * use the arrow keys to move around: the arrows move the selected tile and the view follows it, so
 * every tile is reachable from the keyboard. + and - zoom.
 */
@Component({
	selector: 'app-world-map',
	template: `
		<div class="relative h-full">
			<svg
				class="world-map block h-auto w-full touch-none select-none"
				[attr.viewBox]="'0 0 ' + width() + ' ' + height()"
				tabindex="0"
				role="application"
				[attr.aria-label]="labels().map"
				aria-describedby="world-map-help"
				(keydown)="onKey($event)"
				(pointerdown)="onPointerDown($event)"
				(pointermove)="onPointerMove($event)"
				(pointerup)="onPointerUp($event)"
				(pointercancel)="dragging = null"
			>
				<defs>
					<clipPath id="world-map-area">
						<rect [attr.width]="width() - axisLeft" [attr.height]="height() - axisBottom" />
					</clipPath>
				</defs>

				<rect [attr.width]="width()" [attr.height]="height()" fill="var(--c-bg-secondary)" />

				<g class="world-land" [attr.transform]="'translate(' + axisLeft + ' 0)'" clip-path="url(#world-map-area)">
					@for (facet of scene().facets; track facet.fill) {
						<path [attr.d]="facet.d" [attr.fill]="facet.fill" [attr.stroke]="facet.fill" stroke-width="0.6" stroke-linejoin="round" />
					}

					@for (river of scene().rivers; track $index) {
						<path [attr.d]="river.d" fill="none" stroke="#3f6f86" [attr.stroke-width]="river.width + 2" stroke-linecap="round" stroke-linejoin="round" />
						<path [attr.d]="river.d" fill="none" stroke="#6aa6bd" [attr.stroke-width]="river.width" stroke-linecap="round" stroke-linejoin="round" />
					}

					@if (detailed()) {
						@for (tile of landTiles(); track tile.key) {
							<g [attr.transform]="'translate(' + col(tile) * tileSize() + ' ' + row(tile) * tileSize() + ') scale(' + tileSize() / 56 + ')'">
									@switch (tile.terrain) {
										@case ('wood') {
											@for (tree of trees; track $index) {
												<path [attr.d]="tree.left" fill="#2f5a2a" />
												<path [attr.d]="tree.right" fill="#1f3d1d" />
											}
										}
										@case ('stone') {
											<path d="M6 44 L22 14 L24 44 Z" fill="#d8d1c2" />
											<path d="M22 14 L36 44 L24 44 Z" fill="#8a8274" />
											<path d="M26 46 L39 24 L40 46 Z" fill="#cfc7b6" />
											<path d="M39 24 L52 46 L40 46 Z" fill="#7d7567" />
										}
										@case ('iron') {
											<path d="M10 40 L16 26 L28 22 L32 34 L24 42 Z" fill="#5c524b" />
											<path d="M16 26 L28 22 L24 32 Z" fill="#8a7d73" />
											<path d="M30 42 L35 28 L46 27 L48 38 Z" fill="#4a423d" />
											<path d="M35 28 L46 27 L40 33 Z" fill="#7a6e65" />
											<path d="M20 33 L23 31 L22 35 Z" fill="#c0673c" />
											<path d="M40 35 L43 33 L42 37 Z" fill="#c0673c" />
										}
										@case ('grain') {
											<path d="M6 12 L48 8 L50 46 L8 48 Z" fill="#e2bf6a" opacity="0.65" />
											@for (furrow of furrows; track $index) {
												<path [attr.d]="furrow" stroke="#b58a3a" stroke-width="2" stroke-linecap="round" opacity="0.7" />
											}
										}
										@case ('clay') {
											<path d="M8 30 L16 16 L36 12 L50 24 L44 42 L22 46 Z" fill="#c48a5c" />
											<path d="M18 28 L24 20 L36 19 L42 28 L34 38 L22 37 Z" fill="#8c5634" />
											<path d="M24 20 L36 19 L30 26 Z" fill="#a66b43" />
										}
										@case ('heart') {}
										@case ('water') {}
										@case ('grass') {
											@if (tile.variant > 0.88) {
												<path d="M12 26 L18 14 L24 26 Z" fill="#3f6a30" />
												<path d="M18 14 L24 26 L18 26 Z" fill="#2b4c22" />
											} @else if (tile.variant > 0.82) {
												<path d="M32 40 L37 33 L44 35 L42 41 Z" fill="#a39b90" />
											}
										}
										@default never;
									}
							</g>
						}
					}

					@if (scene().fog) {
						<path [attr.d]="scene().fog" fill="#211c17" opacity="0.62" />
					}

					@for (tile of villageTiles(); track tile.key) {
						<g [attr.transform]="'translate(' + (col(tile) + 0.5) * tileSize() + ' ' + (row(tile) + 0.5) * tileSize() + ') scale(' + markScale() + ')'">
							@if (tile.village!.uid === mineUid()) {
								<circle r="25" fill="none" stroke="#e4a74a" stroke-width="4" stroke-dasharray="6 4" />
							}
							<ellipse cx="0" cy="12" rx="18" ry="5" fill="rgb(0 0 0 / 0.22)" />
							<path d="M-12 -2 L-6 -9 L-6 6 L-12 6 Z" fill="#efe3c6" />
							<path d="M-6 -9 L0 -2 L0 6 L-6 6 Z" fill="#cbb994" />
							<path d="M-14 -2 L-6 -11 L-6 -8 L-12 -1 Z" fill="#a8583a" />
							<path d="M-6 -11 L2 -2 L0 -1 L-6 -8 Z" fill="#7a3a24" />
							<path d="M2 1 L8 -6 L8 10 L2 10 Z" fill="#efe3c6" />
							<path d="M8 -6 L14 1 L14 10 L8 10 Z" fill="#cbb994" />
							<path d="M0 1 L8 -8 L8 -5 L2 2 Z" fill="#a8583a" />
							<path d="M8 -8 L16 1 L14 2 L8 -5 Z" fill="#7a3a24" />
						</g>
					}

					<!-- The lord's dungeons: known places, so they show through the fog. -->
					@for (spot of dungeonsInView(); track spot.id) {
						<g [attr.transform]="'translate(' + (col(spot) + 0.5) * tileSize() + ' ' + (row(spot) + 0.5) * tileSize() + ') scale(' + markScale() + ')'">
							<ellipse cx="0" cy="13" rx="20" ry="5" fill="rgb(0 0 0 / 0.25)" />
							<path d="M-20 12 L-12 -6 L0 -14 L0 12 Z" fill="#8f877b" />
							<path d="M0 -14 L12 -6 L20 12 L0 12 Z" fill="#5f574e" />
							<path d="M-8 12 L-8 2 C-8 -6 8 -6 8 2 L8 12 Z" fill="#1d1712" />
							@for (dot of skulls(spot.danger); track $index) {
								<circle [attr.cx]="dot" cy="-19" r="3" fill="#e07a5f" stroke="#1d1712" stroke-width="1" />
							}
						</g>
					}

					@for (place of scene().cities; track place.city.id) {
						<g class="world-city" [attr.transform]="'translate(' + place.x + ' ' + place.y + ') scale(' + citySize(place.city.capital) + ')'">
							<ellipse cx="0" cy="16" rx="26" ry="6" fill="rgb(0 0 0 / 0.28)" />
							<!-- Curtain wall: lit west face, shaded east face. -->
							<path d="M-20 14 L-20 -2 L0 -6 L0 10 Z" fill="#d9d1c0" />
							<path d="M0 -6 L20 -2 L20 14 L0 10 Z" fill="#9c937f" />
							<path d="M-20 -2 L0 -6 L20 -2 L0 2 Z" fill="#bfb6a2" />
							<!-- Towers with pointed roofs. -->
							<path d="M-24 16 L-24 -8 L-16 -10 L-16 14 Z" fill="#e6dfcf" />
							<path d="M-26 -8 L-20 -22 L-16 -10 Z" fill="#a8583a" />
							<path d="M-20 -22 L-14 -8 L-16 -10 Z" fill="#7a3a24" />
							<path d="M16 14 L16 -10 L24 -8 L24 16 Z" fill="#a39a86" />
							<path d="M14 -10 L20 -24 L26 -8 Z" fill="#8f4a2e" />
							<path d="M20 -24 L26 -8 L20 -9 Z" fill="#6a2f1d" />
							<path d="M-5 4 L-5 -18 L5 -20 L5 2 Z" fill="#cfc6b3" />
							<path d="M-7 -18 L0 -34 L5 -20 Z" fill="#a8583a" />
							<path d="M0 -34 L7 -18 L5 -20 Z" fill="#7a3a24" />
							<path d="M-3 10 L-3 4 L3 3 L3 9 Z" fill="#3a2a1c" />
						</g>
					}
					@for (place of scene().cities; track place.city.id) {
						<text class="world-city-label" [attr.x]="place.x" [attr.y]="place.y + 24 * citySize(place.city.capital) + 14">{{ cityNames()[place.city.id] }}</text>
					}

					@if (selectedInView()) {
						<rect
							[attr.x]="col(selected()) * tileSize() + 2"
							[attr.y]="row(selected()) * tileSize() + 2"
							[attr.width]="tileSize() - 4"
							[attr.height]="tileSize() - 4"
							fill="none"
							stroke="#e4a74a"
							stroke-width="3"
							stroke-dasharray="5 3"
						/>
					}
				</g>

				<!-- Coordinate axes, as on a surveyor's map. -->
				<rect [attr.width]="axisLeft" [attr.height]="height()" fill="var(--c-bg-tertiary)" />
				<rect [attr.y]="height() - axisBottom" [attr.width]="width()" [attr.height]="axisBottom" fill="var(--c-bg-tertiary)" />
				@for (y of rowsY(); track y; let i = $index) {
					@if (y % axisStep() === 0) {
						<text class="world-axis" [attr.x]="axisLeft - 6" [attr.y]="i * tileSize() + tileSize() / 2" text-anchor="end" dominant-baseline="central">{{ y }}</text>
					}
				}
				@for (x of colsX(); track x; let i = $index) {
					@if (x % axisStep() === 0) {
						<text class="world-axis" [attr.x]="axisLeft + i * tileSize() + tileSize() / 2" [attr.y]="height() - axisBottom / 2" text-anchor="middle" dominant-baseline="central">{{ x }}</text>
					}
				}
			</svg>

			<div class="world-zoom absolute right-3 top-3 flex flex-col gap-1">
				<button class="btn world-zoom__btn" [disabled]="zoom() === 0" (click)="zoomBy(-1)" type="button" [attr.aria-label]="labels().zoomIn">
					<span class="material-symbols-outlined" aria-hidden="true">add</span>
				</button>
				<button class="btn world-zoom__btn" [disabled]="zoom() === zooms.length - 1" (click)="zoomBy(1)" type="button" [attr.aria-label]="labels().zoomOut">
					<span class="material-symbols-outlined" aria-hidden="true">remove</span>
				</button>

				<button class="btn world-zoom__btn mt-2" (click)="home.emit()" type="button" [attr.aria-label]="labels().home" [title]="labels().home">
					<span class="material-symbols-outlined" aria-hidden="true">my_location</span>
				</button>
				<button class="btn world-zoom__btn" (click)="navigate.emit()" type="button" [attr.aria-label]="labels().navigate" [title]="labels().navigate">
					<span class="material-symbols-outlined" aria-hidden="true">travel_explore</span>
				</button>
				<button class="btn world-zoom__btn" (click)="cities.emit()" type="button" [attr.aria-label]="labels().cities" [title]="labels().cities">
					<span class="material-symbols-outlined" aria-hidden="true">castle</span>
				</button>
				<button class="btn world-zoom__btn" (click)="info.emit()" type="button" [attr.aria-label]="labels().info" [title]="labels().info">
					<span class="material-symbols-outlined" aria-hidden="true">info</span>
				</button>
			</div>

			<p class="world-scale pointer-events-none absolute bottom-9 left-12 flex items-center gap-1.5">
				<span class="material-symbols-outlined text-[16px]" aria-hidden="true">grid_4x4</span>
				<span>{{ labels().scale }}</span>
			</p>
		</div>
		<p class="sr-only" id="world-map-help">{{ labels().help }}</p>
	`,
	styles: `
		:host {
			display: block;
		}

		.world-map {
			cursor: grab;
			outline: none;

			&:focus-visible {
				box-shadow: var(--focus-ring);
			}
		}

		:host-context(html[data-mode='dark']) .world-land {
			filter: brightness(0.82) saturate(0.9);
		}

		.world-axis {
			fill: var(--c-text-muted);
			font-size: 12px;
			font-variant-numeric: tabular-nums;
		}

		.world-city-label {
			fill: #1d140d;
			font-family: var(--ff-serif);
			font-size: 15px;
			font-weight: 700;
			text-anchor: middle;
			paint-order: stroke;
			stroke: rgb(254 251 245 / 0.9);
			stroke-width: 4px;
			stroke-linejoin: round;
		}

		.world-scale {
			border-radius: 999px;
			background: rgb(29 20 13 / 0.78);
			padding: 0.125rem 0.625rem;
			color: #fff8e8;
			font-size: 0.8125rem;
			font-weight: 600;
		}

		.world-zoom__btn {
			min-width: 2.75rem;
			min-height: 2.75rem;
			justify-content: center;
			padding: 0;
			background: var(--c-bg-secondary);
			box-shadow: var(--shadow-sm);
		}
	`,
})
export class WorldMapComponent {
	private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	readonly counts = input.required<WorldCounts>();
	readonly villages = input.required<WorldVillage[]>();
	readonly mineUid = input.required<string>();
	/** The lord's own dungeons, drawn as cave mouths. */
	readonly dungeons = input<DungeonSpot[]>([]);
	/** Tile in the middle of the view. */
	readonly centre = model.required<Point>();
	readonly selected = model.required<Point>();
	/** Index into WORLD_ZOOMS. */
	readonly zoom = model(0);
	/** Asks the page to centre on the lord's own village. */
	readonly home = output();
	/** Asks the page to choose a place to go to by its coordinates. */
	readonly navigate = output();
	/** Asks the page to list the towns to go to. */
	readonly cities = output();
	/** Asks the page to explain the map: scale, towns, villages. */
	readonly info = output();
	/** A tile was tapped, or Enter was pressed on the selected one: the page describes it. */
	readonly pick = output<Point>();

	protected readonly zooms = WORLD_ZOOMS;
	protected readonly axisLeft = AXIS_LEFT;
	protected readonly axisBottom = AXIS_BOTTOM;
	/** Low-poly firs: each a lit west half and a shaded east half. */
	protected readonly trees = [
		{ x: 14, y: 22, r: 8 },
		{ x: 32, y: 16, r: 9 },
		{ x: 44, y: 32, r: 8 },
		{ x: 22, y: 40, r: 9 },
		{ x: 38, y: 48, r: 7 },
	].map(({ x, y, r }) => ({
		left: `M${x - r} ${y} L${x} ${y - r * 2} L${x} ${y} Z`,
		right: `M${x} ${y - r * 2} L${x + r} ${y} L${x} ${y} Z`,
	}));
	protected readonly furrows = [14, 22, 30, 38].map((y) => `M10 ${y} L46 ${y - 3}`);

	/**
	 * The host's box. When the host has a height (the world page gives it the whole window), the map
	 * fills it exactly and the last row and column are cut at the edge. Without one, the view picks
	 * a height from the width.
	 */
	private readonly _box = signal({ width: 960, height: 0 });
	private readonly _fills = computed(() => this._box().height > 120);
	protected readonly tileSize = computed(() => WORLD_ZOOMS[this.zoom()]!);
	protected readonly detailed = computed(() => this.tileSize() >= DETAIL_TILE);
	protected readonly cols = computed(() => {
		const room = (this._box().width - AXIS_LEFT) / this.tileSize();

		return this._fills()
			? Math.max(1, Math.ceil(room))
			: Math.max(7, Math.min(90, Math.round(room)));
	});
	protected readonly rows = computed(() => {
		if (this._fills()) {
			return Math.max(1, Math.ceil((this._box().height - AXIS_BOTTOM) / this.tileSize()));
		}

		return Math.round((this._box().width < 640 ? 392 : 504) / this.tileSize());
	});
	protected readonly width = computed(() =>
		this._fills() ? this._box().width : AXIS_LEFT + this.cols() * this.tileSize(),
	);
	protected readonly height = computed(() =>
		this._fills() ? this._box().height : this.rows() * this.tileSize() + AXIS_BOTTOM,
	);
	protected readonly axisStep = computed(() =>
		this.tileSize() < 24 ? 5 : this.tileSize() < 40 ? 2 : 1,
	);
	/** Villages and towns shrink with the land, but never out of sight. */
	protected readonly markScale = computed(() => Math.max(0.42, this.tileSize() / 56));
	protected readonly colsX = computed(() => {
		const first = this.centre().x - Math.floor(this.cols() / 2);

		return Array.from({ length: this.cols() }, (_, i) => first + i);
	});
	protected readonly rowsY = computed(() => {
		const first = this.centre().y - Math.floor(this.rows() / 2);

		return Array.from({ length: this.rows() }, (_, i) => first + i);
	});
	protected readonly selectedInView = computed(() => {
		const { x, y } = this.selected();

		return (
			x >= this.colsX()[0]! &&
			x <= this.colsX().at(-1)! &&
			y >= this.rowsY()[0]! &&
			y <= this.rowsY().at(-1)!
		);
	});

	protected readonly scene = computed(() =>
		buildScene({
			firstX: this.colsX()[0]!,
			firstY: this.rowsY()[0]!,
			cols: this.cols(),
			rows: this.rows(),
			tile: this.tileSize(),
			counts: this.counts(),
		}),
	);

	private readonly _villageByKey = computed(
		() => new Map(this.villages().map((village) => [`${village.x}|${village.y}`, village])),
	);
	protected readonly tiles = computed<ViewTile[]>(() => {
		const counts = this.counts();
		const villages = this._villageByKey();

		return this.rowsY().flatMap((y) =>
			this.colsX().flatMap((x) => {
				const key = `${x}|${y}`;
				const village = villages.get(key) ?? null;

				// Fog hides the land, and towns draw themselves.
				if ((!village && !isExplored(x, y, counts)) || cityAt(x, y)) {
					return [];
				}

				return [
					{ key, x, y, terrain: terrainAt(x, y), variant: tileVariant(x, y), village },
				];
			}),
		);
	});
	protected readonly dungeonsInView = computed(() => {
		const [firstX, lastX] = [this.colsX()[0]!, this.colsX().at(-1)!];
		const [firstY, lastY] = [this.rowsY()[0]!, this.rowsY().at(-1)!];

		return this.dungeons().filter(
			(spot) => spot.x >= firstX && spot.x <= lastX && spot.y >= firstY && spot.y <= lastY,
		);
	});
	protected readonly landTiles = computed(() => this.tiles().filter((tile) => !tile.village));
	protected readonly villageTiles = computed(() => this.tiles().filter((tile) => tile.village));

	protected readonly labels = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();

		return {
			map: t('Мапа світу'),
			help: t(
				'Перетягуйте мапу або рухайтеся стрілками. Плюс і мінус змінюють масштаб. Дотик або Enter відкриває опис клітинки.',
			),
			zoomIn: t('Наблизити'),
			zoomOut: t('Віддалити'),
			home: t('Моє поселення'),
			navigate: t('Перейти'),
			cities: t('Міста'),
			info: t('Про мапу'),
			scale: t('1 клітинка = 2 км'),
		};
	});
	protected readonly cityNames = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();

		return Object.fromEntries(
			this.scene().cities.map(({ city }) => [city.id, t(city.name)]),
		) as Record<string, string>;
	});

	/** Set while the pointer is down: where it started, and how far the view has already moved. */
	protected dragging: { id: number; x: number; y: number; moved: boolean; start: Point } | null =
		null;

	constructor() {
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				const { width, height } = entry.contentRect;

				this._box.set({ width: Math.round(width), height: Math.round(height) });
			}
		});

		observer.observe(this._host.nativeElement);
		inject(DestroyRef).onDestroy(() => observer.disconnect());
	}

	protected col(tile: Point): number {
		return tile.x - this.colsX()[0]!;
	}

	protected row(tile: Point): number {
		return tile.y - this.rowsY()[0]!;
	}

	/** x positions of a dungeon's danger dots, one per skull, centred over the cave. */
	protected skulls(danger: number): number[] {
		return Array.from({ length: danger }, (_, i) => (i - (danger - 1) / 2) * 8);
	}

	protected citySize(capital: boolean | undefined): number {
		return this.markScale() * (capital ? 1.25 : 0.95);
	}

	/** Zooms around the selected tile, so it stays in the middle. */
	protected zoomBy(step: number) {
		const next = Math.max(0, Math.min(WORLD_ZOOMS.length - 1, this.zoom() + step));

		if (next !== this.zoom()) {
			this.zoom.set(next);
			this.centre.set(this.selected());
		}
	}

	protected onKey(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			this.pick.emit(this.selected());
			return;
		}

		if (event.key === '+' || event.key === '=' || event.key === '-') {
			event.preventDefault();
			this.zoomBy(event.key === '-' ? 1 : -1);
			return;
		}

		const step: Record<string, Point> = {
			ArrowLeft: { x: -1, y: 0 },
			ArrowRight: { x: 1, y: 0 },
			ArrowUp: { x: 0, y: -1 },
			ArrowDown: { x: 0, y: 1 },
		};
		const delta = step[event.key];

		if (!delta) {
			return;
		}

		event.preventDefault();
		const next = { x: this.selected().x + delta.x, y: this.selected().y + delta.y };

		this.selected.set(next);
		this._keepInView(next);
	}

	protected onPointerDown(event: PointerEvent) {
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		this.dragging = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			moved: false,
			start: this.centre(),
		};
	}

	protected onPointerMove(event: PointerEvent) {
		const drag = this.dragging;

		if (!drag || drag.id !== event.pointerId) {
			return;
		}

		const scale = this._pixelsPerTile(event);
		const dx = Math.round((event.clientX - drag.x) / scale);
		const dy = Math.round((event.clientY - drag.y) / scale);

		if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 6) {
			drag.moved = true;
		}

		// Dragging the land right shows what lies to the west.
		this.centre.set({ x: drag.start.x - dx, y: drag.start.y - dy });
	}

	protected onPointerUp(event: PointerEvent) {
		const drag = this.dragging;

		this.dragging = null;

		if (!drag || drag.moved) {
			return;
		}

		// A tap, not a drag: select the tile under the pointer.
		const svg = event.currentTarget as SVGSVGElement;
		const box = svg.getBoundingClientRect();
		const scale = box.width / this.width();
		const tile = this.tileSize() * scale;
		const col = Math.floor((event.clientX - box.left - AXIS_LEFT * scale) / tile);
		const row = Math.floor((event.clientY - box.top) / tile);

		if (col >= 0 && col < this.cols() && row >= 0 && row < this.rows()) {
			const tile = { x: this.colsX()[col]!, y: this.rowsY()[row]! };

			this.selected.set(tile);
			this.pick.emit(tile);
		}
	}

	private _pixelsPerTile(event: PointerEvent): number {
		const box = (event.currentTarget as Element).getBoundingClientRect();

		return (box.width / this.width()) * this.tileSize();
	}

	/** Scrolls the view just enough to keep a tile inside it. */
	private _keepInView(tile: Point) {
		const [firstX, lastX] = [this.colsX()[0]!, this.colsX().at(-1)!];
		const [firstY, lastY] = [this.rowsY()[0]!, this.rowsY().at(-1)!];
		const shiftX = tile.x < firstX ? tile.x - firstX : tile.x > lastX ? tile.x - lastX : 0;
		const shiftY = tile.y < firstY ? tile.y - firstY : tile.y > lastY ? tile.y - lastY : 0;

		if (shiftX || shiftY) {
			this.centre.update((centre) => ({ x: centre.x + shiftX, y: centre.y + shiftY }));
		}
	}
}
