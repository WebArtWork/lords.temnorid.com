import { RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';
import { Dungeon } from './dungeon.data';
import { cannotGo } from './hero';

/** One kind of loot as shown on a card: icon, name, and the amounts a trip can bring back. */
export interface LootPart {
	id: ResourceId;
	icon: string;
	color: string;
	label: string;
	min: number;
	max: number;
}

/** Ukrainian source labels for dungeon danger 1–3. */
export const DANGER_LABELS = ['', 'Легко', 'Небезпечно', 'Смертельно'] as const;

/** Every kind of loot a dungeon can give, in the usual resource order. */
export function lootParts(dungeon: Dungeon, t: (text: string) => string): LootPart[] {
	return RESOURCES.filter((r) => dungeon.loot[r.id]).map((r) => ({
		id: r.id,
		icon: r.icon,
		color: r.color,
		label: t(r.name),
		min: dungeon.loot[r.id]![0],
		max: dungeon.loot[r.id]![1],
	}));
}

/** Death risk as a whole percent, at least 1 when there is any risk at all. */
export function riskPercent(chance: number): number {
	return chance > 0 ? Math.max(1, Math.round(chance * 100)) : 0;
}

/** Why the hero cannot set out, in words, or '' when they can. */
export function blockedLabel(
	reason: ReturnType<typeof cannotGo>,
	t: (text: string) => string,
): string {
	switch (reason) {
		case 'busy':
			return t('Герой у поході');
		case 'infirmary':
			return t('Герой у шпиталі');
		case 'weak':
			return t("Замало здоров'я");
		case null:
			return '';
	}
}
