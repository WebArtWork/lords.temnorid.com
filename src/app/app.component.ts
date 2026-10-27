import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CanonicalService } from '@wawjs/ngx-default';
import { LanguageService } from '@wawjs/ngx-translate';
import { environment } from '../environments/environment';
import { ProjectSeoService } from './feature/company/project-seo.service';
import { FooterComponent } from './layouts/footer/footer.component';
import { SessionService } from './feature/session/session.service';
import { BottomBarComponent } from './layouts/bottom-bar/bottom-bar.component';
import { SplashComponent } from './layouts/splash/splash.component';
import { PublicTopbarComponent } from './layouts/public-topbar/public-topbar.component';
import { TopbarComponent } from './layouts/topbar/topbar.component';

@Component({
	selector: 'app-root',
	imports: [
		BottomBarComponent,
		FooterComponent,
		PublicTopbarComponent,
		RouterOutlet,
		SplashComponent,
		TopbarComponent,
	],
	template: `
		<!--
			Pinned to the screen, so the browser itself never scrolls: on phones 100vh is taller
			than the visible area, and the bars would slide away. Only the page between them
			scrolls (or, on play screens, fits).
		-->
		<div class="fixed inset-0 flex flex-col">
			@if (user()) {
				<app-topbar class="shrink-0" />
			} @else {
				<app-public-topbar class="shrink-0" />
			}
			<main
				#content
				class="min-h-0 flex-1"
				[class.overflow-y-auto]="!fitsWindow()"
				[class.overflow-hidden]="fitsWindow()"
			>
				<router-outlet />
			</main>
			@if (!inGame()) {
				<app-footer class="shrink-0" />
			}
			<app-bottom-bar class="shrink-0" />
		</div>
		<!-- Until we know who is here, so nobody sees the signed-out page flash first. -->
		@if (!ready()) {
			<app-splash />
		}
	`,
})
export class App {
	private readonly _canonicalService = inject(CanonicalService);
	private readonly _projectSeo = inject(ProjectSeoService);
	private readonly _document = inject(DOCUMENT);
	private readonly _languageService = inject(LanguageService);
	private readonly _router = inject(Router);
	private readonly _session = inject(SessionService);
	protected readonly ready = this._session.ready;
	protected readonly user = this._session.user;
	private readonly _url = toSignal(
		this._router.events.pipe(
			filter((event) => event instanceof NavigationEnd),
			map((event) => event.urlAfterRedirects),
		),
		{ initialValue: this._router.url },
	);
	/**
	 * In-game screens: the lord's places, their buildings, plots, towns and dungeons. No footer
	 * under them.
	 */
	protected readonly inGame = computed(() =>
		/^\/(world|village|farm|building|plot|city|dungeons)(\/|\?|#|$)/.test(this._url()),
	);
	/** The world, the village and the farm are drawn to fit the window, so they never scroll. */
	protected readonly fitsWindow = computed(() =>
		/^\/(world|village|farm)(\/|\?|#|$)/.test(this._url()),
	);

	private readonly _content = viewChild<ElementRef<HTMLElement>>('content');

	constructor() {
		// The page scrolls inside <main>, not the window, so start each new page at its top.
		effect(() => {
			this._url();
			this._content()?.nativeElement.scrollTo?.({ top: 0 });
		});

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
