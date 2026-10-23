import { Service } from '@angular/core';

/**
 * The shared Temnorid name pool, built by temnorid.com from its `src/data/names/names.json` and
 * the released characters. One file serves every game, so names are updated in one place.
 */
export const NAMES_URL = 'https://temnorid.com/names.json';

export interface NamePool {
	firstNames: string[];
	secondNames: string[];
	/** Released characters; a generated name must not repeat one. */
	existingNames: string[];
}

/** A generated name: a first and a second name, joined by a space. */
export interface NameParts {
	first: string;
	second: string;
}

/** Rerolls before giving up on avoiding a taken name; the pool is far larger than that. */
const ATTEMPTS = 50;

/**
 * New parts for every part that is not locked. Skips names already taken and names longer than
 * `maxLength`.
 */
export function generateName(
	pool: NamePool,
	locked: Partial<NameParts>,
	maxLength: number,
): NameParts {
	const taken = new Set(pool.existingNames.map((name) => name.toLocaleLowerCase('uk')));
	let parts: NameParts = { first: '', second: '' };

	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		parts = {
			first: locked.first ?? _pick(pool.firstNames),
			second: locked.second ?? _pick(pool.secondNames),
		};

		const name = joinName(parts);

		if (name.length <= maxLength && !taken.has(name.toLocaleLowerCase('uk'))) {
			break;
		}
	}

	return parts;
}

export function joinName(parts: NameParts): string {
	return `${parts.first} ${parts.second}`;
}

/** Loads the name pool once per page. */
@Service()
export class NamesService {
	private _pool: Promise<NamePool> | null = null;

	load(): Promise<NamePool> {
		this._pool ??= fetch(NAMES_URL)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`${NAMES_URL}: ${response.status}`);
				}

				return response.json() as Promise<NamePool>;
			})
			.then((pool) => {
				if (!pool.firstNames?.length || !pool.secondNames?.length) {
					throw new Error(`${NAMES_URL}: empty pool`);
				}

				return { ...pool, existingNames: pool.existingNames ?? [] };
			})
			.catch((error) => {
				// The next visit to the step tries again.
				this._pool = null;
				throw error;
			});

		return this._pool;
	}
}

function _pick(list: string[]): string {
	return list[Math.floor(Math.random() * list.length)]!;
}
