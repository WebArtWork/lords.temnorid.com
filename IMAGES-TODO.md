# Images TODO

Art the game still needs. Until an image exists, its slot shows a Material Symbols icon on a
tinted panel, so nothing is broken in the meantime.

Files in `src/assets/` are served from the site root, so `src/assets/elements/stone.webp` is
referenced as `elements/stone.webp`.

## Onboarding: first location element

The player picks the element of their first location on `/onboarding`. Each choice is a card with
an image above its name and description.

| Done | Image | Save to | Fill in | Size |
| ---- | ----- | ------- | ------- | ---- |
| [x] | Stone: a mountain refuge with a warm-lit stone archway at dusk | `src/assets/elements/stone.webp` | `image` of `stone` in `src/app/feature/element/element.data.ts` | 1200×800 (3:2), WebP |
| [x] | Fire: a communal stone hearth in a medieval woodland settlement | `src/assets/elements/fire.webp` | `image` of `fire` in `src/app/feature/element/element.data.ts` | 1200×800 (3:2), WebP |

To fill one: save the file, then set the `image` value, e.g. `image: 'elements/stone.webp'`, and
delete the `TODO(image)` comment above it. The card switches from the icon to the image on its own.

Keep both images the same size and in a similar style and lighting, since they sit side by side.
They should read well on both the light (parchment) and dark (night) themes.

The Stone and Fire images were generated with the built-in ImageGen tool in a photorealistic
style. Their prompts are saved in `output/onboarding-images/prompts.json`.

## Onboarding: place on the map

Step 2 of `/onboarding`. The player picks one of four quarters (north-west, north-east, south-west,
south-east) on a square map split 2×2. The map image sits behind the four buttons.

| Done | Image | Save to | Fill in | Size |
| ---- | ----- | ------- | ------- | ---- |
| [ ] | World map of Temnorid, top-down, north up. Keep the centre and the lines between quarters calm, because buttons with labels sit on top | `src/assets/map/world.webp` | `WORLD_MAP_IMAGE` in `src/app/feature/region/region.data.ts` | 1024×1024 (1:1), WebP |

To fill it: save the file, set `export const WORLD_MAP_IMAGE = 'map/world.webp';` and delete the
`TODO(image)` comment above it. Until then the map shows as a plain parchment panel.
