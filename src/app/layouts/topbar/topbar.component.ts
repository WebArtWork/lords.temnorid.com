import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { AvatarComponent } from '../../feature/profile/avatar.component';
import { nowSignal } from '../../feature/building/building.timing';
import { DUNGEON_BY_ID } from '../../feature/dungeon/dungeon.data';
import { heroHealth, heroStatus } from '../../feature/dungeon/hero';
import { capacity, productionPerHour, stockAt } from '../../feature/economy/economy';
import { formatDuration } from '../../feature/building/building.timing';
import { villageStrength } from '../../feature/military/military';
import { RESOURCES } from '../../feature/resource/resource.data';
import { SessionService } from '../../feature/session/session.service';
import { PLACES } from './places';

@Component({
	selector: 'app-topbar',
	imports: [AvatarComponent, RouterLink, RouterLinkActive, TranslateDirective],
	templateUrl: './topbar.component.html',
	styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _session = inject(SessionService);

	protected readonly user = this._session.user;
	/** The lord's name, or the player's own name until they have chosen a lord. */
	protected readonly playerName = computed(
		() => this._session.game()?.lordName ?? this.user()?.displayName ?? '',
	);
	private readonly _now = nowSignal();
	/** The lord's stores, as icon and amount, growing with the farm's production. */
	protected readonly resources = computed(() => {
		this.activeLanguage();
		const game = this._session.game();

		if (!game) {
			return [];
		}

		const now = this._now();
		const buildings = game.village.buildings ?? {};
		const levels = game.farm.levels ?? {};
		const amounts = stockAt(game.stock, game.farm.plots, levels, buildings, now);
		const cap = capacity(buildings, now);
		const perHour = productionPerHour(game.farm.plots, levels, now);
		const t = (text: string) => this._translateService.translate(text)();

		return RESOURCES.map((resource) => {
			const count = Math.floor(amounts[resource.id]);
			const label = t(resource.name);

			return {
				...resource,
				count,
				label,
				full: count >= cap[resource.id],
				title: `${label}: ${count} / ${cap[resource.id]}, +${perHour[resource.id]} ${t('за годину')}`,
			};
		});
	});
	/** Attack and defense of the village, shown under each other beside the resources. */
	protected readonly strength = computed(() => {
		this.activeLanguage();
		const game = this._session.game();

		if (!game) {
			return null;
		}

		const t = (text: string) => this._translateService.translate(text)();
		const { attack, defense, wallBonus } = villageStrength(
			game.village.buildings ?? {},
			this._now(),
		);
		const wall = wallBonus ? ` (${t('мур')} +${Math.round(wallBonus * 100)}%)` : '';

		return {
			label: t('Сила поселення'),
			attack,
			defense,
			attackLabel: t('Сила нападу'),
			defenseLabel: t('Сила захисту'),
			attackTitle: `${t('Сила нападу')}: ${attack}. ${t("Військо з'явиться згодом.")}`,
			defenseTitle: `${t('Сила захисту')}: ${defense}${wall}`,
		};
	});
	/** The hero's whereabouts and health, in two small rows beside the strength. */
	protected readonly hero = computed(() => {
		this.activeLanguage();
		const game = this._session.game();

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
			text,
			health: Math.floor(heroHealth(game.hero, now, buildings)),
			label: t("Здоров'я героя"),
		};
	});
	protected readonly resourcesLabel = computed(() => {
		this.activeLanguage();
		return this._translateService.translate('Ресурси угідь')();
	});
	protected readonly places = PLACES;
	protected readonly profileLabel = computed(() => {
		this.activeLanguage();
		return this._translateService.translate('Профіль')();
	});

	protected readonly activeLanguage = this._languageService.language;
}
