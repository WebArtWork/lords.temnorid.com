import { ResourceId } from '../resource/resource.interface';

export type DungeonId =
	| 'bakota-caves'
	| 'atlantida'
	| 'mlynky'
	| 'kryshtaleva'
	| 'ozerna'
	| 'optymistychna';

/** A place the hero can go into for loot, as Travian's adventures. */
export interface Dungeon {
	id: DungeonId;
	/** Ukrainian source text; translated through i18n. */
	name: string;
	description: string;
	/** 1 easy, 2 hard, 3 deadly. */
	danger: 1 | 2 | 3;
	/** How far the way lies, in kilometres. */
	distance: number;
	/** How long the hero is away, there and back. */
	minutes: number;
	/**
	 * Health the hero loses, rolled between min and max when they set out and taken when they are
	 * back. The hero must have more than min to go; with less than max there is a risk of dying.
	 */
	damage: [number, number];
	/** What the hero can bring back: each resource listed yields between min and max. */
	loot: Partial<Record<ResourceId, [number, number]>>;
}

/**
 * The caves and ruins of Podillia, easiest first. They are real places: the cave monastery at
 * Bakota and the gypsum caves of the Dniester and Zbruch lands, among the longest in the world.
 *
 * Balance: the riskier the dungeon, the more kinds of loot (two, three, then four). Every resource
 * turns up in exactly three dungeons, and its ranges are set so a full round of all six brings
 * back the same amount of each on average: 370. A resource found in deep dungeons gives a little
 * less per trip than one found only in shallow ones, because the deep ones are richer.
 */
export const DUNGEONS: Dungeon[] = [
	{
		id: 'bakota-caves',
		name: 'Печери Бакоти',
		description:
			'Покинуті келії скельного монастиря над Дністром. Ченці лишили запаси, а не лише молитви.',
		danger: 1,
		distance: 12,
		minutes: 5,
		damage: [5, 12],
		loot: { grain: [40, 80], clay: [40, 80] },
	},
	{
		id: 'atlantida',
		name: 'Печера Атлантида',
		description:
			'Гіпсові зали біля Завалля, де стіни блищать кристалами. Тут ховали награбоване.',
		danger: 1,
		distance: 20,
		minutes: 8,
		damage: [8, 16],
		loot: { stone: [40, 80], water: [30, 70] },
	},
	{
		id: 'mlynky',
		name: 'Печера Млинки',
		description:
			'Тісні ходи під Чортковом, у які колись тікали від набігів. Дехто так і не вийшов.',
		danger: 2,
		distance: 30,
		minutes: 12,
		damage: [14, 26],
		loot: { wood: [60, 100], iron: [70, 120], clay: [80, 140] },
	},
	{
		id: 'kryshtaleva',
		name: 'Кришталева печера',
		description:
			'Під Кудринцями, над Збручем. Світло смолоскипа розсипається на тисячі кристалів.',
		danger: 2,
		distance: 45,
		minutes: 18,
		damage: [20, 36],
		loot: { stone: [80, 140], iron: [70, 120], grain: [80, 140] },
	},
	{
		id: 'ozerna',
		name: 'Озерна печера',
		description: 'Підземні озера, де вода стоїть без хвилі століттями. У глибині щось живе.',
		danger: 3,
		distance: 60,
		minutes: 25,
		damage: [28, 48],
		loot: { water: [120, 200], wood: [110, 180], iron: [130, 230], grain: [150, 250] },
	},
	{
		id: 'optymistychna',
		name: 'Оптимістична печера',
		description: 'Найдовший лабіринт під Поділлям. Хто знає дорогу назад, вертається багатим.',
		danger: 3,
		distance: 85,
		minutes: 35,
		damage: [36, 60],
		loot: { wood: [110, 180], stone: [150, 250], clay: [150, 250], water: [120, 200] },
	},
];

export const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d])) as Record<
	DungeonId,
	Dungeon
>;
