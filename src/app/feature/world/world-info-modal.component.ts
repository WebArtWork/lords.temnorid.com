import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { REGIONS } from '../region/region.data';
import { CITIES, RIVERS } from './world.geography';

/** What the world map shows and how to read it, opened through ModalService. */
@Component({
	selector: 'app-world-info-modal',
	imports: [TranslateDirective],
	template: `
		<div class="p-1">
			<h2 id="world-info-modal-title" class="t-heading pr-10" translate>Про мапу</h2>

			<h3 class="mt-5 t-item" translate>Масштаб</h3>
			<p class="mt-1 text-sm leading-6 text-[var(--c-text-muted)]" translate>
				Одна клітинка мапи — це квадрат 2 × 2 км. Відстань рахується в кілометрах: кількість
				клітинок, помножена на 2.
			</p>
			<p class="mt-1 text-sm font-semibold tabular-nums">
				<span translate>1 клітинка = 2 км</span>
			</p>

			<h3 class="mt-5 t-item" translate>Координати</h3>
			<p class="mt-1 text-sm leading-6 text-[var(--c-text-muted)]" translate>
				Кожна клітинка має координати (x|y). Кам'янець — це (0|0): x росте на схід, y — на
				південь.
			</p>

			<h3 class="mt-5 t-item" translate>Міста</h3>
			<p class="mt-1 text-sm leading-6 text-[var(--c-text-muted)]" translate>
				Міста 14 століття, відомі всім, навіть за межами відкритої землі.
			</p>
			<ul class="mt-2 grid gap-1 text-sm">
				@for (city of cities; track city.id) {
					<li class="flex items-baseline gap-2">
						<span
							class="material-symbols-outlined self-center text-[18px] text-[var(--c-primary-text)]"
							aria-hidden="true"
							>castle</span
						>
						<span class="font-semibold" [translate]="city.name">{{ city.name }}</span>
						<span class="tabular-nums text-[var(--c-text-muted)]"
							>({{ city.x }}|{{ city.y }})</span
						>
					</li>
				}
			</ul>

			<h3 class="mt-5 t-item" translate>Поселення лордів</h3>
			<p class="mt-1 text-sm leading-6 text-[var(--c-text-muted)]" translate>
				Кожен будиночок на мапі — поселення якогось лорда. Своє поселення можна знайти
				кнопкою з мішенню.
			</p>

			<h3 class="mt-5 t-item" translate>Чверті</h3>
			<p class="mt-1 text-sm leading-6 text-[var(--c-text-muted)]" translate>
				Світ поділений на чотири чверті.
			</p>
			<p class="mt-1 text-sm leading-6 text-[var(--c-text-muted)]" translate>
				Світ розширюється, коли в цю чверть приходять нові лорди.
			</p>
			<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
				@for (region of regions; track region.id) {
					<li class="flex items-center gap-1">
						<span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{
							region.icon
						}}</span>
						<span [translate]="region.name">{{ region.name }}</span>
					</li>
				}
			</ul>

			<h3 class="mt-5 t-item" translate>Річки</h3>
			<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
				@for (river of rivers; track river) {
					<li class="flex items-center gap-1">
						<span
							class="material-symbols-outlined text-[18px] text-[#3f6f86]"
							aria-hidden="true"
							>water</span
						>
						<span [translate]="river">{{ river }}</span>
					</li>
				}
			</ul>
		</div>
	`,
})
export class WorldInfoModalComponent {
	close: () => void = () => {};

	// The text above says 2 km a tile: keep it in step with GEO_KM_PER_TILE.
	protected readonly cities = CITIES;
	protected readonly regions = REGIONS;
	protected readonly rivers = RIVERS.map((river) => river.name);
}
