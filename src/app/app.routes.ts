import { Routes } from '@angular/router';
import { buildRouteMeta } from '@wawjs/ngx-default';
import { companyProfile } from './feature/company/company.data';
import { authGuard } from './feature/firebase/auth.guard';

export const routes: Routes = [
	{
		path: '',
		data: {
			meta: {
				...buildRouteMeta(companyProfile, '/'),
				titleSuffix: '',
			},
		},
		loadComponent: () =>
			import('./pages/sign-in/sign-in.component').then((m) => m.SignInComponent),
	},
	{
		path: 'onboarding',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/onboarding'),
		},
		loadComponent: () =>
			import('./pages/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
	},
	{
		path: 'village',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/village'),
		},
		loadComponent: () =>
			import('./pages/village/village.component').then((m) => m.VillageComponent),
	},
	{
		path: 'farm',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/farm'),
		},
		loadComponent: () => import('./pages/farm/farm.component').then((m) => m.FarmComponent),
	},
	{
		path: 'world',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/world'),
		},
		loadComponent: () => import('./pages/world/world.component').then((m) => m.WorldComponent),
	},
	{
		path: '**',
		redirectTo: '',
	},
];
