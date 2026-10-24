import { Component, OnInit, signal } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { Point } from '../map/map-geometry';

/**
 * Asks for the coordinates to go to on the world map, opened through ModalService. ModalService
 * copies its options onto this instance, so `from`, `go` and `close` are plain fields.
 */
@Component({
	selector: 'app-world-jump-modal',
	imports: [TranslateDirective],
	template: `
		<form class="p-1" (submit)="$event.preventDefault(); submit()">
			<h2 id="world-jump-modal-title" class="t-heading" translate>Куди перейти?</h2>
			<div class="mt-4 grid grid-cols-2 gap-3">
				<label class="block">
					<span class="writer-label">X</span>
					<input
						class="writer-input w-full"
						inputmode="numeric"
						name="x"
						type="number"
						[value]="x()"
						(input)="x.set($any($event.target).value)"
					/>
				</label>
				<label class="block">
					<span class="writer-label">Y</span>
					<input
						class="writer-input w-full"
						inputmode="numeric"
						name="y"
						type="number"
						[value]="y()"
						(input)="y.set($any($event.target).value)"
					/>
				</label>
			</div>
			<div class="mt-6 flex justify-end">
				<button class="btn btn--primary" type="submit">
					<span class="material-symbols-outlined" aria-hidden="true">travel_explore</span>
					<span translate>Перейти</span>
				</button>
			</div>
		</form>
	`,
})
export class WorldJumpModalComponent implements OnInit {
	from: Point = { x: 0, y: 0 };
	go: (point: Point) => void = () => {};
	close: () => void = () => {};

	protected readonly x = signal('0');
	protected readonly y = signal('0');

	ngOnInit() {
		this.x.set(String(this.from.x));
		this.y.set(String(this.from.y));
	}

	protected submit() {
		const x = Math.round(Number(this.x()));
		const y = Math.round(Number(this.y()));

		if (Number.isFinite(x) && Number.isFinite(y)) {
			this.go({ x, y });
			this.close();
		}
	}
}
