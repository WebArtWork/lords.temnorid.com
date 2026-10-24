import { Component, computed, inject, input, model } from '@angular/core';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { ElementId } from '../element/element.interface';
import { VillageMap } from './village.interface';

/** Draws a generated village. Slots are buttons; the picked one is two-way bound to `selected`. */
@Component({
	selector: 'app-village-map',
	template: `
		<svg
			class="village-map block w-full"
			[class.h-auto]="!fill()"
			[class.h-full]="fill()"
			[attr.viewBox]="'0 0 ' + map().width + ' ' + map().height"
			role="group"
			[attr.aria-label]="labels().map"
		>
			<defs>
				<pattern id="village-furrows" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
					<line x1="0" y1="0" x2="0" y2="12" [attr.stroke]="palette().fieldLine" stroke-width="3" opacity="0.45" />
				</pattern>
			</defs>

			<!-- Three times the map, so when the map fills a box of another shape the spare room is ground too. -->
			<rect [attr.x]="-map().width" [attr.y]="-map().height" [attr.width]="map().width * 3" [attr.height]="map().height * 3" [attr.fill]="palette().outer" />

			@for (field of map().fields; track $index) {
				<path [attr.d]="field" [attr.fill]="palette().field" [attr.stroke]="palette().fieldLine" stroke-width="3" />
				<path [attr.d]="field" fill="url(#village-furrows)" />
			}

			@for (rock of map().rocks; track $index) {
				<ellipse [attr.cx]="rock.x" [attr.cy]="rock.y + rock.r * 0.35" [attr.rx]="rock.r" [attr.ry]="rock.r * 0.75" [attr.fill]="palette().rockShade" />
				<ellipse [attr.cx]="rock.x" [attr.cy]="rock.y" [attr.rx]="rock.r * 0.9" [attr.ry]="rock.r * 0.7" [attr.fill]="palette().rock" />
			}

			<path [attr.d]="map().boundary" [attr.fill]="palette().ground" [attr.stroke]="palette().groundEdge" stroke-width="6" />

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
				<ellipse [attr.cx]="rock.x" [attr.cy]="rock.y + rock.r * 0.3" [attr.rx]="rock.r" [attr.ry]="rock.r * 0.8" [attr.fill]="palette().rockShade" />
				<ellipse [attr.cx]="rock.x - rock.r * 0.1" [attr.cy]="rock.y - rock.r * 0.1" [attr.rx]="rock.r * 0.85" [attr.ry]="rock.r * 0.68" [attr.fill]="palette().rock" />
			}

			<path [attr.d]="map().plaza" [attr.fill]="palette().plaza" />

			<!-- The heart of the village: the first stone, or the fire everyone gathers around. -->
			<g [attr.transform]="'translate(' + map().centre.x + ' ' + map().centre.y + ')'" aria-hidden="true">
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
			</g>

			@for (tree of map().trees; track $index) {
				<g [attr.transform]="'translate(' + tree.x + ' ' + tree.y + ')'">
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
					[attr.transform]="'translate(' + slot.x + ' ' + slot.y + ')'"
					role="button"
					tabindex="0"
					[attr.aria-label]="labels().slot + ' ' + slot.id"
					[attr.aria-pressed]="slot.id === selected()"
					(click)="toggle(slot.id)"
					(keydown.enter)="toggle(slot.id)"
					(keydown.space)="$event.preventDefault(); toggle(slot.id)"
				>
					<ellipse class="village-slot__ring" cx="0" cy="0" rx="46" ry="30" />
					<!-- Ground under the plot hides the road that leads into it. -->
					<ellipse cx="0" cy="0" rx="40" ry="25" [attr.fill]="palette().ground" />
					<ellipse class="village-slot__plot" cx="0" cy="0" rx="40" ry="25" />
					<path class="village-slot__plus" d="M-8 0 H8 M0 -8 V8" />
				</g>
			}
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
	/** Fill the host's whole box, keeping every slot in view, instead of sizing from the width. */
	readonly fill = input(false);

	protected readonly palette = computed(() => this.map().palette);
	protected readonly planks = [-16, -6, 4, 14];
	protected readonly hearthStones = Array.from({ length: 8 }, (_, i) => ({
		x: Math.round(Math.cos((i / 8) * Math.PI * 2) * 18),
		y: Math.round(Math.sin((i / 8) * Math.PI * 2) * 9),
	}));
	protected readonly labels = computed(() => {
		this._languageService.language();

		return {
			map: this._translateService.translate('Мапа поселення')(),
			slot: this._translateService.translate('Вільне місце')(),
		};
	});

	protected toggle(id: number) {
		this.selected.update((current) => (current === id ? null : id));
	}

	/** Two stacked triangles, base at the trunk. */
	protected conifer(r: number): string {
		const w = r * 0.95;

		return `M0 ${-r * 1.5} L${w} ${r * 0.2} L${-w} ${r * 0.2} Z M0 ${-r * 0.8} L${w * 1.15} ${r * 0.8} L${-w * 1.15} ${r * 0.8} Z`;
	}
}
