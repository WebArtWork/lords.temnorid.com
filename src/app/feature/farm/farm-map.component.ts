import { Component, computed, inject, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { RESOURCE_BY_ID } from '../resource/resource.data';
import { FarmMap } from './farm.interface';

/** Draws generated farmland. Plots are buttons; the picked one is two-way bound to `selected`. */
@Component({
	selector: 'app-farm-map',
	imports: [RouterLink],
	template: `
		<svg
			class="farm-map block h-auto w-full"
			[attr.viewBox]="'0 0 ' + map().width + ' ' + map().height"
			role="group"
			[attr.aria-label]="labels().map"
		>
			<defs>
				<pattern id="farm-furrows" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
					<line x1="0" y1="0" x2="0" y2="12" stroke="#bf9244" stroke-width="3" opacity="0.5" />
				</pattern>
			</defs>

			<rect [attr.width]="map().width" [attr.height]="map().height" fill="#86a05a" />

			@for (road of map().roads; track $index) {
				<path [attr.d]="road" fill="none" stroke="#ccb27f" stroke-width="8" stroke-linecap="round" />
			}

			@for (rock of map().rocks; track $index) {
				<ellipse [attr.cx]="rock.x" [attr.cy]="rock.y" [attr.rx]="rock.r" [attr.ry]="rock.r * 0.7" fill="#958d84" stroke="#6a625a" stroke-width="2" />
			}

			@for (tree of map().trees; track $index) {
				<circle [attr.cx]="tree.x" [attr.cy]="tree.y" [attr.r]="tree.r" fill="#3a522a" />
				<circle [attr.cx]="tree.x - tree.r * 0.25" [attr.cy]="tree.y - tree.r * 0.25" [attr.r]="tree.r * 0.65" fill="#5d7d40" />
			}

			@for (zone of map().zones; track $index) {
				@let resource = zone.resource;
				@switch (resource) {
					@case ('wood') {
						<path [attr.d]="zone.path" fill="#45632f" />
						@for (tree of zone.decor; track $index) {
							<circle [attr.cx]="tree.x" [attr.cy]="tree.y" [attr.r]="tree.r" fill="#2f4524" />
							<circle [attr.cx]="tree.x - tree.r * 0.25" [attr.cy]="tree.y - tree.r * 0.25" [attr.r]="tree.r * 0.65" fill="#557538" />
						}
					}
					@case ('stone') {
						<path [attr.d]="zone.path" fill="#b0a897" />
						@for (peak of zone.decor; track $index) {
							<path [attr.d]="peakPath(peak.x, peak.y, peak.r)" fill="#8c8579" />
							<path [attr.d]="peakLight(peak.x, peak.y, peak.r)" fill="#d3ccbe" />
						}
					}
					@case ('iron') {
						<path [attr.d]="zone.path" fill="#655c55" />
						@for (rock of zone.decor; track $index) {
							<path [attr.d]="shardPath(rock.x, rock.y, rock.r)" fill="#463f3a" />
							<circle [attr.cx]="rock.x + rock.r * 0.2" [attr.cy]="rock.y - rock.r * 0.1" [attr.r]="rock.r * 0.22" fill="#b0603c" />
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
					<g [attr.transform]="'translate(' + (map().village.x + house.x) + ' ' + (map().village.y + house.y) + ')'">
						<rect x="-9" y="-4" width="18" height="12" fill="#efe3c6" stroke="#7b5a35" stroke-width="1.5" />
						<path d="M-12 -4 L0 -14 L12 -4 Z" fill="#8f4a2e" />
					</g>
				}
			</a>

			@for (plot of map().plots; track plot.id) {
				<g
					class="farm-plot"
					[class.farm-plot--selected]="plot.id === selected()"
					[attr.transform]="'translate(' + plot.x + ' ' + plot.y + ')'"
					role="button"
					tabindex="0"
					[attr.aria-label]="labels().names[plot.resource] + ', ' + labels().plot + ' ' + plot.id"
					[attr.aria-pressed]="plot.id === selected()"
					(click)="toggle(plot.id)"
					(keydown.enter)="toggle(plot.id)"
					(keydown.space)="$event.preventDefault(); toggle(plot.id)"
				>
					<circle class="farm-plot__ring" r="25" />
					<circle class="farm-plot__disc" r="19" [attr.stroke]="resources[plot.resource].color" />
					<text class="material-symbols-outlined farm-plot__icon" text-anchor="middle" dominant-baseline="central" [attr.fill]="resources[plot.resource].color">
						{{ resources[plot.resource].icon }}
					</text>
				</g>
			}
		</svg>
	`,
	styles: `
		:host {
			display: block;
		}

		:host-context(html[data-mode='dark']) .farm-map {
			filter: brightness(0.82) saturate(0.9);
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
			font-size: 20px;
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
			plot: t('ділянка'),
			names: Object.fromEntries(
				Object.values(RESOURCE_BY_ID).map((r) => [r.id, t(r.name)]),
			) as Record<string, string>,
		};
	});

	protected toggle(id: number) {
		this.selected.update((current) => (current === id ? null : id));
	}

	/** A mountain: one triangle, plus its sunlit left face. */
	protected peakPath(x: number, y: number, r: number): string {
		return `M${x - r} ${y + r * 0.5} L${x} ${y - r} L${x + r} ${y + r * 0.5} Z`;
	}

	protected peakLight(x: number, y: number, r: number): string {
		return `M${x - r} ${y + r * 0.5} L${x} ${y - r} L${x - r * 0.15} ${y + r * 0.5} Z`;
	}

	/** A jagged ore rock. */
	protected shardPath(x: number, y: number, r: number): string {
		return `M${x - r} ${y + r * 0.4} L${x - r * 0.5} ${y - r * 0.6} L${x + r * 0.2} ${y - r} L${x + r} ${y - r * 0.1} L${x + r * 0.7} ${y + r * 0.5} Z`;
	}
}
