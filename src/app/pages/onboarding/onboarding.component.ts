import { isPlatformBrowser } from '@angular/common';
import { Component, computed, effect, inject, PLATFORM_ID, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { ELEMENTS } from '../../feature/element/element.data';
import { ElementId } from '../../feature/element/element.interface';
import { FirebaseService } from '../../feature/firebase/firebase.service';
import {
	generateName,
	joinName,
	NameParts,
	NamePool,
	NamesService,
} from '../../feature/names/names.service';
import {
	isOnboarded,
	LORD_NAME_MAX,
	LORD_NAME_MIN,
	LordsProgress,
	ProgressService,
} from '../../feature/progress/progress.service';
import { REGIONS, WORLD_MAP_IMAGE } from '../../feature/region/region.data';
import { RegionId } from '../../feature/region/region.interface';
import { WorldOverviewComponent } from '../../feature/world/world-overview.component';

type OnboardingStep = 'element' | 'region' | 'lord';

/**
 * First steps of a new lord: pick the element their first location is founded on, the quarter of
 * the map they are dropped into, and the name of the character who leads the village. Then on to
 * the village. The name starts generated from the shared Temnorid name pool: the player can lock
 * the first or second name and reroll the other, or type their own.
 */
@Component({
	imports: [TranslateDirective, WorldOverviewComponent],
	template: `
		<section class="mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page">
			@if (loading()) {
				<p class="text-[var(--c-text-muted)]" role="status" translate>Завантаження…</p>
			} @else {
				@let current = step();
				@switch (current) {
					@case ('element') {
						<p class="t-numeral text-lg" translate>Крок 1 з 3</p>
						<h1 class="mt-1 t-display" translate>Ваша перша локація</h1>
						<p class="mt-4 max-w-[40rem] t-lead" translate>
							Оберіть стихію, на якій вона постане.
						</p>

						<form class="mt-8" (submit)="$event.preventDefault(); saveElement()">
							<fieldset>
								<legend class="sr-only" translate>Стихія першої локації</legend>
								<div class="grid gap-4 sm:grid-cols-2">
									@for (element of elements; track element.id) {
										<label
											class="choice-card t-card flex cursor-pointer flex-col gap-4"
											[class.choice-card--selected]="element.id === selectedElement()"
										>
											<input
												class="sr-only"
												[checked]="element.id === selectedElement()"
												(change)="selectElement(element.id)"
												name="element"
												type="radio"
												[value]="element.id"
											/>
											@if (element.image) {
												<img
													class="aspect-[3/2] w-full rounded-[var(--t-radius)] object-cover"
													[src]="element.image"
													alt=""
													width="1200"
													height="800"
												/>
											} @else {
												<span
													class="flex aspect-[3/2] w-full items-center justify-center rounded-[var(--t-radius)] bg-[var(--c-bg-tertiary)] text-[var(--c-primary-text)]"
													aria-hidden="true"
												>
													<span class="material-symbols-outlined choice-card__icon">
														{{ element.icon }}
													</span>
												</span>
											}
											<span class="flex items-center justify-between gap-3">
												<span class="t-item" [translate]="element.name">{{ element.name }}</span>
												<span
													class="material-symbols-outlined choice-card__check"
													aria-hidden="true"
												>
													check_circle
												</span>
											</span>
											<span class="leading-7" [translate]="element.description">
												{{ element.description }}
											</span>
										</label>
									}
								</div>
							</fieldset>

							<div class="mt-8 flex flex-wrap items-center gap-3">
								<button
									class="btn btn--primary"
									[disabled]="!selectedElement() || saving()"
									type="submit"
								>
									<span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
									<span translate>Далі</span>
								</button>
								<button class="btn" (click)="signOut()" type="button">
									<span class="material-symbols-outlined" aria-hidden="true">logout</span>
									<span translate>Вийти</span>
								</button>
							</div>
						</form>
					}

					@case ('region') {
						<p class="t-numeral text-lg" translate>Крок 2 з 3</p>
						<h1 class="mt-1 t-display" translate>Місце на мапі</h1>
						<p class="mt-4 max-w-[40rem] t-lead" translate>
							Оберіть частину світу, де постане ваша перша локація.
						</p>

						<form class="mt-8" (submit)="$event.preventDefault(); saveRegion()">
							<fieldset>
								<legend class="sr-only" translate>Частина світу</legend>
								<div
									class="world-map relative grid aspect-square w-full max-w-[32rem] grid-cols-2 gap-2 overflow-hidden p-2"
									[style.background-image]="mapImage ? 'url(' + mapImage + ')' : null"
								>
									@if (!mapImage) {
										<app-world-overview class="absolute inset-0" />
									}
									@for (region of regions; track region.id) {
										<label
											class="choice-card region-cell flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
											[class.choice-card--selected]="region.id === selectedRegion()"
										>
											<input
												class="sr-only"
												[checked]="region.id === selectedRegion()"
												(change)="selectRegion(region.id)"
												name="region"
												type="radio"
												[value]="region.id"
											/>
											<span
												class="material-symbols-outlined region-cell__icon"
												aria-hidden="true"
											>
												{{ region.icon }}
											</span>
											<span class="t-item" [translate]="region.name">{{ region.name }}</span>
										</label>
									}
								</div>
							</fieldset>

							<div class="mt-8 flex flex-wrap items-center gap-3">
								<button
									class="btn btn--primary"
									[disabled]="!selectedRegion() || saving()"
									type="submit"
								>
									<span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
									<span translate>Далі</span>
								</button>
								<button class="btn" [disabled]="saving()" (click)="goTo('element')" type="button">
									<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
									<span translate>Назад</span>
								</button>
							</div>
						</form>
					}

					@case ('lord') {
						<p class="t-numeral text-lg" translate>Крок 3 з 3</p>
						<h1 class="mt-1 t-display" translate>Ваш лорд</h1>
						<p class="mt-4 max-w-[40rem] t-lead" translate>
							Назвіть того, хто поведе ваше поселення.
						</p>

						<form class="mt-8 max-w-[32rem]" (submit)="$event.preventDefault(); saveLord()" novalidate>
							<label class="writer-label" for="lord-name" translate>Ім'я лорда</label>
							<input
								class="writer-input"
								id="lord-name"
								[attr.aria-describedby]="nameError() ? 'lord-name-error' : 'lord-name-hint'"
								[attr.aria-invalid]="nameError() ? 'true' : null"
								autocomplete="off"
								[attr.maxlength]="nameMax"
								name="lordName"
								spellcheck="false"
								type="text"
								[value]="lordName()"
								(input)="setLordName($any($event.target).value)"
							/>
							<!-- Numbers match LORD_NAME_MIN and LORD_NAME_MAX. -->
							@if (nameError()) {
								<p class="writer-error" id="lord-name-error" role="alert" translate>
									Ім'я має містити від 2 до 40 символів.
								</p>
							} @else {
								<p class="writer-hint" id="lord-name-hint" translate>Від 2 до 40 символів.</p>
							}

							@if (namePool()) {
								<div class="mt-6 flex flex-wrap items-center gap-3">
									@if (nameParts(); as parts) {
										<button
											class="btn"
											[class.btn--primary]="locked().first"
											[attr.aria-pressed]="locked().first"
											(click)="toggleLock('first')"
											type="button"
										>
											<span class="material-symbols-outlined" aria-hidden="true">{{
												locked().first ? 'lock' : 'lock_open'
											}}</span>
											<span class="sr-only" translate>Закріпити ім'я</span>
											{{ parts.first }}
										</button>
										<button
											class="btn"
											[class.btn--primary]="locked().second"
											[attr.aria-pressed]="locked().second"
											(click)="toggleLock('second')"
											type="button"
										>
											<span class="material-symbols-outlined" aria-hidden="true">{{
												locked().second ? 'lock' : 'lock_open'
											}}</span>
											<span class="sr-only" translate>Закріпити прізвисько</span>
											{{ parts.second }}
										</button>
									}
									<button
										class="btn"
										[disabled]="saving() || (locked().first && locked().second && !!nameParts())"
										(click)="rerollName()"
										type="button"
									>
										<span class="material-symbols-outlined" aria-hidden="true">casino</span>
										<span translate>Інше ім'я</span>
									</button>
								</div>
								<p class="writer-hint mt-2" translate>
									Закріпіть частину, яка подобається, і згенеруйте іншу. Або впишіть своє ім'я.
								</p>
							}

							<div class="mt-8 flex flex-wrap items-center gap-3">
								<button class="btn btn--primary" [disabled]="saving()" type="submit">
									<span class="material-symbols-outlined" aria-hidden="true">flag</span>
									<span translate>Заснувати поселення</span>
								</button>
								<button class="btn" [disabled]="saving()" (click)="goTo('region')" type="button">
									<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
									<span translate>Назад</span>
								</button>
							</div>
						</form>
					}

					@default never;
				}

				<div class="mt-4 min-h-7" aria-live="polite">
					@if (error()) {
						<p class="text-[var(--c-secondary)]" role="alert" translate>
							Не вдалося зберегти. Спробуйте ще раз.
						</p>
					}
				</div>
			}
		</section>
	`,
	styles: `
		.choice-card {
			transition: border-color var(--motion-fast) var(--easing);

			&:has(input:focus-visible) {
				box-shadow: var(--focus-ring);
			}

			@media (hover: hover) and (pointer: fine) {
				&:hover:not(.choice-card--selected) {
					border-color: var(--c-text-muted);
				}
			}
		}

		.choice-card--selected {
			border-color: var(--c-primary);
			outline: 1px solid var(--c-primary);
		}

		.choice-card__icon {
			font-size: 64px;
		}

		.choice-card__check {
			color: var(--c-primary-text);
			visibility: hidden;
		}

		.choice-card--selected .choice-card__check {
			visibility: visible;
		}

		/* The map: the drawn overview of the land, or the world map image once it exists. */
		.world-map {
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius-card);
			background-color: var(--c-bg-tertiary);
			background-position: center;
			background-size: cover;
		}

		.region-cell {
			position: relative;
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius);
			background: color-mix(in srgb, var(--c-bg-secondary) 30%, transparent);
			padding: 0.75rem;
		}

		/* The label sits on its own plate so it reads over the map. */
		.region-cell .t-item,
		.region-cell__icon {
			border-radius: var(--t-radius);
			background: color-mix(in srgb, var(--c-bg-secondary) 88%, transparent);
			padding: 0 0.5rem;
		}

		.region-cell__icon {
			color: var(--c-primary-text);
			font-size: 40px;
		}
	`,
})
export class OnboardingComponent {
	private readonly _firebase = inject(FirebaseService);
	private readonly _progress = inject(ProgressService);
	private readonly _router = inject(Router);

	protected readonly elements = ELEMENTS;
	protected readonly regions = REGIONS;
	protected readonly mapImage = WORLD_MAP_IMAGE;

	protected readonly step = signal<OnboardingStep>('element');
	protected readonly selectedElement = signal<ElementId | null>(null);
	protected readonly selectedRegion = signal<RegionId | null>(null);
	protected readonly loading = signal(true);
	protected readonly saving = signal(false);
	protected readonly error = signal(false);
	protected readonly nameMax = LORD_NAME_MAX;
	protected readonly lordName = signal('');
	/** Shown after a submit with an invalid name, cleared as the player types. */
	protected readonly nameError = signal(false);
	/** The shared name pool; null until loaded, or when it could not load (typing still works). */
	protected readonly namePool = signal<NamePool | null>(null);
	private readonly _generated = signal<NameParts | null>(null);
	protected readonly locked = signal({ first: false, second: false });
	/** The generated parts while the field still holds them; typing a different name hides them. */
	protected readonly nameParts = computed(() => {
		const parts = this._generated();

		return parts && joinName(parts) === this.lordName() ? parts : null;
	});

	private readonly _names = inject(NamesService);

	constructor() {
		void this._restore();

		if (isPlatformBrowser(inject(PLATFORM_ID))) {
			effect(() => {
				if (this.step() === 'lord') {
					untracked(() => void this._loadNames());
				}
			});
		}
	}

	protected selectElement(element: ElementId) {
		this.selectedElement.set(element);
		this.error.set(false);
	}

	protected selectRegion(region: RegionId) {
		this.selectedRegion.set(region);
		this.error.set(false);
	}

	protected goTo(step: OnboardingStep) {
		this.error.set(false);
		this.step.set(step);
	}

	protected async saveElement() {
		const element = this.selectedElement();

		if (element) {
			await this._save(
				(uid) => this._progress.setFirstLocationElement(uid, element),
				'region',
			);
		}
	}

	protected async saveRegion() {
		const region = this.selectedRegion();

		if (region) {
			await this._save((uid) => this._progress.setFirstLocationRegion(uid, region), 'lord');
		}
	}

	protected setLordName(name: string) {
		this.lordName.set(name);
		this.nameError.set(false);
		this.error.set(false);
	}

	protected toggleLock(part: keyof NameParts) {
		this.locked.update((locked) => ({ ...locked, [part]: !locked[part] }));
	}

	/** New parts for whatever is not locked. Locks only count while their parts are shown. */
	protected rerollName() {
		const pool = this.namePool();

		if (!pool) {
			return;
		}

		const shown = this.nameParts();
		const locked = this.locked();
		const parts = generateName(
			pool,
			{
				first: shown && locked.first ? shown.first : undefined,
				second: shown && locked.second ? shown.second : undefined,
			},
			LORD_NAME_MAX,
		);

		if (!shown) {
			this.locked.set({ first: false, second: false });
		}

		this._generated.set(parts);
		this.setLordName(joinName(parts));
	}

	protected async saveLord() {
		const name = this.lordName().trim().replace(/\s+/g, ' ');

		if (name.length < LORD_NAME_MIN || name.length > LORD_NAME_MAX) {
			this.nameError.set(true);
			return;
		}

		await this._save((uid) => this._progress.setLordName(uid, name), 'village');
	}

	protected async signOut() {
		await this._firebase.signOut();
		await this._router.navigateByUrl('/');
	}

	private async _save(write: (uid: string) => Promise<void>, next: OnboardingStep | 'village') {
		const uid = this._firebase.user()?.uid;

		if (!uid) {
			return;
		}

		this.saving.set(true);
		this.error.set(false);

		try {
			await write(uid);

			if (next === 'village') {
				await this._router.navigateByUrl('/village');
			} else {
				this.step.set(next);
			}
		} catch (error) {
			console.error(error);
			this.error.set(true);
		} finally {
			this.saving.set(false);
		}
	}

	/** Loads the pool and, when the player has no name yet, starts them with a generated one. */
	private async _loadNames() {
		try {
			this.namePool.set(await this._names.load());
		} catch (error) {
			console.error(error);
			return;
		}

		if (!this.lordName().trim()) {
			this.rerollName();
		}
	}

	/** Returning players continue where they stopped, or go straight to their village. */
	private async _restore() {
		const user = await this._firebase.whenReady();

		try {
			const progress = user ? await this._progress.load(user.uid) : null;

			if (isOnboarded(progress)) {
				await this._router.navigateByUrl('/village');
				return;
			}

			this._apply(progress);
		} catch (error) {
			// Without a save the player simply starts from the first step.
			console.error(error);
		} finally {
			this.loading.set(false);
		}
	}

	private _apply(progress: LordsProgress | null) {
		const { element, region } = progress?.firstLocation ?? {};

		this.selectedElement.set(element ?? null);
		this.selectedRegion.set(region ?? null);
		this.lordName.set(progress?.lord?.name ?? '');
		this.step.set(element ? (region ? 'lord' : 'region') : 'element');
	}
}
