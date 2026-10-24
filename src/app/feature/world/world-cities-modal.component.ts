import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { CITIES, WorldCity } from './world.geography';

/**
 * The towns of the world, to jump to one, opened through ModalService. ModalService copies its
 * options onto this instance, so `go` and `close` are plain fields.
 */
@Component({
	selector: 'app-world-cities-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="world-cities-modal-title" class="t-heading" translate>Міста</h2>
			<ul class="mt-4 grid gap-2">
				@for (city of cities; track city.id) {
					<li>
						<button class="world-city-choice" (click)="pick(city)" type="button">
							<span
								class="material-symbols-outlined text-[var(--c-primary-text)]"
								aria-hidden="true"
								>castle</span
							>
							<span class="flex-1">
								<span class="t-item block" [translate]="city.name">{{
									city.name
								}}</span>
								<span
									class="mt-0.5 block text-sm text-[var(--c-text-muted)]"
									[translate]="city.about"
									>{{ city.about }}</span
								>
							</span>
							<span class="t-numeral tabular-nums text-[var(--c-text-muted)]"
								>({{ city.x }}|{{ city.y }})</span
							>
						</button>
					</li>
				}
			</ul>
		</div>
	`,
	styles: `
		.world-city-choice {
			display: flex;
			width: 100%;
			align-items: flex-start;
			gap: 0.75rem;
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius);
			padding: 0.75rem;
			text-align: left;
			cursor: pointer;

			&:hover {
				border-color: var(--c-primary);
				background: var(--c-bg-tertiary);
			}

			&:focus-visible {
				outline: none;
				box-shadow: var(--focus-ring);
			}
		}
	`,
})
export class WorldCitiesModalComponent {
	go: (city: WorldCity) => void = () => {};
	close: () => void = () => {};

	protected readonly cities = CITIES;

	protected pick(city: WorldCity) {
		this.go(city);
		this.close();
	}
}
