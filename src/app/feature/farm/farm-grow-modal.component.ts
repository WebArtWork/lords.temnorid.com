import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { nowSignal } from '../building/building.timing';
import { newPlotCost, shortfall, stockAt } from '../economy/economy';
import { GameService } from '../game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';

/** Buying more plots for the farm, opened through ModalService. Each extra plot of a resource costs more. */
@Component({
	selector: 'app-farm-grow-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="farm-grow-modal-title" class="t-heading pr-10" translate>Розширити угіддя</h2>
			<p class="mt-2 text-sm text-[var(--c-text-muted)]" translate>
				Кожна наступна ділянка того самого ресурсу коштує набагато більше за попередню.
			</p>

			<ul class="mt-4 grid gap-3" [class.sm:grid-cols-2]="!only">
				@for (option of options(); track option.id) {
					<li class="grow-option" [class.grow-option--locked]="option.short">
						<div class="flex items-center gap-3">
							<span
								class="material-symbols-outlined text-[28px]"
								[style.color]="option.color"
								aria-hidden="true"
								>{{ option.icon }}</span
							>
							<div class="min-w-0 flex-1">
								<p class="font-semibold text-[var(--c-text-strong)]">{{ option.label }}</p>
								<p class="text-sm text-[var(--c-text-muted)]">
									<span translate>Ділянок</span>:
									<span class="tabular-nums">{{ option.plots }}</span>
								</p>
							</div>
						</div>
						<ul class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
							@for (part of option.cost; track part.id) {
								<li class="flex items-center gap-1" [title]="part.label">
									<span
										class="material-symbols-outlined text-[18px]"
										[style.color]="part.color"
										aria-hidden="true"
										>{{ part.icon }}</span
									>
									<span class="sr-only">{{ part.label }}:</span>
									<span class="tabular-nums" [class.grow-option__short]="part.short">{{
										part.amount
									}}</span>
								</li>
							}
						</ul>
						<button
							class="btn btn--primary mt-3"
							[disabled]="option.short || busy() !== null"
							(click)="buy(option.id)"
							type="button"
						>
							<span class="material-symbols-outlined" aria-hidden="true">add_location_alt</span>
							<span translate>Додати ділянку</span>
						</button>
					</li>
				}
			</ul>

			@if (error()) {
				<p class="mt-4 text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося додати ділянку. Спробуйте ще раз.
				</p>
			}
		</div>
	`,
	styles: `
		.grow-option {
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius);
			padding: 0.875rem;
		}

		.grow-option--locked {
			opacity: 0.8;
		}

		.grow-option__short {
			color: var(--c-secondary);
			font-weight: 700;
		}
	`,
})
export class FarmGrowModalComponent {
	private readonly _game = inject(GameService);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	/** Offers only this resource, when the modal was opened from its patch. */
	only: ResourceId | null = null;
	/** The patch of that resource the plot grows. */
	patch = 0;
	close: () => void = () => {};

	protected readonly busy = signal<ResourceId | null>(null);
	protected readonly error = signal(false);

	protected readonly options = computed(() => {
		this._languageService.language();
		const game = this._game.game();

		if (!game) {
			return [];
		}

		const t = (text: string) => this._translateService.translate(text)();
		const now = this._now();
		const buildings = game.village.buildings ?? {};
		const stock = stockAt(game.stock, game.farm.plots, game.farm.levels ?? {}, buildings, now);

		return RESOURCES.filter((resource) => !this.only || resource.id === this.only).map((resource) => {
			const own = game.farm.plots.filter((plot) => plot.resource === resource.id);
			const cost = newPlotCost(own.filter((plot) => plot.extra).length);
			const lacking = shortfall(stock, cost);

			return {
				id: resource.id,
				icon: resource.icon,
				color: resource.color,
				label: t(RESOURCE_BY_ID[resource.id].name),
				plots: own.length,
				short: Object.keys(lacking).length > 0,
				cost: RESOURCES.filter((r) => cost[r.id]).map((r) => ({
					id: r.id,
					icon: r.icon,
					color: r.color,
					label: t(RESOURCE_BY_ID[r.id].name),
					amount: cost[r.id]!,
					short: !!lacking[r.id],
				})),
			};
		});
	});

	protected async buy(resource: ResourceId) {
		this.busy.set(resource);
		this.error.set(false);

		try {
			await this._game.buyPlot(resource, this.patch);
		} catch (error) {
			console.error(error);
			this.error.set(true);
		} finally {
			this.busy.set(null);
		}
	}
}
