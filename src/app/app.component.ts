import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CanonicalService } from '@wawjs/ngx-default';
import { LanguageService } from '@wawjs/ngx-translate';
import { environment } from '../environments/environment';
import { ProjectSeoService } from './feature/company/project-seo.service';
import { FooterComponent } from './layouts/footer/footer.component';
import { BottomBarComponent } from './layouts/bottom-bar/bottom-bar.component';
import { TopbarComponent } from './layouts/topbar/topbar.component';

@Component({
	selector: 'app-root',
	imports: [BottomBarComponent, FooterComponent, RouterOutlet, TopbarComponent],
	template: `
		<div
			class="flex flex-col"
			[class.min-h-screen]="!fitsWindow()"
			[class.h-dvh]="fitsWindow()"
		>
			<app-topbar />
			<main
				class="flex-1"
				[class.min-h-0]="fitsWindow()"
				[class.overflow-hidden]="fitsWindow()"
			>
				<router-outlet />
			</main>
			@if (!inGame()) {
				<app-footer />
			}
			<app-bottom-bar />
		</div>
	`,
})
export class App {
	private readonly _canonicalService = inject(CanonicalService);
	private readonly _projectSeo = inject(ProjectSeoService);
	private readonly _document = inject(DOCUMENT);
	private readonly _languageService = inject(LanguageService);
	private readonly _router = inject(Router);
	private readonly _url = toSignal(
		this._router.events.pipe(
			filter((event) => event instanceof NavigationEnd),
			map((event) => event.urlAfterRedirects),
		),
		{ initialValue: this._router.url },
	);
	/**
	 * In-game screens: the lord's places, their buildings and plots. No footer under them.
	 */
	protected readonly inGame = computed(() =>
		/^\/(world|village|farm|building|plot)(\/|\?|#|$)/.test(this._url()),
	);
	/** The world, the village and the farm are drawn to fit the window, so they never scroll. */
	protected readonly fitsWindow = computed(() =>
		/^\/(world|village|farm)(\/|\?|#|$)/.test(this._url()),
	);

	constructor() {
		this._canonicalService.initialize();
		this._projectSeo.initialize();

		effect(() => {
			const language = this._languageService.language();
			const htmlLang =
				environment.languages.find((item) => item.code === language)?.htmlLang ?? language;

			if (htmlLang) {
				this._document.documentElement.lang = htmlLang;
			}
		});
	}
}
