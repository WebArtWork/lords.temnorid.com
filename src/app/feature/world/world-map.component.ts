import { Component, computed, DestroyRef, ElementRef, inject, input, model, signal } from '@angular/core';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { Point } from '../map/map-geometry';
import { isExplored, terrainAt, tileVariant } from './world.generator';
import { WorldCounts, WorldTerrain, WorldVillage } from './world.interface';

/** Size of a tile on screen, in CSS pixels at 100%. */
const TILE = 56;
/** Room for the y labels on the left and the x labels underneath. */
const AXIS_LEFT = 40;
const AXIS_BOTTOM = 26;

interface ViewTile extends Point {
	key: string;
	terrain: WorldTerrain;
	variant: number;
	explored: boolean;
	village: WorldVillage | null;
}

/**
 * A window onto the world grid. Drag or use the arrow keys to move around: the arrows move the
 * selected tile and the view follows it, so every tile is reachable from the keyboard.
 */
@Component({
	selector: 'app-world-map',
	template: `
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
				<pattern id="world-furrows" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
					<line x1="0" y1="0" x2="0" y2="8" stroke="#bf9244" stroke-width="2" opacity="0.55" />
				</pattern>
			</defs>

			<rect [attr.width]="width()" [attr.height]="height()" fill="var(--c-bg-secondary)" />

			<g [attr.transform]="'translate(' + axisLeft + ' 0)'">
				@for (tile of tiles(); track tile.key) {
					<g [attr.transform]="'translate(' + col(tile) * tileSize + ' ' + row(tile) * tileSize + ')'">
						<rect [attr.width]="tileSize" [attr.height]="tileSize" [attr.fill]="tile.variant < 0.5 ? '#a9c46a' : '#a4c065'" />

						@if (tile.explored) {
							@if (tile.village; as village) {
								<g transform="translate(28 30)">
									@if (village.uid === mineUid()) {
										<circle r="25" fill="none" stroke="#e4a74a" stroke-width="4" stroke-dasharray="6 4" />
									}
									<circle r="19" fill="#d8c08c" stroke="#7b5a35" stroke-width="4" stroke-dasharray="3 2" />
									<rect x="-11" y="-4" width="9" height="8" fill="#efe3c6" stroke="#7b5a35" />
									<path d="M-13 -4 L-6.5 -10 L0 -4 Z" fill="#8f4a2e" />
									<rect x="2" y="-1" width="9" height="8" fill="#efe3c6" stroke="#7b5a35" />
									<path d="M0 -1 L6.5 -7 L13 -1 Z" fill="#8f4a2e" />
									<rect x="-4" y="7" width="8" height="6" fill="#efe3c6" stroke="#7b5a35" />
								</g>
							} @else {
								@let terrain = tile.terrain;
								@switch (terrain) {
									@case ('wood') {
										@for (tree of trees; track $index) {
											<circle [attr.cx]="tree.x" [attr.cy]="tree.y" [attr.r]="tree.r" fill="#2f4524" />
											<circle [attr.cx]="tree.x - 2" [attr.cy]="tree.y - 2" [attr.r]="tree.r * 0.65" fill="#557538" />
										}
									}
									@case ('stone') {
										<path d="M6 44 L22 14 L36 44 Z" fill="#8c8579" />
										<path d="M6 44 L22 14 L20 44 Z" fill="#d3ccbe" />
										<path d="M24 46 L38 22 L52 46 Z" fill="#8c8579" />
										<path d="M24 46 L38 22 L36 46 Z" fill="#d3ccbe" />
									}
									@case ('iron') {
										<ellipse cx="28" cy="34" rx="22" ry="14" fill="#655c55" />
										<path d="M12 38 L16 26 L24 22 L30 30 L26 40 Z" fill="#463f3a" />
										<path d="M30 40 L34 28 L42 26 L46 36 L40 42 Z" fill="#463f3a" />
										<circle cx="22" cy="30" r="2.5" fill="#b0603c" />
										<circle cx="40" cy="33" r="2.5" fill="#b0603c" />
									}
									@case ('water') {
										<rect x="5" y="9" width="46" height="38" rx="18" fill="#5f97ad" stroke="#4a7f94" stroke-width="2" />
										<rect x="13" y="16" width="30" height="22" rx="11" fill="#7fb1c4" />
									}
									@case ('grain') {
										<rect x="5" y="7" width="46" height="42" rx="4" fill="#dcb35e" stroke="#bf9244" stroke-width="2" />
										<rect x="5" y="7" width="46" height="42" rx="4" fill="url(#world-furrows)" />
									}
									@case ('clay') {
										<ellipse cx="28" cy="29" rx="22" ry="17" fill="#b07448" stroke="#8a5533" stroke-width="2" />
										<ellipse cx="28" cy="29" rx="14" ry="10" fill="none" stroke="#7d4a2c" stroke-width="3" opacity="0.55" />
										<ellipse cx="28" cy="29" rx="6" ry="4" fill="#8a5533" />
									}
									@case ('heart') {
										<ellipse cx="28" cy="44" rx="16" ry="5" fill="rgba(0,0,0,0.2)" />
										<path d="M20 44 L22 12 L28 6 L34 12 L36 44 Z" fill="#3b3631" stroke="#1f1b17" stroke-width="2" />
										<path d="M28 18 C31 22 31 26 28 29 C25 26 25 22 28 18 Z" fill="#e4a74a" />
									}
									@case ('grass') {
										@if (tile.variant > 0.88) {
											<circle cx="18" cy="20" r="5" fill="#3a522a" />
											<circle cx="17" cy="19" r="3" fill="#5d7d40" />
										} @else if (tile.variant > 0.82) {
											<ellipse cx="38" cy="38" rx="5" ry="3.5" fill="#958d84" stroke="#6a625a" />
										}
									}
									@default never;
								}
							}
						} @else {
							<rect [attr.width]="tileSize" [attr.height]="tileSize" fill="#2f2c26" opacity="0.88" />
						}

						<rect [attr.width]="tileSize" [attr.height]="tileSize" fill="none" stroke="rgba(0,0,0,0.12)" />

						@if (tile.key === selectedKey()) {
							<rect x="2" y="2" [attr.width]="tileSize - 4" [attr.height]="tileSize - 4" fill="none" stroke="#e4a74a" stroke-width="3" stroke-dasharray="5 3" />
						}
					</g>
				}
			</g>

			<!-- Coordinate axes, as on a surveyor's map. -->
			<rect [attr.width]="axisLeft" [attr.height]="height()" fill="var(--c-bg-tertiary)" />
			<rect [attr.y]="height() - axisBottom" [attr.width]="width()" [attr.height]="axisBottom" fill="var(--c-bg-tertiary)" />
			@for (y of rowsY(); track y; let i = $index) {
				<text class="world-axis" [attr.x]="axisLeft - 6" [attr.y]="i * tileSize + tileSize / 2" text-anchor="end" dominant-baseline="central">{{ y }}</text>
			}
			@for (x of colsX(); track x; let i = $index) {
				<text class="world-axis" [attr.x]="axisLeft + i * tileSize + tileSize / 2" [attr.y]="height() - axisBottom / 2" text-anchor="middle" dominant-baseline="central">{{ x }}</text>
			}
		</svg>
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

		:host-context(html[data-mode='dark']) .world-map g {
			filter: brightness(0.85) saturate(0.9);
		}

		.world-axis {
			fill: var(--c-text-muted);
			font-size: 12px;
			font-variant-numeric: tabular-nums;
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
	/** Tile in the middle of the view. */
	readonly centre = model.required<Point>();
	readonly selected = model.required<Point>();

	protected readonly tileSize = TILE;
	protected readonly axisLeft = AXIS_LEFT;
	protected readonly axisBottom = AXIS_BOTTOM;
	protected readonly trees = [
		{ x: 14, y: 18, r: 8 },
		{ x: 32, y: 14, r: 9 },
		{ x: 44, y: 28, r: 8 },
		{ x: 22, y: 34, r: 9 },
		{ x: 38, y: 44, r: 7 },
	];

	/** View size follows the space available, so wide screens see more of the world. */
	private readonly _available = signal(960);
	protected readonly cols = computed(() =>
		Math.max(7, Math.min(21, Math.round((this._available() - AXIS_LEFT) / TILE))),
	);
	protected readonly rows = computed(() => (this.cols() < 11 ? 7 : 9));
	protected readonly width = computed(() => AXIS_LEFT + this.cols() * TILE);
	protected readonly height = computed(() => this.rows() * TILE + AXIS_BOTTOM);
	protected readonly colsX = computed(() => {
		const first = this.centre().x - Math.floor(this.cols() / 2);

		return Array.from({ length: this.cols() }, (_, i) => first + i);
	});
	protected readonly rowsY = computed(() => {
		const first = this.centre().y - Math.floor(this.rows() / 2);

		return Array.from({ length: this.rows() }, (_, i) => first + i);
	});
	protected readonly selectedKey = computed(() => `${this.selected().x}|${this.selected().y}`);

	private readonly _villageByKey = computed(
		() => new Map(this.villages().map((village) => [`${village.x}|${village.y}`, village])),
	);
	protected readonly tiles = computed<ViewTile[]>(() => {
		const counts = this.counts();
		const villages = this._villageByKey();

		return this.rowsY().flatMap((y) =>
			this.colsX().map((x) => {
				const key = `${x}|${y}`;

				return {
					key,
					x,
					y,
					terrain: terrainAt(x, y),
					variant: tileVariant(x, y),
					explored: isExplored(x, y, counts),
					village: villages.get(key) ?? null,
				};
			}),
		);
	});
	protected readonly labels = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();

		return {
			map: t('Мапа світу'),
			help: t('Перетягуйте мапу або рухайтеся стрілками. Обрана клітинка описана під мапою.'),
		};
	});

	/** Set while the pointer is down: where it started, and how far the view has already moved. */
	protected dragging: { id: number; x: number; y: number; moved: boolean; start: Point } | null =
		null;

	constructor() {
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				this._available.set(entry.contentRect.width);
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

	protected onKey(event: KeyboardEvent) {
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
		const col = Math.floor((event.clientX - box.left - AXIS_LEFT * scale) / (TILE * scale));
		const row = Math.floor((event.clientY - box.top) / (TILE * scale));

		if (col >= 0 && col < this.cols() && row >= 0 && row < this.rows()) {
			this.selected.set({ x: this.colsX()[col]!, y: this.rowsY()[row]! });
		}
	}

	private _pixelsPerTile(event: PointerEvent): number {
		const box = (event.currentTarget as Element).getBoundingClientRect();

		return (box.width / this.width()) * TILE;
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
