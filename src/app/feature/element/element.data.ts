import { LocationElement } from './element.interface';

export const ELEMENTS: LocationElement[] = [
	{
		id: 'stone',
		name: 'Камінь',
		description: 'Камінь тримає імена й тепло. Ваша перша локація постане в теплій горі.',
		icon: 'landscape',
		// TODO(image): src/assets/elements/stone.webp — see IMAGES-TODO.md
		image: '',
	},
	{
		id: 'fire',
		name: 'Вогонь',
		description: 'Вогонь відганяє темряву. Ваша перша локація постане довкола вогнища.',
		icon: 'local_fire_department',
		// TODO(image): src/assets/elements/fire.webp — see IMAGES-TODO.md
		image: '',
	},
];
