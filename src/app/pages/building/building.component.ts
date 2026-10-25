import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { BUILDING_BY_ID } from '../../feature/building/building.data';
import { costAtLevel } from '../../feature/building/building.cost';
import { GameService, GameState } from '../../feature/game/game.service';
import { RESOURCES } from '../../feature/resource/resource.data';

/** One building in the village: what it is, its level, and what the next level will cost. */
@Component({
	imports: [RouterLink, TranslateDirective],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			<a class="btn" routerLink="/village">
				<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
				<span translate>До поселення</span>
			</a>

			@if (view(); as view) {
				<div class="mt-6 flex flex-wrap items-center gap-4">
					<span class="building-icon material-symbols-outlined" aria-hidden="true">{{
						view.type.icon
					}}</span>
					<div>
						<h1 class="t-display" [translate]="view.type.name">{{ view.type.name }}</h1>
						<p class="mt-1 t-lead">
							<span translate>Рівень</span> {{ view.level }} ·
							<span translate>Місце</span> {{ slot() }}
						</p>
					</div>
				</div>

				<p
					class="mt-6 max-w-[var(--reading)] leading-8"
					[translate]="view.type.description"
				>
					{{ view.type.description }}
				</p>

				<section class="mt-8 max-w-[36rem] t-card" aria-labelledby="building-upgrade">
					<h2 id="building-upgrade" class="t-item">
						<span translate>Покращення до рівня</span> {{ view.level + 1 }}
					</h2>
					<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-2" [attr.aria-label]="costLabel()">
						@for (part of view.nextCost; track part.id) {
							<li class="flex items-center gap-1.5" [title]="part.label">
								<span
									class="material-symbols-outlined text-[20px]"
									[style.color]="part.color"
									aria-hidden="true"
									>{{ part.icon }}</span
								>
								<span class="sr-only">{{ part.label }}:</span>
								<span class="font-semibold tabular-nums">{{ part.amount }}</span>
							</li>
						}
					</ul>
					<button class="btn btn--primary mt-5" disabled type="button">
						<span class="material-symbols-outlined" aria-hidden="true">upgrade</span>
						<span translate>Покращити</span>
					</button>
					<p class="mt-2 text-sm text-[var(--c-text-muted)]" translate>
						Покращення з'явиться разом із запасами ресурсів.
					</p>
				</section>
			} @else if (missing()) {
				<p class="mt-6 text-[var(--c-text-muted)]" translate>
					На цьому місці ще нічого не збудовано.
				</p>
			} @else if (error()) {
				<p class="mt-6 text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося завантажити будівлю. Оновіть сторінку.
				</p>
			} @else {
				<p class="mt-6 text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			}
		</section>
	`,
	styles: `
		.building-icon {
			display: inline-flex;
			width: 4.5rem;
			height: 4.5rem;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--c-border);
			border-radius: 50%;
			background: var(--c-bg-tertiary);
			color: var(--c-primary-text);
			font-size: 40px;
		}
	`,
})
export class BuildingComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	/** Village place id, from the route. */
	readonly slot = input.required<string>();

	protected readonly state = signal<GameState | null>(null);
	protected readonly error = signal(false);
	protected readonly building = computed(
		() => this.state()?.village.buildings?.[this.slot()] ?? null,
	);
	protected readonly missing = computed(() => !!this.state() && !this.building());
	protected readonly costLabel = computed(() => {
		this._languageService.language();
		return this._translateService.translate('Вартість')();
	});
	protected readonly view = computed(() => {
		this._languageService.language();
		const building = this.building();
		const type = building && BUILDING_BY_ID[building.type];

		if (!building || !type) {
			return null;
		}

		const next = costAtLevel(type.cost, building.level + 1);

		return {
			type,
			level: building.level,
			nextCost: RESOURCES.filter((resource) => next[resource.id]).map((resource) => ({
				id: resource.id,
				icon: resource.icon,
				color: resource.color,
				label: this._translateService.translate(resource.name)(),
				amount: next[resource.id]!,
			})),
		};
	});

	constructor() {
		void this._load();
	}

	private async _load() {
		try {
			const state = await this._game.load();

			if (state) {
				this.state.set(state);
			} else {
				await this._router.navigateByUrl('/onboarding');
			}
		} catch (error) {
			console.error(error);
			this.error.set(true);
		}
	}
}
