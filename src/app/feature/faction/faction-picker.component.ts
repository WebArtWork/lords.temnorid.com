import { Component, input, output } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { FactionId, FACTIONS } from './faction.data';

/** The four factions as a choice of cards; picking one asks the page to join it. */
@Component({
	selector: 'app-faction-picker',
	imports: [TranslateDirective],
	template: `
		<fieldset [disabled]="busy()">
			<legend class="sr-only" translate>Фракція</legend>
			<div class="grid gap-3 sm:grid-cols-2">
				@for (faction of factions; track faction.id) {
					<label
						class="faction"
						[class.faction--chosen]="faction.id === chosen()"
						[style.--faction]="faction.color"
					>
						<input
							class="sr-only"
							[checked]="faction.id === chosen()"
							(change)="pick.emit(faction.id)"
							name="faction"
							type="radio"
							[value]="faction.id"
						/>
						<span class="flex items-center gap-3">
							<span
								class="faction__icon material-symbols-outlined"
								aria-hidden="true"
								>{{ faction.icon }}</span
							>
							<span
								class="min-w-0 flex-1 font-semibold text-[var(--c-text-strong)]"
								[translate]="faction.name"
								>{{ faction.name }}</span
							>
							@if (faction.id === chosen()) {
								<span
									class="material-symbols-outlined faction__check"
									aria-hidden="true"
									>check_circle</span
								>
							}
						</span>
						<span
							class="mt-2 block text-sm leading-6 text-[var(--c-text-muted)]"
							[translate]="faction.summary"
							>{{ faction.summary }}</span
						>
						<span class="mt-2 block text-sm leading-6">
							<span class="text-[var(--c-text-muted)]" translate>Мета</span>:
							<span [translate]="faction.goal">{{ faction.goal }}</span>
						</span>
						<span class="mt-1 block text-sm leading-6">
							<span class="text-[var(--c-text-muted)]" translate>Знак</span>:
							<span [translate]="faction.emblem">{{ faction.emblem }}</span>
						</span>
					</label>
				}
			</div>
		</fieldset>
	`,
	styles: `
		.faction {
			display: block;
			border: 1px solid var(--c-border);
			border-left: 4px solid var(--faction);
			border-radius: var(--t-radius);
			padding: 0.875rem;
			cursor: pointer;
			transition: border-color var(--motion-fast) var(--easing);

			&:has(input:focus-visible) {
				box-shadow: var(--focus-ring);
			}
		}

		@media (hover: hover) and (pointer: fine) {
			.faction:hover {
				border-color: var(--faction);
			}
		}

		.faction--chosen {
			border-color: var(--faction);
			background: color-mix(in srgb, var(--faction) 12%, transparent);
		}

		.faction__icon {
			color: var(--faction);
			font-size: 28px;
		}

		.faction__check {
			color: var(--faction);
		}

		fieldset:disabled .faction {
			cursor: progress;
			opacity: 0.7;
		}
	`,
})
export class FactionPickerComponent {
	readonly chosen = input<FactionId | null>(null);
	readonly busy = input(false);
	readonly pick = output<FactionId>();

	protected readonly factions = FACTIONS;
}
