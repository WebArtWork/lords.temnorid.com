import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';

/**
 * What a free building place offers, opened through ModalService. ModalService copies its options
 * onto this instance, so `slot` and `close` are plain fields set before the first render.
 */
@Component({
	selector: 'app-village-slot-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="village-slot-modal-title" class="t-heading">
				<span translate>Вільне місце</span> {{ slot }}
			</h2>
			<p class="mt-3 text-[var(--c-text-muted)]" translate>
				Тут постане будівля. Будівництво з'явиться згодом.
			</p>
			<div class="mt-6 flex justify-end">
				<button class="btn btn--primary" (click)="close()" type="button" translate>
					Зрозуміло
				</button>
			</div>
		</div>
	`,
})
export class VillageSlotModalComponent {
	slot = 0;
	close: () => void = () => {};
}
