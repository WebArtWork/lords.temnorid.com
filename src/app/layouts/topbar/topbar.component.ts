import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import type { Language } from '@wawjs/ngx-translate';
import type { AppLanguage } from '../../../environments/environment.prod';
import { AvatarComponent } from '../../feature/profile/avatar.component';
import { nowSignal } from '../../feature/building/building.timing';
import { capacity, productionPerHour, stockAt } from '../../feature/economy/economy';
import { villageStrength } from '../../feature/military/military';
import { RESOURCES } from '../../feature/resource/resource.data';
import { SessionService } from '../../feature/session/session.service';
import { PLACES } from './places';

@Component({
	selector: 'app-topbar',
	imports: [AvatarComponent, NgOptimizedImage, RouterLink, RouterLinkActive, TranslateDirective],
	templateUrl: './topbar.component.html',
	styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _themeService = inject(ThemeService);
	private readonly _languageService = inject(LanguageService);
	private readonly _router = inject(Router);
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
	protected readonly resourcesLabel = computed(() => {
		this.activeLanguage();
		return this._translateService.translate('Ресурси угідь')();
	});
	protected readonly places = PLACES;
	protected readonly profileLabel = computed(() => {
		this.activeLanguage();
		return this._translateService.translate('Профіль')();
	});

	protected readonly mode = computed(() => this._themeService.mode() ?? 'light');
	protected readonly languageMenuOpen = signal(false);
	protected readonly languages = computed(() =>
		this._languageService.languages().map((language) => _toAppLanguage(language)),
	);
	protected readonly activeLanguage = this._languageService.language;
	protected readonly currentLanguage = computed(() =>
		_toAppLanguage(this._languageService.getLanguage(this.activeLanguage())),
	);
	protected readonly toggleIcon = computed(() =>
		this.mode() === 'dark' ? 'light_mode' : 'dark_mode',
	);
	protected readonly toggleLabel = computed(() => {
		this.activeLanguage();
		return this.mode() === 'dark'
			? this._translateService.translate('Увімкнути світлий режим')()
			: this._translateService.translate('Увімкнути темний режим')();
	});
	protected readonly languageMenuLabel = computed(() => {
		this.activeLanguage();
		return this._translateService.translate('Відкрити меню мов')();
	});
	protected readonly languageCycleLabel = computed(() => {
		this.activeLanguage();
		return `${this._translateService.translate('Перемкнути мову на')()} ${this.getNextLanguage().nativeName}`;
	});

	protected toggleMode() {
		const nextMode = this.mode() === 'dark' ? 'light' : 'dark';
		this._themeService.setMode(nextMode);
	}

	protected async nextLanguage() {
		const nextLanguage = this.getNextLanguage();
		await this._translateService.setLanguage(nextLanguage.code);
		await this._router.navigateByUrl(this._router.url);
		this.languageMenuOpen.set(false);
	}

	protected toggleLanguageMenu() {
		this.languageMenuOpen.update((open) => !open);
	}

	protected async setLanguage(language: AppLanguage) {
		await this._translateService.setLanguage(language.code);
		await this._router.navigateByUrl(this._router.url);
		this.languageMenuOpen.set(false);
	}

	protected getNextLanguage() {
		const languages = this.languages();
		const currentCode = this.currentLanguage().code;
		const currentIndex = languages.findIndex((language) => language.code === currentCode);

		return languages[(currentIndex + 1) % languages.length] ?? languages[0]!;
	}
}

function _toAppLanguage(language: Language | undefined): AppLanguage {
	const fallback: AppLanguage = {
		code: 'en',
		name: 'English',
		nativeName: 'English',
		flagSrc: 'flags/united-kingdom.svg',
		htmlLang: 'en',
		population: 0,
	};

	return { ...fallback, ...(language as Partial<AppLanguage> | undefined) };
}
