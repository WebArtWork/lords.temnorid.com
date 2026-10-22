import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import projectSchema from '../../../data/seo/project.json';
import { companyProfile } from './company.data';

/** Complements the package route metadata with social context and project schema. */
@Service()
export class ProjectSeoService {
	private readonly _document = inject(DOCUMENT);
	private readonly _meta = inject(Meta);
	private readonly _router = inject(Router);
	private _initialized = false;

	initialize() {
		if (this._initialized) return;
		this._initialized = true;
		this._apply(this._router.url);
		this._router.events
			.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
			.subscribe((event) => this._apply(event.urlAfterRedirects));
	}

	private _apply(url: string) {
		const route = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
		const page = companyProfile.pageSeo[route];
		const title = page?.title ?? companyProfile.defaultSeo.title;
		const canonical = `${companyProfile.siteUrl}${route === '/' ? '/' : route}`;
		this._document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
		this._meta.updateTag({ property: 'og:url', content: canonical });
		this._meta.updateTag({ property: 'og:locale', content: companyProfile.locale });
		this._meta.updateTag({ property: 'og:image:width', content: '1200' });
		this._meta.updateTag({ property: 'og:image:height', content: '630' });
		this._meta.updateTag({ property: 'og:image:type', content: 'image/jpeg' });
		this._meta.updateTag({ property: 'og:image:alt', content: title });
		this._meta.updateTag({ name: 'twitter:image:alt', content: title });

		let schema = this._document.getElementById('project-schema');
		if (route !== '/') {
			schema?.remove();
			return;
		}
		if (!schema) {
			schema = this._document.createElement('script');
			schema.id = 'project-schema';
			schema.setAttribute('type', 'application/ld+json');
			this._document.head.appendChild(schema);
		}
		schema.textContent = JSON.stringify(projectSchema).replaceAll('<', '\\u003c');
	}
}
