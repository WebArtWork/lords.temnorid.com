import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { BUILDING_CATEGORIES, BUILDINGS } from '../../feature/building/building.data';
import { DUNGEONS } from '../../feature/dungeon/dungeon.data';
import { DANGER_LABELS } from '../../feature/dungeon/dungeon.view';
import { ELEMENTS } from '../../feature/element/element.data';
import { FACTIONS } from '../../feature/faction/faction.data';
import { RESOURCES } from '../../feature/resource/resource.data';

/**
 * The public front page: what the game is, one section per place in it, and a Play button in
 * every section. Play opens the world map; guests are sent to /sign on the way.
 */
@Component({
	imports: [RouterLink, TranslateDirective],
	template: `
		<!-- Hero -->
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			<div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
				<div>
					<h1 class="t-display text-balance" translate>Правь у світі Темнороду</h1>
					<p class="mt-5 t-lead" translate>
						Браузерна фентезі-стратегія в темному середньовіччі XIV століття. Заснуй
						поселення на землях Поділля, збирай ресурси й веди героя в печери.
					</p>
					<div class="mt-8 flex flex-wrap gap-3">
						<a class="btn btn--primary" routerLink="/world">
							<span class="material-symbols-outlined" aria-hidden="true"
								>play_arrow</span
							>
							<span translate>Грати</span>
						</a>
						<button class="btn" (click)="scrollTo('world')" type="button">
							<span class="material-symbols-outlined" aria-hidden="true"
								>keyboard_arrow_down</span
							>
							<span translate>Як це працює</span>
						</button>
					</div>
					<p class="mt-4 text-sm text-[var(--c-text-muted)]" translate>
						Безкоштовно. Можна грати як гість, без реєстрації.
					</p>
				</div>
				<img
					class="aspect-[1200/630] w-full rounded-[var(--t-radius-card)] border border-[var(--c-border)] object-cover shadow-[var(--shadow-md)]"
					src="seo/home.jpg"
					width="1200"
					height="630"
					[translate]="{ alt: 'Лорд на скелі дивиться на місто над річкою' }"
					fetchpriority="high"
				/>
			</div>
		</section>

		<!-- World -->
		<section id="world" class="t-rule-t scroll-mt-4">
			<div class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				<div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
					<img
						class="aspect-[1200/630] w-full rounded-[var(--t-radius-card)] border border-[var(--c-border)] object-cover"
						src="seo/world.jpg"
						width="1200"
						height="630"
						loading="lazy"
						[translate]="{ alt: 'Мапа світу Темнороду з містами й горами' }"
					/>
					<div>
						<h2 class="t-heading text-balance" translate>Одна мапа на всіх лордів</h2>
						<p class="t-prose mt-4" translate>
							Усі поселення стоять на спільній мапі світу. Рухайте її, наближайте,
							шукайте міста, землі з ресурсами й темниці та знаходьте сусідів.
						</p>
						<ul class="mt-5 grid gap-2">
							@for (point of worldPoints; track point.text) {
								<li class="flex items-start gap-3">
									<span
										class="material-symbols-outlined mt-0.5 text-[20px] text-[var(--c-primary-text)]"
										aria-hidden="true"
										>{{ point.icon }}</span
									>
									<span [translate]="point.text">{{ point.text }}</span>
								</li>
							}
						</ul>
						<a class="btn btn--primary mt-8" routerLink="/world">
							<span class="material-symbols-outlined" aria-hidden="true"
								>play_arrow</span
							>
							<span translate>Грати</span>
						</a>
					</div>
				</div>
			</div>
		</section>

		<!-- Lord and first location -->
		<section class="t-rule-t">
			<div class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				<div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
					<div class="lg:order-last">
						<h2 class="t-heading text-balance" translate>Ваш лорд і перша земля</h2>
						<p class="t-prose mt-4" translate>
							Оберіть стихію першої локації, чверть світу, де вона постане, і дайте
							лордові ім'я та вигляд. Далі вона росте разом із вами.
						</p>
						<a class="btn btn--primary mt-8" routerLink="/world">
							<span class="material-symbols-outlined" aria-hidden="true"
								>play_arrow</span
							>
							<span translate>Грати</span>
						</a>
					</div>
					<ul class="grid gap-4 sm:grid-cols-2">
						@for (element of elements; track element.id) {
							<li class="t-card overflow-hidden !p-0">
								<img
									class="aspect-[3/2] w-full object-cover"
									[src]="element.image"
									width="1200"
									height="800"
									loading="lazy"
									alt=""
								/>
								<div class="p-4">
									<h3 class="t-item" [translate]="element.name">
										{{ element.name }}
									</h3>
									<p
										class="mt-2 text-[var(--c-text-muted)]"
										[translate]="element.description"
									>
										{{ element.description }}
									</p>
								</div>
							</li>
						}
					</ul>
				</div>
			</div>
		</section>

		<!-- Village and every building -->
		<section class="t-rule-t">
			<div class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				<div class="max-w-[var(--reading)]">
					<h2 class="t-heading text-balance" translate>Поселення, яке росте</h2>
					<p class="t-prose mt-4" translate>
						Починайте з Двору лорда, а тоді забудовуйте місця навколо нього. Кожна
						будівля має рівні, вартість і час будівництва, а торжище дає змогу
						обмінюватися з іншими лордами.
					</p>
				</div>
				<div class="mt-10 grid gap-8 md:grid-cols-3">
					@for (group of buildingGroups; track group.id) {
						<div>
							<h3 class="t-item" [translate]="group.name">{{ group.name }}</h3>
							<ul class="mt-4 flex flex-wrap gap-2">
								@for (building of group.buildings; track building.id) {
									<li
										class="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-bg-secondary)] px-3 text-sm font-semibold text-[var(--c-text-strong)]"
									>
										<span
											class="material-symbols-outlined text-[18px] text-[var(--c-primary-text)]"
											aria-hidden="true"
											>{{ building.icon }}</span
										>
										<span [translate]="building.name">{{ building.name }}</span>
									</li>
								}
							</ul>
						</div>
					}
				</div>
				<a class="btn btn--primary mt-10" routerLink="/world">
					<span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>
					<span translate>Грати</span>
				</a>
			</div>
		</section>

		<!-- Farm -->
		<section class="t-rule-t">
			<div class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				<div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
					<img
						class="aspect-[1200/630] w-full rounded-[var(--t-radius-card)] border border-[var(--c-border)] object-cover"
						src="seo/farm.jpg"
						width="1200"
						height="630"
						loading="lazy"
						[translate]="{ alt: 'Угіддя лорда: ліси, поля й каменоломні' }"
					/>
					<div>
						<h2 class="t-heading text-balance" translate>Угіддя дають ресурси</h2>
						<p class="t-prose mt-4" translate>
							Ліс, камінь, залізо, вода, зерно й глина надходять щогодини, навіть
							коли вас немає. Склад і комора вирішують, скільки запасу можна
							тримати.
						</p>
						<ul class="mt-5 flex flex-wrap gap-2">
							@for (resource of resources; track resource.id) {
								<li
									class="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-bg-secondary)] px-3 text-sm font-semibold text-[var(--c-text-strong)]"
								>
									<span
										class="material-symbols-outlined text-[18px]"
										[style.color]="resource.color"
										aria-hidden="true"
										>{{ resource.icon }}</span
									>
									<span [translate]="resource.name">{{ resource.name }}</span>
								</li>
							}
						</ul>
						<a class="btn btn--primary mt-8" routerLink="/world">
							<span class="material-symbols-outlined" aria-hidden="true"
								>play_arrow</span
							>
							<span translate>Грати</span>
						</a>
					</div>
				</div>
			</div>
		</section>

		<!-- Dungeons -->
		<section class="t-rule-t">
			<div class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				<div class="grid gap-10 lg:grid-cols-2 lg:gap-14">
					<div class="lg:order-last">
						<h2 class="t-heading text-balance" translate>Темниці Поділля</h2>
						<p class="t-prose mt-4" translate>
							Відправте героя в справжні печери та руїни краю. Що небезпечніший
							похід, то більша здобич, але герой може не повернутися. Шпиталь
							допоможе йому одужати.
						</p>
						<a class="btn btn--primary mt-8" routerLink="/world">
							<span class="material-symbols-outlined" aria-hidden="true"
								>play_arrow</span
							>
							<span translate>Грати</span>
						</a>
					</div>
					<ul class="grid gap-3">
						@for (dungeon of dungeons; track dungeon.id) {
							<li class="t-card t-row">
								<span
									class="material-symbols-outlined text-[var(--c-primary-text)]"
									aria-hidden="true"
									>skull</span
								>
								<span class="t-item flex-1" [translate]="dungeon.name">{{
									dungeon.name
								}}</span>
								<span
									class="pr-3 text-sm text-[var(--c-text-muted)]"
									[translate]="dungeon.danger"
									>{{ dungeon.danger }}</span
								>
							</li>
						}
					</ul>
				</div>
			</div>
		</section>

		<!-- Factions -->
		<section class="t-rule-t">
			<div class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
				<div class="max-w-[var(--reading)]">
					<h2 class="t-heading text-balance" translate>Оберіть, з ким стояти</h2>
					<p class="t-prose mt-4" translate>
						Фракції народилися з історій Темнороду. Кожен лорд обирає ту, що йому
						до душі, і діє поруч зі своїми.
					</p>
				</div>
				<ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					@for (faction of factions; track faction.id) {
						<li class="t-card">
							<span
								class="material-symbols-outlined text-[32px]"
								[style.color]="faction.color"
								aria-hidden="true"
								>{{ faction.icon }}</span
							>
							<h3 class="t-item mt-3" [translate]="faction.name">
								{{ faction.name }}
							</h3>
							<p
								class="mt-2 text-[var(--c-text-muted)]"
								[translate]="faction.summary"
							>
								{{ faction.summary }}
							</p>
						</li>
					}
				</ul>
				<a class="btn btn--primary mt-10" routerLink="/world">
					<span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>
					<span translate>Грати</span>
				</a>
			</div>
		</section>

		<!-- Closing call -->
		<section class="t-rule-t">
			<div class="mx-auto max-w-[var(--container)] px-4 text-center sm:px-6 t-page">
				<h2 class="t-display text-balance" translate>Світ чекає на свого лорда</h2>
				<p class="mx-auto mt-4 max-w-[var(--reading)] t-lead" translate>
					Заснуйте поселення вже сьогодні. Гра в розробці й зростає разом із гравцями.
				</p>
				<a class="btn btn--primary mt-8" routerLink="/world">
					<span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>
					<span translate>Грати</span>
				</a>
			</div>
		</section>
	`,
})
export class LandingComponent {
	private readonly _document = inject(DOCUMENT);

	protected readonly worldPoints = [
		{ icon: 'cottage', text: 'Поселення інших лордів поруч із вашим' },
		{ icon: 'location_city', text: 'Справжні міста Поділля та землі з ресурсами' },
		{ icon: 'explore', text: 'Швидкий перехід до будь-якої точки мапи' },
	];
	protected readonly elements = ELEMENTS;
	protected readonly resources = RESOURCES;
	protected readonly factions = FACTIONS;
	protected readonly buildingGroups = BUILDING_CATEGORIES.map((category) => ({
		...category,
		buildings: BUILDINGS.filter((building) => building.category === category.id),
	}));
	protected readonly dungeons = DUNGEONS.map((dungeon) => ({
		id: dungeon.id,
		name: dungeon.name,
		danger: DANGER_LABELS[dungeon.danger],
	}));

	protected scrollTo(id: string) {
		this._document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	}
}
