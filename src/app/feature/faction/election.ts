/**
 * How a faction picks its president. Any member can stand; the first candidacy opens a vote that
 * lasts VOTE_HOURS, during which others can stand too and every member votes. The most votes wins,
 * a tie going to whoever stood first. The president serves until TERM_DAYS after the vote, or until
 * they leave the faction; then the next candidacy opens a new vote.
 *
 * Only lords who were already members when a vote opened may stand or vote in it, so nobody can
 * switch factions to vote twice. firestore-factions.rules holds the same limits for Firestore.
 */
/**
 * Off until the faction rules in firestore-factions.rules are added to temnorid.com/firestore.rules
 * and deployed; without them every candidacy and vote is refused.
 */
export const ELECTIONS_LIVE = false;

export const VOTE_HOURS = 24;
export const TERM_DAYS = 7;

export const VOTE_MS = VOTE_HOURS * 3_600_000;
export const TERM_MS = TERM_DAYS * 86_400_000;

export interface Candidate {
	uid: string;
	lordName: string;
	/** Epoch milliseconds the candidacy was filed. */
	at: number;
	votes: number;
}

export interface Election {
	id: string;
	/** Epoch milliseconds. */
	startedAt: number;
	endsAt: number;
	candidates: Candidate[];
	/** Whom the reader voted for, if anyone. */
	myVote: string | null;
}

/** Candidates by votes, most first; a tie goes to whoever stood first. */
export function ranked(candidates: Candidate[]): Candidate[] {
	return [...candidates].sort((a, b) => b.votes - a.votes || a.at - b.at);
}

/** The winner of a closed vote, or null when nobody stood. */
export function winnerOf(election: Election): Candidate | null {
	return ranked(election.candidates)[0] ?? null;
}

export type FactionRule =
	| { kind: 'voting'; election: Election }
	| { kind: 'president'; election: Election; president: Candidate; termEndsAt: number }
	| { kind: 'vacant'; election: Election | null };

/**
 * Where a faction stands at `now`: voting, led by a president, or with nobody at the head (no vote
 * yet, nobody stood, the term ran out, or the president left).
 */
export function factionRule(
	election: Election | null,
	memberUids: Set<string>,
	now: number,
): FactionRule {
	if (!election) {
		return { kind: 'vacant', election: null };
	}

	if (election.endsAt > now) {
		return { kind: 'voting', election };
	}

	const president = winnerOf(election);
	const termEndsAt = election.endsAt + TERM_MS;

	if (president && termEndsAt > now && memberUids.has(president.uid)) {
		return { kind: 'president', election, president, termEndsAt };
	}

	return { kind: 'vacant', election };
}
