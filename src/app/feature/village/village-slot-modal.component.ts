import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { BUILDING_BY_ID, BUILDING_CATEGORIES, BUILDINGS } from '../building/building.data';
import { BuildingId, BuildingType } from '../building/building.interface';
import { RESOURCE_BY_ID, RESOURCES } from '../resource/resource.data';

/**
 * What can be raised on a free village place, opened through ModalService. ModalService copies its
 * options onto this instance, so `slot`, `built`, `build` and `close` are plain fields set before
 * the first render.
 */
@Component({
	selector: 'app-village-slot-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="village-slot-modal-title" class="t-heading pr-10">
				<span translate>Що звести на місці</span> {{ slot }}?
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
										<span class="tabular-nums">{{ part.amount }}</span>
									</li>
								}
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

	slot = 0;
	/** Types already standing in the village, one entry per building. */
	built: BuildingId[] = [];
	build: (type: BuildingId) => Promise<void> = async () => {};
	close: () => void = () => {};

	protected readonly busy = signal<BuildingId | null>(null);
	protected readonly error = signal(false);

	protected readonly labels = computed(() => {
		this._languageService.language();

		return { cost: this._translateService.translate('Вартість')() };
	});

	/** Every building, by category, with what it costs and why it cannot be raised yet. */
	protected readonly groups = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();
		const standing = new Set(this.built);

		return BUILDING_CATEGORIES.map((category) => ({
			...category,
			options: BUILDINGS.filter((type) => type.category === category.id).map((type) => ({
				type,
				cost: RESOURCES.filter((resource) => type.cost[resource.id]).map((resource) => ({
					id: resource.id,
					icon: resource.icon,
					color: resource.color,
					label: t(RESOURCE_BY_ID[resource.id].name),
					amount: type.cost[resource.id]!,
				})),
				blocked: this._blocked(type, standing, t),
			})),
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
		standing: Set<BuildingId>,
		t: (text: string) => string,
	): string {
		if (!type.repeatable && standing.has(type.id)) {
			return t('Вже збудовано');
		}

		const missing = type.requires.filter((id) => !standing.has(id));

		return missing.length
			? `${t('Спершу потрібно')}: ${missing.map((id) => t(BUILDING_BY_ID[id].name)).join(', ')}`
			: '';
	}
}
