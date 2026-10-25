import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { BUILDING_BY_ID, BUILDING_CATEGORIES, BUILDINGS } from '../building/building.data';
import { BuildingId, BuildingType } from '../building/building.interface';
import {
	buildersBusyUntil,
	buildSeconds,
	formatDuration,
	hallLevel,
	levelAt,
	nowSignal,
} from '../building/building.timing';
import { shortfall, stockAt } from '../economy/economy';
import { GameState } from '../game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../resource/resource.data';

/**
 * What can be raised on a free village place, opened through ModalService. ModalService copies its
 * options onto this instance, so `game`, `build` and `close` are plain fields set before
 * the first render.
 */
@Component({
	selector: 'app-village-slot-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="village-slot-modal-title" class="t-heading pr-10">
				<span translate>Що звести тут?</span>
			</h2>

			@for (group of groups(); track group.id) {
				<h3 class="mt-6 t-item" [translate]="group.name">{{ group.name }}</h3>
				<ul class="mt-3 grid gap-3 sm:grid-cols-2">
					@for (option of group.options; track option.type.id) {
						<li
							class="building-option"
							[class.building-option--locked]="!!option.blocked"
						>
							<div class="flex items-start gap-3">
								<span
									class="material-symbols-outlined building-option__icon"
									aria-hidden="true"
									>{{ option.type.icon }}</span
								>
								<div class="min-w-0 flex-1">
									<p
										class="font-semibold text-[var(--c-text-strong)]"
										[translate]="option.type.name"
									>
										{{ option.type.name }}
									</p>
									<p
										class="mt-1 text-sm text-[var(--c-text-muted)]"
										[translate]="option.type.description"
									>
										{{ option.type.description }}
									</p>
								</div>
							</div>

							<ul
								class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm"
								[attr.aria-label]="labels().cost"
							>
								@for (part of option.cost; track part.id) {
									<li class="flex items-center gap-1" [title]="part.label">
										<span
											class="material-symbols-outlined text-[18px]"
											[style.color]="part.color"
											aria-hidden="true"
											>{{ part.icon }}</span
										>
										<span class="sr-only">{{ part.label }}:</span>
										<span
											class="tabular-nums"
											[class.building-option__short]="part.short"
											>{{ part.amount }}</span
										>
									</li>
								}
								<li class="flex items-center gap-1" [title]="labels().time">
									<span
										class="material-symbols-outlined text-[18px] text-[var(--c-text-muted)]"
										aria-hidden="true"
										>schedule</span
									>
									<span class="sr-only">{{ labels().time }}:</span>
									<span class="tabular-nums">{{ option.time }}</span>
								</li>
							</ul>

							<div class="mt-3 flex items-center justify-between gap-3">
								<p class="text-sm text-[var(--c-secondary)]">
									{{ option.blocked }}
								</p>
								<button
									class="btn btn--primary"
									[disabled]="!!option.blocked || busy() !== null"
									(click)="pick(option.type.id)"
									type="button"
								>
									<span class="material-symbols-outlined" aria-hidden="true"
										>construction</span
									>
									<span translate>Звести</span>
								</button>
							</div>
						</li>
					}
				</ul>
			}

			@if (error()) {
				<p class="mt-4 text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося звести будівлю. Спробуйте ще раз.
				</p>
			}
		</div>
	`,
	styles: `
		.building-option {
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius);
			padding: 0.875rem;
		}

		.building-option__short {
			color: var(--c-secondary);
			font-weight: 700;
		}

		.building-option--locked {
			opacity: 0.7;
		}

		.building-option__icon {
			color: var(--c-primary-text);
			font-size: 28px;
		}
	`,
})
export class VillageSlotModalComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	/** The lord's game: what stands in the village, the farm and the stores. */
	game!: GameState;
	build: (type: BuildingId) => Promise<void> = async () => {};
	close: () => void = () => {};

	protected readonly busy = signal<BuildingId | null>(null);
	protected readonly error = signal(false);
	private readonly _now = nowSignal();

	protected readonly labels = computed(() => {
		this._languageService.language();

		return {
			cost: this._translateService.translate('Вартість')(),
			time: this._translateService.translate('Час будівництва')(),
		};
	});

	/** Every building, by category, with what it costs and why it cannot be raised yet. */
	protected readonly groups = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();
		const now = this._now();
		const buildings = this.game.village.buildings ?? {};
		const plots = this.game.farm.levels ?? {};
		const stock = stockAt(this.game.stock, this.game.farm.plots, plots, buildings, now);
		const all = Object.values(buildings);
		// Anything on a place counts as taken; only finished buildings unlock others.
		const present = new Set(all.map((building) => building.type));
		const finished = new Set(all.filter((b) => levelAt(b, now) >= 1).map((b) => b.type));
		const hall = hallLevel(buildings, now);
		const busyUntil = buildersBusyUntil(buildings, now, plots);

		return BUILDING_CATEGORIES.map((category) => ({
			...category,
			options: BUILDINGS.filter((type) => type.category === category.id).map((type) => {
				const lacking = shortfall(stock, type.cost);

				return {
					type,
					cost: RESOURCES.filter((resource) => type.cost[resource.id]).map(
						(resource) => ({
							id: resource.id,
							icon: resource.icon,
							color: resource.color,
							label: t(RESOURCE_BY_ID[resource.id].name),
							amount: type.cost[resource.id]!,
							short: !!lacking[resource.id],
						}),
					),
					time: formatDuration(buildSeconds(type, 1, hall)),
					blocked:
						this._blocked(type, present, finished, busyUntil, now, t) ||
						(Object.keys(lacking).length ? t('Бракує ресурсів') : ''),
				};
			}),
		}));
	});

	protected async pick(type: BuildingId) {
		this.busy.set(type);
		this.error.set(false);

		try {
			await this.build(type);
			this.close();
		} catch (error) {
			console.error(error);
			this.error.set(true);
			this.busy.set(null);
		}
	}

	/** Why a building cannot be raised here yet, or an empty string when it can. */
	private _blocked(
		type: BuildingType,
		present: Set<BuildingId>,
		finished: Set<BuildingId>,
		busyUntil: number | null,
		now: number,
		t: (text: string) => string,
	): string {
		if (!type.repeatable && present.has(type.id)) {
			return t('Вже збудовано');
		}

		const missing = type.requires.filter((id) => !finished.has(id));

		if (missing.length) {
			return `${t('Спершу потрібно')}: ${missing.map((id) => t(BUILDING_BY_ID[id].name)).join(', ')}`;
		}

		return busyUntil
			? `${t('Будівельники зайняті ще')} ${formatDuration((busyUntil - now) / 1000)}`
			: '';
	}
}
