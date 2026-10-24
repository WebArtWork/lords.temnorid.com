import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Component, computed, effect, inject, Injector, PLATFORM_ID, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import type { Language } from '@wawjs/ngx-translate';
import type { AppLanguage } from '../../../environments/environment.prod';
import type { FirebaseService } from '../../feature/firebase/firebase.service';
import type { GameService } from '../../feature/game/game.service';
import { AvatarComponent } from '../../feature/profile/avatar.component';
import { RESOURCES } from '../../feature/resource/resource.data';

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
	private readonly _firebase = signal<FirebaseService | null>(null);
	private readonly _game = signal<GameService | null>(null);

	/** The signed-in player, once Firebase has loaded. Null on the server and when signed out. */
	protected readonly user = computed(() => this._firebase()?.user() ?? null);
	/** The lord's name, or the player's own name until they have chosen a lord. */
	protected readonly playerName = computed(
		() => this._game()?.game()?.lordName ?? this.user()?.displayName ?? '',
	);
	/** What the lord's farm yields, as icon and plot count. Empty until the game has loaded. */
	protected readonly resources = computed(() => {
		this.activeLanguage();
		const counts = this._game()?.resourceCounts();

		return counts
			? RESOURCES.map((resource) => ({
					...resource,
					count: counts[resource.id],
					label: this._translateService.translate(resource.name)(),
				}))
			: [];
	});
	protected readonly resourcesLabel = computed(() => {
		this.activeLanguage();
		return this._translateService.translate('Ресурси угідь')();
	});
	/** The lord's places. The world opens from the wordmark. */
	protected readonly places = [
		{ path: '/village', label: 'Поселення', icon: 'cottage' },
		{ path: '/farm', label: 'Угіддя', icon: 'agriculture' },
	];
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

	constructor() {
		if (isPlatformBrowser(inject(PLATFORM_ID))) {
			const injector = inject(Injector);

			// Loaded on demand, as in authGuard, so Firebase stays out of the initial bundle.
			void Promise.all([
				import('../../feature/firebase/firebase.service'),
				import('../../feature/game/game.service'),
			]).then(([{ FirebaseService }, { GameService }]) => {
				this._firebase.set(injector.get(FirebaseService));
				this._game.set(injector.get(GameService));
			});

			// Loads the lord once someone signs in, so their name shows on every page.
			effect(() => {
				const game = this._game();

				if (this.user() && game) {
					game.load().catch((error) => console.error(error));
				}
			});
		}
	}

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
