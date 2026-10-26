import { Component, computed, inject } from '@angular/core';
import { LanguageService, TranslateService } from '@wawjs/ngx-translate';
import { formatDuration, nowSignal } from '../building/building.timing';
import { GameService } from '../game/game.service';
import { DUNGEON_BY_ID } from './dungeon.data';
import { heroHealth, heroStatus } from './hero';

/** The lord's name, the hero's health and where the hero is: the top bar's block, with the number. */
@Component({
	selector: 'app-hero-status',
	template: `
		@if (hero(); as hero) {
			<div class="t-card">
				<p class="font-semibold text-[var(--c-text-strong)]">{{ hero.lord }}</p>
				<div class="mt-2 flex items-center gap-2">
					<span
						class="material-symbols-outlined text-[20px] text-[var(--c-secondary)]"
						aria-hidden="true"
						>favorite</span
					>
					<div
						class="hero-status__track"
						role="meter"
						aria-valuemin="0"
						aria-valuemax="100"
						[attr.aria-valuenow]="hero.health"
						[attr.aria-label]="hero.label"
					>
						<div class="hero-status__bar" [style.width.%]="hero.health"></div>
					</div>
					<span class="w-8 text-right font-semibold tabular-nums">{{ hero.health }}</span>
				</div>
				<p class="mt-2 text-sm text-[var(--c-text-muted)]">{{ hero.text }}</p>
			</div>
		}
	`,
	styles: `
		:host {
			display: block;
		}

		.hero-status__track {
			height: 0.5rem;
			flex: 1;
			overflow: hidden;
			border-radius: 999px;
			background: var(--c-bg-tertiary);
		}

		.hero-status__bar {
			height: 100%;
			border-radius: inherit;
			background: var(--c-secondary);
		}
	`,
})
export class HeroStatusComponent {
	private readonly _game = inject(GameService);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	protected readonly hero = computed(() => {
		this._languageService.language();
		const game = this._game.game();

		if (!game) {
			return null;
		}

		const t = (text: string) => this._translateService.translate(text)();
		const now = this._now();
		const buildings = game.village.buildings ?? {};
		const expedition = game.hero.expedition;
		const status = heroStatus(game.hero, now, buildings);
		const left = (until: number) => formatDuration((until - now) / 1000);
		const text =
			status === 'away'
				? `${t(DUNGEON_BY_ID[expedition!.dungeon].name)} · ${left(expedition!.endsAt)}`
				: status === 'back'
					? t('Повернувся зі здобиччю')
					: status === 'infirmary'
						? t('Загинув у темниці.')
						: t('Вдома, готовий до походу');

		return {
			lord: game.lordName,
			text,
			health: Math.floor(heroHealth(game.hero, now, buildings)),
			label: t("Здоров'я героя"),
		};
	});
}
