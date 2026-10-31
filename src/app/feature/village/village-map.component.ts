import { Component, computed, DestroyRef, ElementRef, inject, input, model, output, signal } from '@angular/core';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { BUILDING_BY_ID } from '../building/building.data';
import { CENTER_PLACE, VillageBuilding, WALL_PLACE } from '../building/building.interface';
import { formatDuration, levelAt, standing, workEndsAt } from '../building/building.timing';
import { ElementId } from '../element/element.interface';
import {
	growth,
	isCompact,
	isPortrait,
	landTurn,
	mapViewBox,
	pixelsPerUnit,
	uprightTurn,
} from '../map/map-view';
import { VillageMap } from './village.interface';

/** Draws a generated village. Slots are buttons; the picked one is two-way bound to `selected`. */
@Component({
	selector: 'app-village-map',
	template: `
		<svg
			class="village-map block w-full"
			[class.h-auto]="!fill()"
			[class.h-full]="fill()"
			[attr.viewBox]="viewBox()"
			role="group"
			[attr.aria-label]="labels().map"
		>
			<defs>
				<pattern id="village-furrows" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
					<line x1="0" y1="0" x2="0" y2="12" [attr.stroke]="palette().fieldLine" stroke-width="3" opacity="0.45" />
				</pattern>
			</defs>

			<!--
				On a portrait screen the land turns a quarter round, so the long village runs down the
				screen. Everything that stands on it (houses, trees, rocks, labels) turns back, so the
				village is seen upright from another side.
			-->
			<g [attr.transform]="land()">

			<!-- Three times the map, so when the map fills a box of another shape the spare room is ground too. -->
			<rect [attr.x]="-map().width" [attr.y]="-map().height" [attr.width]="map().width * 3" [attr.height]="map().height * 3" [attr.fill]="palette().outer" />

			@for (field of map().fields; track $index) {
				<path [attr.d]="field" [attr.fill]="palette().field" [attr.stroke]="palette().fieldLine" stroke-width="3" />
				<path [attr.d]="field" fill="url(#village-furrows)" />
			}

			@for (pond of map().ponds; track $index) {
				<path [attr.d]="pond" [attr.fill]="palette().water" stroke="#4a7f94" stroke-width="4" />
			}

			@for (pit of map().pits; track $index) {
				<path [attr.d]="pit.outer" fill="#b07448" stroke="#8a5533" stroke-width="3" />
				<path [attr.d]="pit.inner" fill="none" stroke="#7d4a2c" stroke-width="5" opacity="0.55" />
			}

			@for (ore of map().ores; track $index) {
				<g [attr.transform]="'translate(' + ore.x + ' ' + ore.y + ')' + upright()">
					<path [attr.d]="orePath(ore.r)" fill="#463f3a" />
					<circle [attr.cx]="ore.r * 0.2" [attr.cy]="-ore.r * 0.1" [attr.r]="ore.r * 0.22" fill="#b0603c" />
				</g>
			}

			@for (rock of map().rocks; track $index) {
				<g [attr.transform]="'translate(' + rock.x + ' ' + rock.y + ')' + upright()">
					<ellipse cx="0" [attr.cy]="rock.r * 0.35" [attr.rx]="rock.r" [attr.ry]="rock.r * 0.75" [attr.fill]="palette().rockShade" />
					<ellipse cx="0" cy="0" [attr.rx]="rock.r * 0.9" [attr.ry]="rock.r * 0.7" [attr.fill]="palette().rock" />
				</g>
			}

			<path [attr.d]="map().boundary" [attr.fill]="palette().ground" [attr.stroke]="palette().groundEdge" stroke-width="6" />

			<!-- The wall runs along the edge of the village; the roads pass over it as gates. -->
			@if (present()[wall]; as stone) {
				@if (levelOf(stone)) {
					<path [attr.d]="map().boundary" fill="none" stroke="#7d7466" stroke-width="16" stroke-linejoin="round" />
					<path [attr.d]="map().boundary" fill="none" stroke="#cfc6b2" stroke-width="9" stroke-linejoin="round" stroke-dasharray="14 7" />
				} @else {
					<path class="village-scaffold" [attr.d]="map().boundary" fill="none" stroke-width="6" stroke-dasharray="3 10" />
				}
			}

			@for (road of map().roads; track $index) {
				<path [attr.d]="road.d" fill="none" [attr.stroke]="palette().road" [attr.stroke-width]="road.width" stroke-linecap="round" />
			}

			@if (map().stream; as stream) {
				<path [attr.d]="stream" fill="none" [attr.stroke]="palette().water" stroke-width="28" stroke-linecap="round" />
				<path [attr.d]="stream" fill="none" [attr.stroke]="palette().waterLight" stroke-width="8" stroke-linecap="round" stroke-dasharray="30 22" opacity="0.7" />
			}

			@for (bridge of map().bridges; track $index) {
				<g [attr.transform]="'translate(' + bridge.x + ' ' + bridge.y + ') rotate(' + bridge.angle + ')'">
					<rect x="-26" y="-13" width="52" height="26" rx="3" fill="#8a6440" />
					@for (plank of planks; track plank) {
						<line [attr.x1]="plank" y1="-13" [attr.x2]="plank" y2="13" stroke="#6b4a2c" stroke-width="2" />
					}
				</g>
			}

			@for (rock of map().ridge; track $index) {
				<g [attr.transform]="'translate(' + rock.x + ' ' + rock.y + ')' + upright()">
					<ellipse cx="0" [attr.cy]="rock.r * 0.3" [attr.rx]="rock.r" [attr.ry]="rock.r * 0.8" [attr.fill]="palette().rockShade" />
					<ellipse [attr.cx]="-rock.r * 0.1" [attr.cy]="-rock.r * 0.1" [attr.rx]="rock.r * 0.85" [attr.ry]="rock.r * 0.68" [attr.fill]="palette().rock" />
				</g>
			}

			<path [attr.d]="map().plaza" [attr.fill]="palette().plaza" />

			<!--
				The village centre: a place of its own that only takes the arena. Until the arena
				stands, it shows the heart of the village: the first stone, or the fire everyone
				gathers around.
			-->
			<g
				class="village-slot village-center"
				[class.village-slot--selected]="selected() === center"
				[attr.transform]="'translate(' + map().centre.x + ' ' + map().centre.y + ')' + upright() + spriteScale()"
				role="button"
				tabindex="0"
				[attr.aria-label]="slotLabel(center)"
				[attr.aria-pressed]="selected() === center"
				(click)="toggle(center)"
				(keydown.enter)="toggle(center)"
				(keydown.space)="$event.preventDefault(); toggle(center)"
			>
				<ellipse class="village-slot__ring" cx="0" cy="0" rx="58" ry="36" />
				@if (present()[center]; as arena) {
					@let level = levelOf(arena);
					<ellipse cx="0" cy="10" rx="54" ry="22" fill="rgb(0 0 0 / 0.22)" />
					@if (level) {
						<!-- Low-poly amphitheatre: stone stands round a sand ring, with banners. -->
						<ellipse cx="0" cy="0" rx="50" ry="30" fill="#b8ad98" stroke="#6d6556" stroke-width="2.5" />
						<ellipse cx="0" cy="-3" rx="44" ry="25" fill="#d7ccb6" />
						<path d="M-44 -3 A44 25 0 0 1 44 -3 L36 -3 A36 19 0 0 0 -36 -3 Z" fill="#c8bca4" />
						<ellipse cx="0" cy="1" rx="30" ry="16" fill="#e2c98f" stroke="#a68a52" stroke-width="2" />
						<path d="M-14 1 H14 M0 -7 V9" stroke="#c4a764" stroke-width="2" />
						@for (flag of arenaFlags; track $index) {
							<path [attr.d]="'M' + flag.x + ' ' + flag.y + ' v-18'" stroke="#5a3a1c" stroke-width="2" />
							<path [attr.d]="'M' + flag.x + ' ' + (flag.y - 18) + ' l10 3 l-10 3 Z'" fill="#a8583a" />
						}
					} @else {
						<!-- The ring of stands is still going up. -->
						<ellipse cx="0" cy="0" rx="50" ry="30" fill="#d8c8a2" stroke="#8a7650" stroke-width="2" stroke-dasharray="6 5" />
						<ellipse cx="0" cy="1" rx="30" ry="16" fill="#e2c98f" />
						<path class="village-scaffold" d="M-46 8 V-20 M46 8 V-20 M-46 -12 H-20 M20 -12 H46 M-46 8 L-20 -20 M46 8 L20 -20" />
					}
					<circle class="village-building__badge" cx="0" cy="1" r="15" />
					<text class="material-symbols-outlined village-building__icon" x="0" y="1">stadium</text>
					@if (level) {
						<g transform="translate(46 -28)">
							<circle class="village-building__level" r="11" />
							<text class="village-building__level-text" y="1">{{ level }}</text>
						</g>
					}
					<g [attr.transform]="'translate(0 42) scale(' + labelScale() + ')'">
						<text class="village-building__name" x="0" y="0">{{ nameOf(arena) }}</text>
						@if (timeLeft(arena); as left) {
							<g transform="translate(0 22)">
								<rect class="village-building__timer" x="-30" y="-10" width="60" height="20" rx="10" />
								<text class="village-building__timer-text" y="1">{{ left }}</text>
							</g>
						}
					</g>
				} @else {
					@let heart = element();
					@switch (heart) {
						@case ('stone') {
							<ellipse cx="0" cy="6" rx="22" ry="8" fill="rgba(0,0,0,0.18)" />
							<path d="M-12 6 L-9 -30 L2 -40 L11 -28 L13 6 Z" [attr.fill]="palette().rock" [attr.stroke]="palette().rockShade" stroke-width="2.5" />
							<path d="M-3 -22 L4 -22 M-3 -14 L5 -14" stroke="#e4a74a" stroke-width="2" stroke-linecap="round" />
						}
						@case ('fire') {
							@for (stone of hearthStones; track $index) {
								<circle [attr.cx]="stone.x" [attr.cy]="stone.y" r="5" [attr.fill]="palette().rock" [attr.stroke]="palette().rockShade" stroke-width="1.5" />
							}
							<path d="M0 -26 C10 -14 12 -4 0 4 C-12 -4 -10 -14 0 -26 Z" fill="#e07a2e" />
							<path d="M0 -14 C5 -8 6 -2 0 2 C-6 -2 -5 -8 0 -14 Z" fill="#f6c453" />
						}
						@default never;
					}
				}
			</g>

			<g
				class="village-slot village-wall"
				[class.village-slot--selected]="selected() === wall"
				[attr.transform]="'translate(' + map().wall.x + ' ' + map().wall.y + ')' + upright()"
				role="button"
				tabindex="0"
				[attr.aria-label]="slotLabel(wall)"
				[attr.aria-pressed]="selected() === wall"
				(click)="toggle(wall)"
				(keydown.enter)="toggle(wall)"
				(keydown.space)="$event.preventDefault(); toggle(wall)"
			>
				<ellipse class="village-slot__ring" cx="0" cy="0" rx="26" ry="22" />
				@if (present()[wall]; as stone) {
					<circle class="village-building__badge" cx="0" cy="0" r="15" />
					<text class="material-symbols-outlined village-building__icon" x="0" y="1">fort</text>
					@if (levelOf(stone); as level) {
						<g transform="translate(14 -14)">
							<circle class="village-building__level" r="11" />
							<text class="village-building__level-text" y="1">{{ level }}</text>
						</g>
					}
					<text class="village-building__name" x="0" y="26">{{ nameOf(stone) }}</text>
					@if (timeLeft(stone); as left) {
						<g transform="translate(0 46)">
							<rect class="village-building__timer" x="-30" y="-10" width="60" height="20" rx="10" />
							<text class="village-building__timer-text" y="1">{{ left }}</text>
						</g>
					}
				} @else {
					<circle class="village-slot__plot" cx="0" cy="0" r="15" />
					<path class="village-slot__plus" d="M-7 0 H7 M0 -7 V7" />
				}
			</g>

			<g
				class="village-slot"
				[attr.transform]="'translate(' + map().grow.x + ' ' + map().grow.y + ')' + upright()"
				role="button"
				tabindex="0"
				[attr.aria-label]="labels().grow"
				(click)="extend.emit()"
				(keydown.enter)="extend.emit()"
				(keydown.space)="$event.preventDefault(); extend.emit()"
			>
				<ellipse class="village-slot__ring" cx="0" cy="0" rx="46" ry="30" />
				<ellipse class="village-slot__plot village-grow__plot" cx="0" cy="0" rx="40" ry="25" />
				<path class="village-slot__plus village-grow__plus" d="M-8 0 H8 M0 -8 V8" />
			</g>

			@for (tree of map().trees; track $index) {
				<g [attr.transform]="'translate(' + tree.x + ' ' + tree.y + ')' + upright()">
					<ellipse cx="0" [attr.cy]="tree.r * 0.75" [attr.rx]="tree.r * 0.8" [attr.ry]="tree.r * 0.3" fill="rgba(0,0,0,0.18)" />
					@if (tree.conifer) {
						<path [attr.d]="conifer(tree.r)" [attr.fill]="palette().treeDark" />
					} @else {
						<circle cx="0" cy="0" [attr.r]="tree.r" [attr.fill]="palette().treeDark" />
						<circle [attr.cx]="-tree.r * 0.25" [attr.cy]="-tree.r * 0.25" [attr.r]="tree.r * 0.7" [attr.fill]="palette().tree" />
					}
				</g>
			}

			@for (slot of map().slots; track slot.id) {
				<g
					class="village-slot"
					[class.village-slot--selected]="slot.id === selected()"
					[attr.transform]="'translate(' + slot.x + ' ' + slot.y + ')' + upright() + spriteScale()"
					role="button"
					tabindex="0"
					[attr.aria-label]="slotLabel(slot.id)"
					[attr.aria-pressed]="slot.id === selected()"
					(click)="toggle(slot.id)"
					(keydown.enter)="toggle(slot.id)"
					(keydown.space)="$event.preventDefault(); toggle(slot.id)"
				>
					<ellipse class="village-slot__ring" cx="0" cy="0" rx="46" ry="30" />
					<!-- Ground under the plot hides the road that leads into it. -->
					<ellipse cx="0" cy="0" rx="40" ry="25" [attr.fill]="palette().ground" />
					@if (present()[slot.id]; as building) {
						@let level = levelOf(building);
						<ellipse cx="0" cy="14" rx="40" ry="11" fill="rgb(0 0 0 / 0.22)" />
						@if (level) {
							<!-- A low-poly hall: lit west wall, shaded east wall, two-tone roof. -->
							<path d="M-30 16 L-30 -6 L0 -14 L0 10 Z" fill="#efe3c6" />
							<path d="M0 -14 L30 -6 L30 16 L0 10 Z" fill="#cbb994" />
							<path d="M-36 -4 L-4 -36 L0 -14 L-30 -6 Z" fill="#a8583a" />
							<path d="M-4 -36 L36 -4 L30 -6 L0 -14 Z" fill="#7a3a24" />
						} @else {
							<!-- Scaffolding: the first level is still going up. -->
							<path d="M-30 16 L-30 0 L0 -6 L0 10 Z" fill="#d8c8a2" />
							<path d="M0 -6 L30 0 L30 16 L0 10 Z" fill="#b8a47c" />
							<path class="village-scaffold" d="M-32 18 V-22 M32 18 V-22 M0 12 V-30 M-32 -10 H32 M-32 -22 H32 M-32 18 L32 -22" />
						}
						<circle class="village-building__badge" cx="0" cy="1" r="15" />
						<text class="material-symbols-outlined village-building__icon" x="0" y="1">{{ iconOf(building) }}</text>
						@if (level) {
							<g transform="translate(28 -26)">
								<circle class="village-building__level" r="11" />
								<text class="village-building__level-text" y="1">{{ level }}</text>
							</g>
						}
						<!-- The name grows more than the house on small screens, so it stays readable. -->
						<g [attr.transform]="'translate(0 32) scale(' + labelScale() + ')'">
							<text class="village-building__name" x="0" y="0">{{ nameOf(building) }}</text>
							@if (timeLeft(building); as left) {
								<g transform="translate(0 22)">
									<rect class="village-building__timer" x="-30" y="-10" width="60" height="20" rx="10" />
									<text class="village-building__timer-text" y="1">{{ left }}</text>
								</g>
							}
						</g>
					} @else {
						<ellipse class="village-slot__plot" cx="0" cy="0" rx="40" ry="25" />
						<path class="village-slot__plus" d="M-8 0 H8 M0 -8 V8" />
					}
				</g>
			}
			</g>
		</svg>
	`,
	styles: `
		:host {
			display: block;
		}

		:host-context(html[data-mode='dark']) .village-map {
			filter: brightness(0.82) saturate(0.9);
		}

		.village-slot {
			cursor: pointer;
			outline: none;
		}

		.village-building__badge {
			fill: #fff8e8;
			stroke: #7b5a35;
			stroke-width: 2;
		}

		.village-building__icon {
			fill: #5a3a1c;
			font-size: 20px;
			text-anchor: middle;
			dominant-baseline: central;
		}

		.village-building__level {
			fill: #e4a74a;
			stroke: #5a3a1c;
			stroke-width: 2;
		}

		.village-building__level-text {
			fill: #1d140d;
			font-size: 13px;
			font-weight: 700;
			text-anchor: middle;
			dominant-baseline: central;
		}

		.village-scaffold {
			fill: none;
			stroke: #6b4a2c;
			stroke-linecap: round;
			stroke-width: 3;
		}

		.village-building__name {
			fill: #1d140d;
			font-size: 13px;
			font-weight: 700;
			paint-order: stroke;
			stroke: #fff8e8;
			stroke-linejoin: round;
			stroke-width: 3px;
			text-anchor: middle;
			dominant-baseline: central;
			pointer-events: none;
		}

		.village-building__timer {
			fill: rgb(29 20 13 / 0.82);
		}

		.village-building__timer-text {
			fill: #fff8e8;
			font-size: 13px;
			font-variant-numeric: tabular-nums;
			font-weight: 700;
			text-anchor: middle;
			dominant-baseline: central;
		}

		.village-slot__ring {
			fill: none;
			stroke: transparent;
			stroke-width: 4;
		}

		.village-slot__plot {
			fill: rgba(60, 48, 25, 0.16);
			stroke: rgba(60, 48, 25, 0.38);
			stroke-dasharray: 6 5;
			stroke-width: 2.5;
			transition: fill var(--motion-fast) var(--easing);
		}

		.village-slot__plus {
			stroke: rgba(60, 48, 25, 0.55);
			stroke-linecap: round;
			stroke-width: 3;
			opacity: 0;
		}

		.village-slot:focus-visible .village-slot__ring {
			stroke: #fff8e8;
		}

		@media (hover: hover) and (pointer: fine) {
			.village-slot:hover .village-slot__plot {
				fill: rgba(60, 48, 25, 0.26);
			}

			.village-slot:hover .village-slot__plus {
				opacity: 1;
			}
		}

		/* Always showing, unlike the free places, which only show a plus under the pointer. */
		.village-grow__plot {
			stroke-dasharray: 3 7;
		}

		.village-grow__plus {
			opacity: 0.8;
		}

		.village-slot--selected {
			.village-slot__plot {
				fill: rgba(228, 167, 74, 0.45);
				stroke: #8a5a12;
				stroke-dasharray: none;
				stroke-width: 3.5;
			}

			.village-slot__plus {
				stroke: #5c3b0a;
				opacity: 1;
			}
		}
	`,
})
export class VillageMapComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	readonly map = input.required<VillageMap>();
	readonly element = input.required<ElementId>();
	readonly selected = model<number | null>(null);
	/** What stands on each place, by place id. */
	readonly buildings = input<Record<string, VillageBuilding>>({});
	/** What still stands: a building torn down completely is gone once its work is over. */
	protected readonly present = computed(() => standing(this.buildings(), this.now()));
	/** The clock, in epoch milliseconds, so construction shows its progress. */
	readonly now = input(0);
	/** Fill the host's whole box, keeping every slot in view, instead of sizing from the width. */
	readonly fill = input(false);
	/** The plus on open ground was pressed: the page offers one more place to build. */
	readonly extend = output();

	/** The host's box, to tell a phone from a big screen and portrait from landscape. */
	private readonly _box = signal({ width: 0, height: 0 });
	/** Taller than wide: the land turns a quarter round to fit. Only when filling a box. */
	protected readonly portrait = computed(() => this.fill() && isPortrait(this._box()));
	/**
	 * A big screen shows the whole map. A small one frames just the buildings: every place and the
	 * square, with room for a roof above and a name and timer below (sized for buildings grown to
	 * the full scale), so the village fills the screen and its names can be read.
	 */
	protected readonly viewBox = computed(() => {
		const { slots, centre } = this.map();

		return mapViewBox(
			this.map(),
			[centre, ...slots],
			{ side: 95, above: 85, below: 125 },
			this.fill() && isCompact(this._box()),
			this.portrait(),
		);
	});
	protected readonly land = computed(() => landTurn(this.map(), this.portrait()));
	protected readonly upright = computed(() => uprightTurn(this.portrait()));
	private readonly _pixels = computed(() => pixelsPerUnit(this._box(), this.viewBox()));
	/** Buildings grow on small screens, up to 1.6 times, so they stay easy to see and tap. */
	private readonly _sprite = computed(() => growth(this._pixels(), 0.8, 1.6));
	protected readonly spriteScale = computed(() =>
		this._sprite() === 1 ? '' : ` scale(${this._sprite()})`,
	);
	/** Names grow further, inside the grown building, so they read at about 12 pixels. */
	protected readonly labelScale = computed(() => growth(this._pixels(), 0.92, 2.2) / this._sprite());

	protected readonly palette = computed(() => this.map().palette);
	protected readonly planks = [-16, -6, 4, 14];
	protected readonly center = CENTER_PLACE;
	protected readonly wall = WALL_PLACE;
	/** Banner poles round the arena's stands. */
	protected readonly arenaFlags = [
		{ x: -40, y: -12 },
		{ x: 0, y: -24 },
		{ x: 40, y: -12 },
	];
	protected readonly hearthStones = Array.from({ length: 8 }, (_, i) => ({
		x: Math.round(Math.cos((i / 8) * Math.PI * 2) * 18),
		y: Math.round(Math.sin((i / 8) * Math.PI * 2) * 9),
	}));
	protected readonly labels = computed(() => {
		this._languageService.language();

		return {
			map: this._translateService.translate('Мапа поселення')(),
			slot: this._translateService.translate('Вільне місце')(),
			level: this._translateService.translate('рівень')(),
			center: this._translateService.translate('Центр поселення')(),
			wall: this._translateService.translate('Мур')(),
			grow: this._translateService.translate('Розширити поселення')(),
		};
	});

	constructor() {
		const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				this._box.set({ width: entry.contentRect.width, height: entry.contentRect.height });
			}
		});

		observer.observe(host);
		inject(DestroyRef).onDestroy(() => observer.disconnect());
	}

	protected levelOf(building: VillageBuilding): number {
		return levelAt(building, this.now());
	}

	/** Countdown of a construction still running, or an empty string. */
	protected timeLeft(building: VillageBuilding): string {
		const endsAt = workEndsAt(building, this.now());

		return endsAt ? formatDuration((endsAt - this.now()) / 1000) : '';
	}

	protected iconOf(building: VillageBuilding): string {
		return BUILDING_BY_ID[building.type]?.icon ?? 'home';
	}

	protected nameOf(building: VillageBuilding): string {
		this._languageService.language();
		const type = BUILDING_BY_ID[building.type];

		return type ? this._translateService.translate(type.name)() : '';
	}

	protected slotLabel(id: number): string {
		this._languageService.language();
		const building = this.present()[id];
		const type = building && BUILDING_BY_ID[building.type];

		return type
			? `${this._translateService.translate(type.name)()}, ${this.labels().level} ${this.levelOf(building)}`
			: id === CENTER_PLACE
				? this.labels().center
				: id === WALL_PLACE
					? this.labels().wall
					: `${this.labels().slot} ${id}`;
	}

	protected toggle(id: number) {
		this.selected.update((current) => (current === id ? null : id));
	}

	/** A jagged ore rock round its own centre, as on the farm. */
	protected orePath(r: number): string {
		return `M${-r} ${r * 0.4} L${-r * 0.5} ${-r * 0.6} L${r * 0.2} ${-r} L${r} ${-r * 0.1} L${r * 0.7} ${r * 0.5} Z`;
	}

	/** Two stacked triangles, base at the trunk. */
	protected conifer(r: number): string {
		const w = r * 0.95;

		return `M0 ${-r * 1.5} L${w} ${r * 0.2} L${-w} ${r * 0.2} Z M0 ${-r * 0.8} L${w * 1.15} ${r * 0.8} L${-w * 1.15} ${r * 0.8} Z`;
	}
}
