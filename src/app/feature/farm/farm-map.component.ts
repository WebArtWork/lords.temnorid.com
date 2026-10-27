import { Component, computed, DestroyRef, ElementRef, inject, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { Construction } from '../building/building.interface';
import { formatDuration, levelAt, runningUpgrade } from '../building/building.timing';
import { Point } from '../map/map-geometry';
import {
	growth,
	isCompact,
	isPortrait,
	landTurn,
	mapViewBox,
	pixelsPerUnit,
	uprightTurn,
} from '../map/map-view';
import { RESOURCE_BY_ID } from '../resource/resource.data';
import { FarmMap } from './farm.interface';

/** Draws generated farmland. Plots are buttons; the picked one is two-way bound to `selected`. */
@Component({
	selector: 'app-farm-map',
	imports: [RouterLink],
	template: `
		<svg
			class="farm-map block w-full"
			[class.h-auto]="!fill()"
			[class.h-full]="fill()"
			[attr.viewBox]="viewBox()"
			role="group"
			[attr.aria-label]="labels().map"
		>
			<defs>
				<pattern id="farm-furrows" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
					<line x1="0" y1="0" x2="0" y2="12" stroke="#bf9244" stroke-width="3" opacity="0.5" />
				</pattern>
			</defs>

			<!--
				On a portrait screen the land turns a quarter round to fit; everything standing on it
				(plots, houses, peaks, trees, rocks) turns back, so it is seen upright from another side.
			-->
			<g [attr.transform]="land()">

			<!-- Three times the map, so when the map fills a box of another shape the spare room is grass too. -->
			<rect [attr.x]="-map().width" [attr.y]="-map().height" [attr.width]="map().width * 3" [attr.height]="map().height * 3" fill="#86a05a" />

			@for (road of map().roads; track $index) {
				<path [attr.d]="road" fill="none" stroke="#ccb27f" stroke-width="8" stroke-linecap="round" />
			}

			@for (rock of map().rocks; track $index) {
				<g [attr.transform]="at(rock)">
					<ellipse cx="0" cy="0" [attr.rx]="rock.r" [attr.ry]="rock.r * 0.7" fill="#958d84" stroke="#6a625a" stroke-width="2" />
				</g>
			}

			@for (tree of map().trees; track $index) {
				<g [attr.transform]="at(tree)">
					<circle cx="0" cy="0" [attr.r]="tree.r" fill="#3a522a" />
					<circle [attr.cx]="-tree.r * 0.25" [attr.cy]="-tree.r * 0.25" [attr.r]="tree.r * 0.65" fill="#5d7d40" />
				</g>
			}

			@for (zone of map().zones; track $index) {
				@let resource = zone.resource;
				@switch (resource) {
					@case ('wood') {
						<path [attr.d]="zone.path" fill="#45632f" />
						@for (tree of zone.decor; track $index) {
							<g [attr.transform]="at(tree)">
								<circle cx="0" cy="0" [attr.r]="tree.r" fill="#2f4524" />
								<circle [attr.cx]="-tree.r * 0.25" [attr.cy]="-tree.r * 0.25" [attr.r]="tree.r * 0.65" fill="#557538" />
							</g>
						}
					}
					@case ('stone') {
						<path [attr.d]="zone.path" fill="#b0a897" />
						@for (peak of zone.decor; track $index) {
							<g [attr.transform]="at(peak)">
								<path [attr.d]="peakPath(peak.r)" fill="#8c8579" />
								<path [attr.d]="peakLight(peak.r)" fill="#d3ccbe" />
							</g>
						}
					}
					@case ('iron') {
						<path [attr.d]="zone.path" fill="#655c55" />
						@for (rock of zone.decor; track $index) {
							<g [attr.transform]="at(rock)">
								<path [attr.d]="shardPath(rock.r)" fill="#463f3a" />
								<circle [attr.cx]="rock.r * 0.2" [attr.cy]="-rock.r * 0.1" [attr.r]="rock.r * 0.22" fill="#b0603c" />
							</g>
						}
					}
					@case ('water') {
						<path [attr.d]="zone.path" fill="#5f97ad" stroke="#4a7f94" stroke-width="4" />
						@for (inner of zone.inner; track $index) {
							<path [attr.d]="inner" fill="#7fb1c4" />
						}
					}
					@case ('grain') {
						<path [attr.d]="zone.path" fill="#dcb35e" stroke="#bf9244" stroke-width="3" />
						<path [attr.d]="zone.path" fill="url(#farm-furrows)" />
					}
					@case ('clay') {
						<path [attr.d]="zone.path" fill="#b07448" stroke="#8a5533" stroke-width="3" />
						@for (inner of zone.inner; track $index) {
							<path [attr.d]="inner" fill="none" stroke="#7d4a2c" stroke-width="5" opacity="0.55" />
						}
					}
					@default never;
				}
			}

			<a class="farm-village" routerLink="/village" [attr.aria-label]="labels().village">
				<path [attr.d]="map().village.path" fill="#d8c08c" stroke="#7b5a35" stroke-width="6" stroke-dasharray="4 3" />
				@for (house of houses; track $index) {
					<g [attr.transform]="at({ x: map().village.x + house.x, y: map().village.y + house.y })">
						<rect x="-9" y="-4" width="18" height="12" fill="#efe3c6" stroke="#7b5a35" stroke-width="1.5" />
						<path d="M-12 -4 L0 -14 L12 -4 Z" fill="#8f4a2e" />
					</g>
				}
			</a>

			@for (plot of map().plots; track plot.id) {
				<g
					class="farm-plot"
					[class.farm-plot--selected]="plot.id === selected()"
					[attr.transform]="at(plot) + plotScale()"
					role="button"
					tabindex="0"
					[attr.aria-label]="labels().names[plot.resource] + ', ' + labels().level + ' ' + levelOf(plot.id)"
					[attr.aria-pressed]="plot.id === selected()"
					(click)="toggle(plot.id)"
					(keydown.enter)="toggle(plot.id)"
					(keydown.space)="$event.preventDefault(); toggle(plot.id)"
				>
					<circle class="farm-plot__ring" r="29" />
					<circle class="farm-plot__disc" r="23" [attr.stroke]="resources[plot.resource].color" />
					<text class="material-symbols-outlined farm-plot__icon" text-anchor="middle" dominant-baseline="central" [attr.fill]="resources[plot.resource].color">
						{{ resources[plot.resource].icon }}
					</text>
					@if (levelOf(plot.id); as level) {
						<g transform="translate(24 -24)">
							<circle class="farm-plot__level" r="16" />
							<text class="farm-plot__level-text" y="1">{{ level }}</text>
						</g>
					}
					@if (timeLeft(plot.id); as left) {
						<g transform="translate(0 39)">
							<rect class="farm-plot__timer" x="-28" y="-10" width="56" height="20" rx="10" />
							<text class="farm-plot__timer-text" y="1">{{ left }}</text>
						</g>
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

		:host-context(html[data-mode='dark']) .farm-map {
			filter: brightness(0.82) saturate(0.9);
		}

		.farm-plot__level {
			fill: #e4a74a;
			stroke: #5a3a1c;
			stroke-width: 2;
		}

		.farm-plot__level-text,
		.farm-plot__timer-text {
			font-size: 12px;
			font-weight: 700;
			text-anchor: middle;
			dominant-baseline: central;
		}

		.farm-plot__level-text {
			fill: #1d140d;
			font-size: 24px;
		}

		.farm-plot__timer {
			fill: rgb(29 20 13 / 0.82);
		}

		.farm-plot__timer-text {
			fill: #fff8e8;
			font-variant-numeric: tabular-nums;
		}

		.farm-village {
			cursor: pointer;
			outline: none;

			&:focus-visible path:first-child {
				stroke: #fff8e8;
			}
		}

		.farm-plot {
			cursor: pointer;
			outline: none;
		}

		.farm-plot__ring {
			fill: none;
			stroke: transparent;
			stroke-width: 4;
		}

		.farm-plot__disc {
			fill: #fffaf0;
			stroke-width: 5;
		}

		.farm-plot__icon {
			font-size: 25px;
			pointer-events: none;
		}

		.farm-plot:focus-visible .farm-plot__ring {
			stroke: #fff8e8;
		}

		@media (hover: hover) and (pointer: fine) {
			.farm-plot:hover .farm-plot__ring {
				stroke: rgba(255, 248, 232, 0.7);
			}
		}

		.farm-plot--selected .farm-plot__ring {
			stroke: #e4a74a;
			stroke-width: 6;
		}
	`,
})
export class FarmMapComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	readonly map = input.required<FarmMap>();
	readonly selected = model<number | null>(null);
	/** Fill the host's whole box, keeping every plot in view, instead of sizing from the width. */
	readonly fill = input(false);
	/** How far each plot has been worked, by plot id. */
	readonly levels = input<Record<string, Construction>>({});
	/** The clock, in epoch milliseconds, so work in progress shows its countdown. */
	readonly now = input(0);

	/** The host's box, to tell a phone from a big screen and portrait from landscape. */
	private readonly _box = signal({ width: 0, height: 0 });
	protected readonly portrait = computed(() => this.fill() && isPortrait(this._box()));
	/**
	 * A big screen shows the whole map. A small one frames just the plots and the village, with
	 * room for a level badge above and a timer below (sized for plots grown to the full scale), so
	 * the plots fill the screen and stay readable.
	 */
	protected readonly viewBox = computed(() => {
		const { plots, village } = this.map();

		return mapViewBox(
			this.map(),
			[village, ...plots],
			{ side: 85, above: 85, below: 105 },
			this.fill() && isCompact(this._box()),
			this.portrait(),
		);
	});
	protected readonly land = computed(() => landTurn(this.map(), this.portrait()));
	protected readonly upright = computed(() => uprightTurn(this.portrait()));
	/**
	 * Plots grow on small screens so icons, levels and timers read and tap easily, up to 1.25 times:
	 * a plot's disc is 46 units across and plots stand at least 70 apart, so even fully grown
	 * neighbours keep a clear gap.
	 */
	private readonly _plot = computed(() =>
		growth(pixelsPerUnit(this._box(), this.viewBox()), 0.9, 1.25),
	);
	protected readonly plotScale = computed(() => (this._plot() === 1 ? '' : ` scale(${this._plot()})`));

	protected readonly resources = RESOURCE_BY_ID;
	protected readonly houses = [
		{ x: -30, y: -10 },
		{ x: 4, y: -22 },
		{ x: 34, y: -6 },
		{ x: -14, y: 18 },
		{ x: 22, y: 20 },
	];
	protected readonly labels = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();

		return {
			map: t('Мапа угідь'),
			village: t('Перейти до поселення'),
			level: t('рівень'),
			names: Object.fromEntries(
				Object.values(RESOURCE_BY_ID).map((r) => [r.id, t(r.name)]),
			) as Record<string, string>,
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

	protected levelOf(id: number): number {
		const saved = this.levels()[id];

		return saved ? levelAt(saved, this.now()) : 0;
	}

	/** Countdown of work still running on a plot, or an empty string. */
	protected timeLeft(id: number): string {
		const saved = this.levels()[id];
		const running = saved && runningUpgrade(saved, this.now());

		return running ? formatDuration((running.endsAt - this.now()) / 1000) : '';
	}

	protected toggle(id: number) {
		this.selected.update((current) => (current === id ? null : id));
	}

	/** Where a standing thing goes: moved to its spot and, on turned land, turned back upright. */
	protected at(point: Point): string {
		return `translate(${point.x} ${point.y})${this.upright()}`;
	}

	/** A mountain round its own centre: one triangle, plus its sunlit left face. */
	protected peakPath(r: number): string {
		return `M${-r} ${r * 0.5} L0 ${-r} L${r} ${r * 0.5} Z`;
	}

	protected peakLight(r: number): string {
		return `M${-r} ${r * 0.5} L0 ${-r} L${-r * 0.15} ${r * 0.5} Z`;
	}

	/** A jagged ore rock round its own centre. */
	protected shardPath(r: number): string {
		return `M${-r} ${r * 0.4} L${-r * 0.5} ${-r * 0.6} L${r * 0.2} ${-r} L${r} ${-r * 0.1} L${r * 0.7} ${r * 0.5} Z`;
	}
}
