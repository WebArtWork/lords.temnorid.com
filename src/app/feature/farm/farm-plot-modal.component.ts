import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { RESOURCE_BY_ID } from '../resource/resource.data';
import { FarmPlot } from './farm.interface';

/**
 * What a farm plot yields, opened through ModalService. ModalService copies its options onto this
 * instance, so `plot` and `close` are plain fields set before the first render.
 */
@Component({
	selector: 'app-farm-plot-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="farm-plot-modal-title" class="t-heading flex items-center gap-2">
				<span
					class="material-symbols-outlined"
					[style.color]="resource.color"
					aria-hidden="true"
					>{{ resource.icon }}</span
				>
				<span
					><span [translate]="resource.name">{{ resource.name }}</span
					>, <span translate>ділянка</span> {{ plot.id }}</span
				>
			</h2>
			<p class="mt-3 text-[var(--c-text-muted)]" translate>Видобуток з'явиться згодом.</p>
			<div class="mt-6 flex justify-end">
				<button class="btn btn--primary" (click)="close()" type="button" translate>
					Зрозуміло
				</button>
			</div>
		</div>
	`,
})
export class FarmPlotModalComponent {
	plot!: FarmPlot;
	close: () => void = () => {};

	protected get resource() {
		return RESOURCE_BY_ID[this.plot.resource];
	}
}
