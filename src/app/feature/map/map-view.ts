import { Point } from './map-geometry';

/**
 * How a generated map (village, farm) fits a screen. A big screen shows the whole map. A small one,
 * either way round, frames just the things the player acts on, so they fill the screen; a portrait
 * one also turns the land a quarter round, while whatever stands on it is turned back upright.
 */

export interface ScreenBox {
	width: number;
	height: number;
}

/** Map units to keep round the outermost thing: beside it, above it (roofs, badges), below it (names, timers). */
export interface FocusRoom {
	side: number;
	above: number;
	below: number;
}

/** Taller than wide. */
export function isPortrait(box: ScreenBox): boolean {
	return box.height > box.width;
}

/** A phone or a small window, either way round: too little room to spend on the land around. */
export function isCompact(box: ScreenBox): boolean {
	return isPortrait(box) || box.width < 900 || box.height < 560;
}

/**
 * The SVG viewBox: the whole map, or on a compact screen a frame round `points`. Turned, (x, y)
 * lands at (height - y, x), so the land's x runs down the screen and its y right to left; upright
 * things still need their room above and below.
 */
export function mapViewBox(
	map: { width: number; height: number },
	points: Point[],
	room: FocusRoom,
	compact: boolean,
	portrait: boolean,
): string {
	if (!compact || !points.length) {
		return portrait ? `0 0 ${map.height} ${map.width}` : `0 0 ${map.width} ${map.height}`;
	}

	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	const { side, above, below } = room;

	if (!portrait) {
		return `${minX - side} ${minY - above} ${maxX - minX + side * 2} ${maxY - minY + above + below}`;
	}

	return `${map.height - maxY - side} ${minX - above} ${maxY - minY + side * 2} ${maxX - minX + above + below}`;
}

/** The SVG transform that turns the land clockwise for a portrait screen, or ''. */
export function landTurn(map: { height: number }, portrait: boolean): string {
	return portrait ? `translate(${map.height} 0) rotate(90)` : '';
}

/** Appended to a standing thing's transform to keep it upright on turned land, or ''. */
export function uprightTurn(portrait: boolean): string {
	return portrait ? ' rotate(-90)' : '';
}

/** Screen pixels per map unit, with the viewBox fitted whole into the box. */
export function pixelsPerUnit(box: ScreenBox, viewBox: string): number {
	const [, , width, height] = viewBox.split(' ').map(Number);

	return box.width && box.height ? Math.min(box.width / width!, box.height / height!) : 1;
}

/**
 * How much to grow things drawn on a map shown small, so they can be seen and tapped: enough to
 * bring `target` pixels per unit, never below 1 and never above `max`.
 */
export function growth(pixels: number, target: number, max: number): number {
	return Math.min(max, Math.max(1, target / pixels));
}
