import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';

/** What the world page says about a tile. Text is already translated. */
export interface WorldTileInfo {
	x: number;
	y: number;
	/** Material Symbols icon and its colour. */
	icon: string;
	color: string;
	title: string;
	detail: string;
	quarter: string;
}

/**
 * Describes a world tile, opened through ModalService. ModalService copies its options onto this
 * instance, so `info` and `close` are plain fields set before the first render.
 */
@Component({
	selector: 'app-world-tile-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="world-tile-modal-title" class="t-heading flex items-center gap-2 pr-10">
				<span
					class="material-symbols-outlined"
					[style.color]="info.color"
					aria-hidden="true"
					>{{ info.icon }}</span
				>
				<span>{{ info.title }}</span>
				<span class="t-numeral ml-auto text-lg tabular-nums text-[var(--c-text-muted)]"
					>({{ info.x }}|{{ info.y }})</span
				>
			</h2>
			@if (info.detail) {
				<p class="mt-3">{{ info.detail }}</p>
			}
			<p class="mt-3 text-sm text-[var(--c-text-muted)]">
				<span translate>Чверть світу</span>: {{ info.quarter }}
			</p>
			<div class="mt-6 flex justify-end">
				<button class="btn btn--primary" (click)="close()" type="button" translate>
					Зрозуміло
				</button>
			</div>
		</div>
	`,
})
export class WorldTileModalComponent {
	info!: WorldTileInfo;
	close: () => void = () => {};
}
