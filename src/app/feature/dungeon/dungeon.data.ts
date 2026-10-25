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
	/** How long the hero is away, there and back. */
	minutes: number;
	/** Health the hero loses. The hero must have more than this to go. */
	damage: number;
	/** What the hero can bring back: each resource listed yields between min and max. */
	loot: Partial<Record<ResourceId, [number, number]>>;
}

/**
 * The caves and ruins of Podillia, easiest first. They are real places: the cave monastery at
 * Bakota and the gypsum caves of the Dniester and Zbruch lands, among the longest in the world.
 */
export const DUNGEONS: Dungeon[] = [
	{
		id: 'bakota-caves',
		name: 'Печери Бакоти',
		description:
			'Покинуті келії скельного монастиря над Дністром. Ченці лишили запаси, а не лише молитви.',
		danger: 1,
		minutes: 5,
		damage: 8,
		loot: { grain: [40, 80], water: [30, 60] },
	},
	{
		id: 'atlantida',
		name: 'Печера Атлантида',
		description:
			'Гіпсові зали біля Завалля, де стіни блищать кристалами. Тут ховали награбоване.',
		danger: 1,
		minutes: 8,
		damage: 12,
		loot: { stone: [60, 110], clay: [40, 80] },
	},
	{
		id: 'mlynky',
		name: 'Печера Млинки',
		description:
			'Тісні ходи під Чортковом, у які колись тікали від набігів. Дехто так і не вийшов.',
		danger: 2,
		minutes: 12,
		damage: 20,
		loot: { wood: [80, 140], iron: [50, 90], grain: [40, 80] },
	},
	{
		id: 'kryshtaleva',
		name: 'Кришталева печера',
		description:
			'Під Кудринцями, над Збручем. Світло смолоскипа розсипається на тисячі кристалів.',
		danger: 2,
		minutes: 18,
		damage: 28,
		loot: { stone: [120, 200], iron: [80, 140], clay: [60, 100] },
	},
	{
		id: 'ozerna',
		name: 'Озерна печера',
		description: 'Підземні озера, де вода стоїть без хвилі століттями. У глибині щось живе.',
		danger: 3,
		minutes: 25,
		damage: 38,
		loot: { water: [200, 320], iron: [120, 200], grain: [100, 160] },
	},
	{
		id: 'optymistychna',
		name: 'Оптимістична печера',
		description: 'Найдовший лабіринт під Поділлям. Хто знає дорогу назад, вертається багатим.',
		danger: 3,
		minutes: 35,
		damage: 48,
		loot: { wood: [180, 300], stone: [180, 300], iron: [150, 250], clay: [150, 250] },
	},
];

export const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d])) as Record<
	DungeonId,
	Dungeon
>;
