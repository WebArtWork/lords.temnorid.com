/** What a new lord chooses about themselves besides the name; saved in LordsProgress.lord. */
export type LordLookKey = 'gender' | 'face' | 'hairstyle' | 'class';

export type LordLook = Record<LordLookKey, string>;

export interface LordOption {
	id: string;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	/** Material Symbols icon, for options that have a clear one. */
	icon?: string;
}

export interface LordCategory {
	id: LordLookKey;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	options: LordOption[];
}

/** The first option of each category is what a lord starts with. */
export const LORD_CATEGORIES: LordCategory[] = [
	{
		id: 'gender',
		name: 'Стать',
		options: [
			{ id: 'male', name: 'Чоловік', icon: 'male' },
			{ id: 'female', name: 'Жінка', icon: 'female' },
		],
	},
	{
		id: 'face',
		name: 'Обличчя',
		options: [
			{ id: 'stern', name: 'Суворе' },
			{ id: 'kind', name: 'Привітне' },
			{ id: 'scarred', name: 'З шрамом' },
			{ id: 'sly', name: 'Хитре' },
		],
	},
	{
		id: 'hairstyle',
		name: 'Зачіска',
		options: [
			{ id: 'short', name: 'Коротка' },
			{ id: 'long', name: 'Довга' },
			{ id: 'braided', name: 'Коси' },
			{ id: 'topknot', name: 'Пучок' },
			{ id: 'shaved', name: 'Поголена' },
		],
	},
	{
		id: 'class',
		name: 'Клас',
		options: [
			{ id: 'warrior', name: 'Воїн', icon: 'swords' },
			{ id: 'knight', name: 'Лицар', icon: 'shield' },
			{ id: 'archer', name: 'Лучник', icon: 'target' },
			{ id: 'mage', name: 'Маг', icon: 'auto_fix_high' },
			{ id: 'rogue', name: 'Розвідник', icon: 'visibility' },
			{ id: 'healer', name: 'Цілитель', icon: 'healing' },
		],
	},
];

export function defaultLook(): LordLook {
	return Object.fromEntries(LORD_CATEGORIES.map((c) => [c.id, c.options[0]!.id])) as LordLook;
}

/** Keeps only ids that still exist, so an old or edited save falls back to the defaults. */
export function cleanLook(saved: Partial<LordLook> | undefined): LordLook {
	const look = defaultLook();

	for (const category of LORD_CATEGORIES) {
		const id = saved?.[category.id];

		if (category.options.some((option) => option.id === id)) {
			look[category.id] = id!;
		}
	}

	return look;
}
