import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { REGIONS } from '../../feature/region/region.data';
import { CITY_BY_ID, CityId } from '../../feature/world/world.geography';
import { quadrantOf } from '../../feature/world/world.generator';

/** A town of the world as it stood in 1300–1400: who held it, its river and its story. */
@Component({
	imports: [RouterLink, TranslateDirective],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 py-6 sm:px-6 sm:py-8">
			@if (city(); as city) {
				<div class="flex flex-wrap items-center gap-4">
					<span class="city-icon material-symbols-outlined" aria-hidden="true"
						>castle</span
					>
					<div>
						<h1 class="t-display" [translate]="city.name">{{ city.name }}</h1>
						<p class="mt-1 t-lead" [translate]="city.about">{{ city.about }}</p>
					</div>
				</div>

				<dl class="city-facts mt-8 max-w-[40rem]">
					<dt translate>Хто тримав у XIV столітті</dt>
					<dd [translate]="city.rulers">{{ city.rulers }}</dd>
					<dt translate>Річка</dt>
					<dd [translate]="city.river">{{ city.river }}</dd>
					@if (city.firstMention; as mention) {
						<dt translate>Перша згадка</dt>
						<dd [translate]="mention">{{ mention }}</dd>
					}
					<dt translate>Чверть світу</dt>
					<dd>{{ quarter() }}</dd>
				</dl>

				<div class="mt-8 max-w-[var(--reading)] space-y-4 leading-8">
					@for (paragraph of city.story; track $index) {
						<p [translate]="paragraph">{{ paragraph }}</p>
					}
				</div>

				<a
					class="btn btn--primary mt-8"
					routerLink="/world"
					[queryParams]="{ x: city.x, y: city.y }"
				>
					<span class="material-symbols-outlined" aria-hidden="true">travel_explore</span>
					<span translate>Показати на мапі</span>
				</a>
			} @else {
				<p class="text-[var(--c-text-muted)]" translate>Такого міста немає на мапі.</p>
			}
		</section>
	`,
	styles: `
		.city-icon {
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

		.city-facts {
			display: grid;
			grid-template-columns: max-content 1fr;
			gap: 0.5rem 1.5rem;

			dt {
				color: var(--c-text-muted);
			}

			dd {
				color: var(--c-text-strong);
				font-weight: 600;
			}
		}

		@media (max-width: 639px) {
			.city-facts {
				grid-template-columns: 1fr;
				gap: 0.125rem;

				dd {
					margin-bottom: 0.5rem;
				}
			}
		}
	`,
})
export class CityComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);

	/** Town id, from the route. */
	readonly id = input.required<string>();

	protected readonly city = computed(() => CITY_BY_ID[this.id() as CityId] ?? null);
	protected readonly quarter = computed(() => {
		this._languageService.language();
		const city = this.city();

		return city
			? this._translateService.translate(
					REGIONS.find((region) => region.id === quadrantOf(city.x, city.y))!.name,
				)()
			: '';
	});
}
