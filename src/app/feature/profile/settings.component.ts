import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import type { Language } from '@wawjs/ngx-translate';
import { ThemeService } from '@wawjs/ngx-ui';
import type { AppLanguage } from '../../../environments/environment.prod';

type Mode = 'light' | 'dark';

/** Language and light or dark mode, as two choices on the profile page. */
@Component({
	selector: 'app-settings',
	imports: [NgOptimizedImage, TranslateDirective],
	template: `
		<fieldset>
			<legend class="settings-legend" translate>Мова</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				@for (language of languages(); track language.code) {
					<label
						class="btn settings-choice"
						[class.settings-choice--active]="language.code === activeLanguage()"
					>
						<input
							class="sr-only"
							[checked]="language.code === activeLanguage()"
							(change)="setLanguage(language)"
							name="settings-language"
							type="radio"
							[value]="language.code"
						/>
						<img
							class="h-5 w-7 rounded-[4px] border border-black/10 object-cover"
							alt=""
							[ngSrc]="language.flagSrc"
							width="28"
							height="20"
						/>
						<span>{{ language.nativeName }}</span>
					</label>
				}
			</div>
		</fieldset>

		<fieldset class="mt-5">
			<legend class="settings-legend" translate>Тема</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				@for (option of modes; track option.id) {
					<label
						class="btn settings-choice"
						[class.settings-choice--active]="option.id === mode()"
					>
						<input
							class="sr-only"
							[checked]="option.id === mode()"
							(change)="setMode(option.id)"
							name="settings-mode"
							type="radio"
							[value]="option.id"
						/>
						<span class="material-symbols-outlined" aria-hidden="true">{{
							option.icon
						}}</span>
						<span [translate]="option.label">{{ option.label }}</span>
					</label>
				}
			</div>
		</fieldset>
	`,
	styles: `
		.settings-legend {
			color: var(--c-text-muted);
		}

		.settings-choice:has(input:focus-visible) {
			box-shadow: var(--focus-ring);
		}

		.settings-choice--active {
			border-color: var(--c-primary);
			background: var(--c-bg-tertiary);
		}
	`,
})
export class SettingsComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _themeService = inject(ThemeService);
	private readonly _router = inject(Router);

	protected readonly modes: { id: Mode; label: string; icon: string }[] = [
		{ id: 'light', label: 'Світла', icon: 'light_mode' },
		{ id: 'dark', label: 'Темна', icon: 'dark_mode' },
	];
	protected readonly mode = computed<Mode>(() =>
		this._themeService.mode() === 'dark' ? 'dark' : 'light',
	);
	protected readonly activeLanguage = this._languageService.language;
	protected readonly languages = computed(() =>
		this._languageService.languages().map((language) => language as Language & AppLanguage),
	);

	protected setMode(mode: Mode) {
		this._themeService.setMode(mode);
	}

	/** Re-enters the page after switching, as the language menu used to, so routes pick it up. */
	protected async setLanguage(language: AppLanguage) {
		await this._translateService.setLanguage(language.code);
		await this._router.navigateByUrl(this._router.url);
	}
}
