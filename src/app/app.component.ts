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
import { TopbarComponent } from './layouts/topbar/topbar.component';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet, TopbarComponent, FooterComponent],
	template: `
		<div class="flex flex-col" [class.min-h-screen]="!inGame()" [class.h-dvh]="inGame()">
			<app-topbar />
			<main class="flex-1" [class.min-h-0]="inGame()" [class.overflow-hidden]="inGame()">
				<router-outlet />
			</main>
			@if (!inGame()) {
				<app-footer />
			}
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
	 * The lord's places are play screens: drawn to fit the window so they never scroll, with no
	 * footer under them.
	 */
	protected readonly inGame = computed(() =>
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
