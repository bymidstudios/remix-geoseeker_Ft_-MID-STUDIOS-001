/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MID_STUDIOS_LOGO_URL =
  '/assets/aistudio/________________8a66d5e4.jpg';

export const HIDER_CHARACTER_AVATAR_URL =
  '/assets/aistudio/Meta_AI_904246411_1612690956836504_2600563153074737169_n_20261112_030958_0b5b2068.webp';

export const HIDER_PERSONA = {
  id: 'mid_studios_hider',
  name: 'Mohammed Ismail Dego',
  shortName: 'MID Master Hider',
  studio: 'MID-STUDIOS FOR VISUALIZATION IMAGINATION',
  avatarUrl: HIDER_CHARACTER_AVATAR_URL,
  logoUrl: MID_STUDIOS_LOGO_URL,
};

export interface ReferenceScene {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  horizonRatio: number; // Vertical position (0..1) of the horizon in the source photo
  lat: number;
  lng: number;
  regionName: string;
  hint: string;
  timeOfDay: string;
}

export const REFERENCE_SCENES: ReferenceScene[] = [
  {
    id: 'scene_1',
    title: 'Ancient Stone Arch & Campfire',
    subtitle: 'Guardian of the Coastal Arch',
    imageUrl: '/assets/aistudio/1793278566444_1454fe8d.jpg',
    horizonRatio: 0.51,
    lat: 28.5091,
    lng: 34.5165,
    regionName: 'Dahab Blue Lagoon Coast, Sinai',
    hint: 'I am standing beside a weathered stone archway where a campfire warms the rocky shore and desert mountains meet the twilight sea.',
    timeOfDay: 'Golden Dusk',
  },
  {
    id: 'scene_2',
    title: 'Starry Shoreline & Arabian Horse',
    subtitle: 'Twilight Walk by the Tide',
    imageUrl: '/assets/aistudio/IMG-20261031-WA3089_0670a06b.jpg',
    horizonRatio: 0.49,
    lat: 29.4264,
    lng: 34.9768,
    regionName: 'Fjord Bay Cove, Taba',
    hint: 'Hoofprints trace the wet sand under a canopy of stars while the campfire crackles near the old stone arch.',
    timeOfDay: 'Starlit Twilight',
  },
  {
    id: 'scene_3',
    title: 'Campfire Reflections at Dusk',
    subtitle: 'The Horseman & the Sea',
    imageUrl: '/assets/aistudio/IMG-20261031-WA1898_8010d365.jpg',
    horizonRatio: 0.62,
    lat: 28.9714,
    lng: 34.6524,
    regionName: 'Nuweiba Ras Shitan Coast',
    hint: 'Look for the shallow tide pools reflecting golden dusk clouds, a ring of campfire stones, and rugged coastal cliffs across the bay.',
    timeOfDay: 'Sunset Afterglow',
  },
  {
    id: 'scene_4',
    title: 'Whisper by the Ember Glow',
    subtitle: 'Close Companion at the Arch',
    imageUrl: '/assets/aistudio/IMG-20261031-WA8950_c7d78c12.jpg',
    horizonRatio: 0.52,
    lat: 28.4125,
    lng: 34.4578,
    regionName: 'Nabq Protected Coastline',
    hint: 'Where the firelight catches dark manes and braided hair, the ancient arch watches quietly over the calm gulf waters.',
    timeOfDay: 'Deep Twilight',
  },
  {
    id: 'scene_5',
    title: 'Beneath the Milky Way Arch',
    subtitle: 'Stargazer in the Stone Portal',
    imageUrl: '/assets/aistudio/IMG-20261029-WA1557_b0f01451.jpg',
    horizonRatio: 0.63,
    lat: 28.7245,
    lng: 34.6192,
    regionName: 'Abu Galum Coastal Sanctuary',
    hint: 'Framed directly beneath the stone arch, my scarf catches the sea breeze while the Milky Way rises above distant harbor lights.',
    timeOfDay: 'Astronomical Twilight',
  },
  {
    id: 'scene_6',
    title: 'Galloping Through the Tide',
    subtitle: 'Splash of the Dark Stallion',
    imageUrl: '/assets/aistudio/IMG-20261029-WA4481_c5f1e683.jpg',
    horizonRatio: 0.56,
    lat: 27.7222,
    lng: 34.2539,
    regionName: 'Ras Mohammed Peninsula Shore',
    hint: 'Water splashes beneath galloping hooves right where the mirror-flat tide reflects the fire and the ancient coastal ruins.',
    timeOfDay: 'Blue Hour Dusk',
  },
  {
    id: 'scene_7',
    title: 'Portal to the Horizon',
    subtitle: 'Contemplation by the Driftwood Fire',
    imageUrl: '/assets/aistudio/IMG-20261029-WA5638_201dd32f.jpg',
    horizonRatio: 0.48,
    lat: 28.4631,
    lng: 35.0689,
    regionName: 'Wadi Tayyib Al Ism Gulf Coast',
    hint: 'Through the arched stone doorway, driftwood lies beside the flames and a second stone ruin rests further down the pebble beach.',
    timeOfDay: 'Early Twilight',
  },
  {
    id: 'scene_8',
    title: 'Celestial Archway & Flowing Silk',
    subtitle: 'Night Sky Over the Cove',
    imageUrl: '/assets/aistudio/IMG-20261029-WA6277_40e90343.jpg',
    horizonRatio: 0.65,
    lat: 29.5267,
    lng: 34.9951,
    regionName: 'Gulf of Aqaba Headland',
    hint: 'Under a moss-touched stone arch and a sky full of stars, the sea shimmers silver behind the warm campfire.',
    timeOfDay: 'Starry Night',
  },
  {
    id: 'scene_9',
    title: 'Carved Stone & Firelight',
    subtitle: 'Overlooking the Evening Shore',
    imageUrl: '/assets/aistudio/IMG-20261029-WA9824_2d153840.jpg',
    horizonRatio: 0.35,
    lat: 28.0512,
    lng: 34.4321,
    regionName: 'Strait of Tiran Coral Coast',
    hint: 'Resting a hand on the weathered limestone blocks of the arch while the beach fire glows softly out of focus below.',
    timeOfDay: 'Dusk',
  },
  {
    id: 'scene_10',
    title: 'Shoreline Canter at Dusk',
    subtitle: 'Between Mountain Peaks & Waves',
    imageUrl: '/assets/aistudio/IMG-20261029-WA9913_c15316f2.jpg',
    horizonRatio: 0.47,
    lat: 29.1583,
    lng: 34.7619,
    regionName: 'Sinai Red Sea Mountain Coast',
    hint: 'Riding along the foaming edge of the waves with jagged coastal mountains rising behind the stone arch and beach fire.',
    timeOfDay: 'Twilight',
  },
];

export const ZONES = {
  coastal_360: {
    id: 'coastal_360',
    name: 'MID-STUDIOS Coastal Realms (360°)',
    bounds: { north: 30.2, south: 27.0, west: 33.5, east: 35.8 },
    center: { lat: 28.65, lng: 34.65 },
    zoom: 7,
  },
  global: {
    id: 'global',
    name: 'Global (Anywhere)',
    bounds: null,
    center: { lat: 20, lng: 0 },
    zoom: 2,
  },
  europe: {
    id: 'europe',
    name: 'Europe Only',
    bounds: { north: 71.5, south: 35.0, west: -25.0, east: 40.0 },
    center: { lat: 50, lng: 10 },
    zoom: 4,
  },
  north_america: {
    id: 'north_america',
    name: 'North America',
    bounds: { north: 83.0, south: 15.0, west: -168.0, east: -52.0 },
    center: { lat: 45, lng: -100 },
    zoom: 3,
  },
  landmarks: {
    id: 'landmarks',
    name: 'Major Cities (Global)',
    bounds: null,
    center: { lat: 20, lng: 0 },
    zoom: 2,
  },
};
