import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { nowSignal } from '../building/building.timing';
import { GameService } from '../game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../resource/resource.data';
import { heroStatus } from './hero';

/** The hero's loot, waiting to be handed over. Draws nothing until the hero is back with some. */
@Component({
	selector: 'app-hero-loot-card',
	imports: [TranslateDirective],
	template: `
		@if (loot(); as loot) {
			<section class="t-card" aria-labelledby="hero-loot-title" aria-live="polite">
				<div class="flex items-center gap-3">
					<span class="hero-loot__icon material-symbols-outlined" aria-hidden="true"
						>swords</span
					>
					<h2 id="hero-loot-title" class="t-item" translate>Повернувся зі здобиччю</h2>
				</div>

				<ul class="mt-4 flex flex-wrap gap-x-4 gap-y-2" [attr.aria-label]="lootLabel()">
					@for (part of loot; track part.id) {
						<li class="flex items-center gap-1.5" [title]="part.label">
							<span
								class="material-symbols-outlined text-[20px]"
								[style.color]="part.color"
								aria-hidden="true"
								>{{ part.icon }}</span
							>
							<span class="sr-only">{{ part.label }}:</span>
							<span class="font-semibold tabular-nums">+{{ part.amount }}</span>
						</li>
					}
				</ul>
				<button
					class="btn btn--primary mt-4"
					[disabled]="working()"
					(click)="collect()"
					type="button"
				>
					<span class="material-symbols-outlined" aria-hidden="true">inventory_2</span>
					<span translate>Забрати здобич</span>
				</button>

				@if (failed()) {
					<p class="mt-3 text-[var(--c-secondary)]" role="alert" translate>
						Не вдалося. Спробуйте ще раз.
					</p>
				}
			</section>
		}
	`,
	styles: `
		:host {
			display: block;
		}

		.hero-loot__icon {
			display: inline-flex;
			width: 3rem;
			height: 3rem;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--c-border);
			border-radius: 50%;
			background: var(--c-bg-tertiary);
			color: var(--c-primary-text);
			font-size: 26px;
		}
	`,
})
export class HeroLootCardComponent {
	private readonly _game = inject(GameService);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	protected readonly working = signal(false);
	protected readonly failed = signal(false);
	protected readonly lootLabel = computed(() => {
		this._languageService.language();

		return this._translateService.translate('Здобич')();
	});

	/** What the returned hero carries, or null when there is nothing to hand over. */
	protected readonly loot = computed(() => {
		this._languageService.language();
		const game = this._game.game();
		const expedition = game?.hero.expedition;

		if (
			!game ||
			!expedition ||
			heroStatus(game.hero, this._now(), game.village.buildings ?? {}) !== 'back'
		) {
			return null;
		}

		const t = (text: string) => this._translateService.translate(text)();

		return RESOURCES.filter((r) => expedition.loot[r.id] !== undefined).map((r) => ({
			id: r.id,
			icon: r.icon,
			color: r.color,
			label: t(RESOURCE_BY_ID[r.id].name),
			amount: expedition.loot[r.id]!,
		}));
	});

	protected async collect() {
		this.working.set(true);
		this.failed.set(false);

		try {
			await this._game.collectLoot();
		} catch (error) {
			console.error(error);
			this.failed.set(true);
		} finally {
			this.working.set(false);
		}
	}
}
