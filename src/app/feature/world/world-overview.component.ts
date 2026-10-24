import { Component, computed, inject } from '@angular/core';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { buildScene } from './world.scene';

/** Tiles from the heart shown in every direction: enough to fit Terebovlia and Chernivtsi with their labels. */
const REACH = 39;
const TILE = 8;
const SIZE = (REACH * 2 + 1) * TILE;

/**
 * The whole land at a glance, with the heart in the middle and the four quarters marked. Drawn
 * once, behind the quarter choice in onboarding. Decorative: the choice itself is the radio list.
 */
@Component({
	selector: 'app-world-overview',
	template: `
		<svg
			class="block h-full w-full"
			[attr.viewBox]="'0 0 ' + size + ' ' + size"
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
		>
			@for (facet of scene.facets; track facet.fill) {
				<path
					[attr.d]="facet.d"
					[attr.fill]="facet.fill"
					[attr.stroke]="facet.fill"
					stroke-width="0.6"
				/>
			}
			@for (river of scene.rivers; track $index) {
				<path
					[attr.d]="river.d"
					fill="none"
					stroke="#3f6f86"
					[attr.stroke-width]="river.width + 1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					[attr.d]="river.d"
					fill="none"
					stroke="#6aa6bd"
					[attr.stroke-width]="river.width"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			}

			<!-- The quarters meet at the heart. -->
			<path
				[attr.d]="'M' + half + ' 0 V' + size + ' M0 ' + half + ' H' + size"
				stroke="rgb(29 20 13 / 0.45)"
				stroke-width="2"
				stroke-dasharray="8 6"
			/>

			@for (place of scene.cities; track place.city.id) {
				<g [attr.transform]="'translate(' + place.x + ' ' + place.y + ')'">
					<path
						d="M-7 5 L-7 -3 L0 -6 L0 2 Z"
						fill="#e6dfcf"
						stroke="#3a2a1c"
						stroke-width="1"
					/>
					<path
						d="M0 -6 L7 -3 L7 5 L0 2 Z"
						fill="#a39a86"
						stroke="#3a2a1c"
						stroke-width="1"
					/>
					<text class="overview-label" y="20">{{ names()[place.city.id] }}</text>
				</g>
			}
		</svg>
	`,
	styles: `
		:host {
			display: block;
		}

		:host-context(html[data-mode='dark']) svg {
			filter: brightness(0.82) saturate(0.9);
		}

		.overview-label {
			fill: #1d140d;
			font-family: var(--ff-serif);
			font-size: 17px;
			font-weight: 700;
			text-anchor: middle;
			paint-order: stroke;
			stroke: rgb(254 251 245 / 0.9);
			stroke-width: 4px;
			stroke-linejoin: round;
		}
	`,
})
export class WorldOverviewComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	protected readonly size = SIZE;
	protected readonly half = SIZE / 2;
	protected readonly scene = buildScene({
		firstX: -REACH,
		firstY: -REACH,
		cols: REACH * 2 + 1,
		rows: REACH * 2 + 1,
		tile: TILE,
		counts: null,
	});
	protected readonly names = computed(() => {
		this._languageService.language();

		return Object.fromEntries(
			this.scene.cities.map(({ city }) => [
				city.id,
				this._translateService.translate(city.name)(),
			]),
		) as Record<string, string>;
	});
}
