import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import type { Language } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import type { AppLanguage } from '../../../environments/environment.prod';

/** The top bar for visitors who are not signed in: the wordmark, Play, language and theme. */
@Component({
	selector: 'app-public-topbar',
	imports: [NgOptimizedImage, RouterLink, TranslateDirective],
	template: `
		<header class="t-bar t-rule-b relative z-50">
			<div
				class="flex min-h-16 w-full items-center justify-between gap-x-2 px-3 py-3 sm:gap-x-6 sm:px-6 lg:px-8"
			>
				<a
					class="theme-focus t-wordmark rounded-md text-xl sm:text-2xl"
					[translate]="{ ariaLabel: 'Перейти на головну сторінку' }"
					routerLink="/"
				>
					<span translate>Лорди</span>
				</a>

				<div class="flex items-center gap-2">
					<div
						class="relative flex items-center gap-1 rounded-full border border-[var(--c-border)] bg-[var(--c-bg-primary)] p-1 shadow-[var(--shadow-sm)]"
					>
						<button
							class="theme-interactive theme-focus inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-bg-tertiary)]"
							[attr.aria-label]="languageCycleLabel()"
							(click)="nextLanguage()"
							type="button"
						>
							<img
								class="h-5 w-7 rounded-[4px] border border-black/10 object-cover"
								[alt]="currentLanguage().nativeName"
								[ngSrc]="currentLanguage().flagSrc"
								width="28"
								height="20"
							/>
						</button>

						<button
							class="theme-interactive theme-focus inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--c-text-strong)] hover:bg-[var(--c-bg-tertiary)]"
							[attr.aria-expanded]="languageMenuOpen()"
							[attr.aria-label]="languageMenuLabel()"
							(click)="toggleLanguageMenu()"
							type="button"
						>
							<span class="material-symbols-outlined text-[20px]" aria-hidden="true">
								arrow_drop_down
							</span>
						</button>

						@if (languageMenuOpen()) {
							<div
								class="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-48 overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg-primary)] p-1 shadow-[var(--shadow-md)]"
							>
								@for (language of languages(); track language.code) {
									<button
										class="theme-interactive theme-focus flex w-full items-center gap-3 rounded-[calc(var(--radius-btn)-0.25rem)] px-3 py-2 text-left text-sm text-[var(--c-text)] hover:bg-[var(--c-bg-tertiary)]"
										(click)="setLanguage(language)"
										type="button"
									>
										<img
											class="h-5 w-7 rounded-[4px] border border-black/10 object-cover"
											[alt]="language.nativeName"
											[ngSrc]="language.flagSrc"
											width="28"
											height="20"
										/>
										<span>{{ language.nativeName }}</span>
									</button>
								}
							</div>
						}
					</div>

					<button
						class="theme-interactive theme-focus inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-bg-primary)] text-[var(--c-text-strong)] hover:bg-[var(--c-bg-tertiary)]"
						[attr.aria-label]="toggleLabel()"
						(click)="toggleMode()"
						type="button"
					>
						<span class="material-symbols-outlined text-[22px]" aria-hidden="true">
							{{ toggleIcon() }}
						</span>
					</button>

					<a class="btn btn--primary" routerLink="/world">
						<span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>
						<span translate>Грати</span>
					</a>
				</div>
			</div>
		</header>
	`,
})
export class PublicTopbarComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _themeService = inject(ThemeService);
	private readonly _languageService = inject(LanguageService);
	private readonly _router = inject(Router);

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
		this._themeService.setMode(this.mode() === 'dark' ? 'light' : 'dark');
	}

	protected async nextLanguage() {
		await this.setLanguage(this.getNextLanguage());
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
