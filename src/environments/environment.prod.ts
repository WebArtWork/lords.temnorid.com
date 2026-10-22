import type { FirebaseOptions } from 'firebase/app';

export const environment: {
	apiUrl: string;
	appVersion: string;
	production: boolean;
	companyId: string;
	defaultLanguage: string;
	languages: AppLanguage[];
	firebase: FirebaseOptions;
} = {
	apiUrl: 'https://it.webart.work',
	appVersion: '1.0.0',
	production: true,
	companyId: 'temnorid-lords',
	defaultLanguage: 'ua',
	languages: [
		{
			code: 'ua',
			name: 'Ukrainian',
			nativeName: 'Українська',
			flagSrc: 'flags/ukraine.svg',
			htmlLang: 'uk',
			population: 35,
		},
		{
			code: 'en',
			name: 'English',
			nativeName: 'English',
			flagSrc: 'flags/united-kingdom.svg',
			htmlLang: 'en',
			population: 280,
		},
	],
	// Web config of the `temnorid-arena` Firebase project (the Lords web app). These values are
	// public by design; access is enforced by firestore.rules in temnorid.com.
	firebase: {
		apiKey: 'AIzaSyDwqmZvJj599VIRrgQ6CCXKHSmwzqEeG7o',
		authDomain: 'temnorid-arena.firebaseapp.com',
		projectId: 'temnorid-arena',
		storageBucket: 'temnorid-arena.firebasestorage.app',
		messagingSenderId: '819171248831',
		appId: '1:819171248831:web:8b0d8f1220ec9ab124d40a',
		measurementId: 'G-X6XRRQ5FWG',
	},
};

export interface AppLanguage {
	code: string;
	name: string;
	nativeName: string;
	flagSrc: string;
	htmlLang: string;
	population: number;
}
