import {
	APP_INITIALIZER,
	ApplicationConfig,
	provideBrowserGlobalErrorListeners,
	provideZonelessChangeDetection,
} from '@angular/core';

import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
	buildAbsoluteUrl,
	buildSeoTitleSuffix,
	provideNgxDefaultSeo,
	stripTitleSuffix,
} from '@wawjs/ngx-default';
import { provideNgxCore } from '@wawjs/ngx-core';
import { provideTranslate } from '@wawjs/ngx-translate';
import { provideNgxUi } from '@wawjs/ngx-ui';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { BootstrapService } from './feature/bootstrap/bootstrap.service';
import { companyProfile } from './feature/company/company.data';

const initializeBootstrapData = (bootstrapService: BootstrapService) => () =>
	bootstrapService.initialize();

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideZonelessChangeDetection(),
		provideHttpClient(withFetch()),
		provideNgxCore({
			meta: {
				applyFromRoutes: true,
				useTitleSuffix: true,
				defaults: {
					title: stripTitleSuffix(companyProfile.defaultSeo.title, companyProfile.name),
					titleSuffix: buildSeoTitleSuffix(companyProfile),
					description: companyProfile.defaultSeo.description,
					image: buildAbsoluteUrl(
						companyProfile.siteUrl,
						companyProfile.defaultSeo.image,
					),
					robots: companyProfile.defaultSeo.robots,
				},
			},
		}),
		provideNgxDefaultSeo({
			siteUrl: companyProfile.siteUrl,
		}),
		provideNgxUi({
			tokens: {
				ffBase: "'Alegreya Sans', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
				letterSpacing: '0.1px',
				radius: '6px',
				radiusCard: '8px',
				radiusBtn: '8px',
			},
			lightTokens: {
				// L1 Parchment and ember
				primary: '#b97f20',
				primaryHover: '#a97015',
				onPrimary: '#1e1006',
				secondary: '#932c21',
				secondaryHover: '#7a2219',
				textPrimary: '#1d140d',
				textMuted: '#6f6151',
				placeholder: '#6f6151',
				bgPrimary: '#f8f3e9',
				bgSecondary: '#fefbf5',
				bgTertiary: '#efe7d9',
				border: '#e0d6c6',
				focusRing: '0 0 0 3px rgba(185, 127, 32, 0.45)',
				shadowSm: '0 1px 2px rgba(29, 20, 13, 0.06)',
				shadowMd: '0 10px 30px rgba(29, 20, 13, 0.08)',
			},
			darkTokens: {
				// D1 Hearth at night
				primary: '#e4a74a',
				primaryHover: '#efba64',
				onPrimary: '#180f09',
				secondary: '#e77b60',
				secondaryHover: '#f0937a',
				textPrimary: '#f3eee3',
				textMuted: '#aa9c8a',
				placeholder: '#aa9c8a',
				bgPrimary: '#110c08',
				bgSecondary: '#1b150f',
				bgTertiary: '#27201a',
				border: '#372f27',
				focusRing: '0 0 0 3px rgba(228, 167, 74, 0.45)',
				shadowSm: '0 1px 2px rgba(0, 0, 0, 0.45)',
				shadowMd: '0 10px 30px rgba(0, 0, 0, 0.55)',
			},
		}),
		provideRouter(routes, withComponentInputBinding()),
		provideClientHydration(withEventReplay()),
		provideTranslate({
			defaultLanguage: environment.defaultLanguage,
			languages: environment.languages,
			folder: '/i18n/',
		}),
		{
			provide: APP_INITIALIZER,
			useFactory: initializeBootstrapData,
			deps: [BootstrapService],
			multi: true,
		},
	],
};
