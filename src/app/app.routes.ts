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
		path: 'building/:slot',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/building'),
		},
		loadComponent: () =>
			import('./pages/building/building.component').then((m) => m.BuildingComponent),
	},
	{
		path: 'plot/:id',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/plot'),
		},
		loadComponent: () => import('./pages/plot/plot.component').then((m) => m.PlotComponent),
	},
	{
		path: 'city/:id',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/city'),
		},
		loadComponent: () => import('./pages/city/city.component').then((m) => m.CityComponent),
	},
	{
		path: 'dungeons',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/dungeons'),
		},
		loadComponent: () =>
			import('./pages/dungeons/dungeons.component').then((m) => m.DungeonsComponent),
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
		path: 'profile',
		canActivate: [authGuard],
		data: {
			meta: buildRouteMeta(companyProfile, '/profile'),
		},
		loadComponent: () =>
			import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
	},
	{
		path: '**',
		redirectTo: '',
	},
];
