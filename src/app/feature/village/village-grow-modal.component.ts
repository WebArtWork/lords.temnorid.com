import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { nowSignal } from '../building/building.timing';
import { newPlotCost, shortfall, stockAt } from '../economy/economy';
import { GameService } from '../game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../resource/resource.data';

/** Buying one more place to build, opened through ModalService. Each place costs more than the last. */
@Component({
	selector: 'app-village-grow-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="village-grow-modal-title" class="t-heading pr-10" translate>
				Розширити поселення
			</h2>
			<p class="mt-2 text-sm text-[var(--c-text-muted)]" translate>
				Кожне наступне місце для будівлі коштує набагато більше за попереднє.
			</p>

			@if (offer(); as offer) {
				<ul class="mt-4 flex flex-wrap gap-x-4 gap-y-2" [attr.aria-label]="offer.label">
					@for (part of offer.cost; track part.id) {
						<li class="flex items-center gap-1.5" [title]="part.label">
							<span
								class="material-symbols-outlined text-[20px]"
								[style.color]="part.color"
								aria-hidden="true"
								>{{ part.icon }}</span
							>
							<span class="sr-only">{{ part.label }}:</span>
							<span class="font-semibold tabular-nums" [class.grow-short]="part.short">{{
								part.amount
							}}</span>
						</li>
					}
				</ul>
				<button
					class="btn btn--primary mt-5"
					[disabled]="offer.short || busy()"
					(click)="buy()"
					type="button"
				>
					<span class="material-symbols-outlined" aria-hidden="true">add_home</span>
					<span translate>Додати місце</span>
				</button>
			}

			@if (error()) {
				<p class="mt-4 text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося. Спробуйте ще раз.
				</p>
			}
		</div>
	`,
	styles: `
		.grow-short {
			color: var(--c-secondary);
		}
	`,
})
export class VillageGrowModalComponent {
	private readonly _game = inject(GameService);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	close: () => void = () => {};

	protected readonly busy = signal(false);
	protected readonly error = signal(false);

	protected readonly offer = computed(() => {
		this._languageService.language();
		const game = this._game.game();

		if (!game) {
			return null;
		}

		const t = (text: string) => this._translateService.translate(text)();
		const stock = stockAt(
			game.stock,
			game.farm.plots,
			game.farm.levels ?? {},
			game.village.buildings ?? {},
			this._now(),
		);
		const cost = newPlotCost(game.village.slots.filter((slot) => slot.extra).length);
		const lacking = shortfall(stock, cost);

		return {
			label: t('Вартість'),
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

	protected async buy() {
		this.busy.set(true);
		this.error.set(false);

		try {
			await this._game.buyVillagePlace();
			this.close();
		} catch (error) {
			console.error(error);
			this.error.set(true);
			this.busy.set(false);
		}
	}
}
