// Authentic Cube World (2005–2008) Model Catalog across 1x1, 2x1, 1x2, and 2x2 sizes
window.CW = window.CW || {};

const CUBE_CATALOG = [
  // ================= SERIES 1 (2005) — 1x1 ORIGINALS =================
  {
    id: 'scoop',
    name: 'SCOOP',
    series: 'Series 1',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#f97316',
    colorDark: '#c2410c',
    role: 'Dog Lover',
    prop: 'dog',
    icon: '🐕',
    desc: 'Plays fetch with his pixel pup! When connected, his dog trots into neighbor cubes to visit or chase other stickmen.'
  },
  {
    id: 'slim',
    name: 'SLIM',
    series: 'Series 1',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#9333ea',
    colorDark: '#6b21a8',
    role: 'Stick Master',
    prop: 'staff',
    icon: '🦯',
    desc: 'Twirls his bo-staff, pogo-bounces, and pokes his stick up through the ceiling to tickle upstairs neighbors!'
  },
  {
    id: 'whip',
    name: 'WHIP',
    series: 'Series 1',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#eab308',
    colorDark: '#a16207',
    role: 'Rope Tricks',
    prop: 'rope',
    icon: '➰',
    desc: 'Skips rope, climbs between stacked cubes, and throws a lasso across doorways to pull neighbors over!'
  },
  {
    id: 'dodger',
    name: 'DODGER',
    series: 'Series 1',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#ef4444',
    colorDark: '#b91c1c',
    role: 'Ball Kicker',
    prop: 'ball',
    icon: '⚽',
    desc: 'Bounces and headers his ball! Kicks the ball across connected cubes so neighbors can kick it back.'
  },

  // ================= SERIES 2 & 3 (2006) — 1x1 EVERYDAY HEROES =================
  {
    id: 'mic',
    name: 'MIC',
    series: 'Series 2',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#ec4899',
    colorDark: '#be185d',
    role: 'Rock Musician',
    prop: 'guitar',
    icon: '🎸',
    desc: 'Sings on the mic & shreds guitar! Broadcasts floating music notes that make neighbors in adjacent cubes dance.'
  },
  {
    id: 'hans',
    name: 'HANS',
    series: 'Series 2',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#38bdf8',
    colorDark: '#0284c7',
    role: 'Bodybuilder',
    prop: 'barbell',
    icon: '🏋️',
    desc: 'Pumps heavy iron, does one-arm pushups, and challenges visiting stickmen to flexing & lifting contests!'
  },
  {
    id: 'handy',
    name: 'HANDY',
    series: 'Series 2',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#2563eb',
    colorDark: '#1e40af',
    role: 'Fix-It Builder',
    prop: 'wrench',
    icon: '🔧',
    desc: 'Uses his hammer & wrench to build ladders between stacked cubes and tunes up neighbor interiors.'
  },
  {
    id: 'dusty',
    name: 'DUSTY',
    series: 'Series 2',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#22c55e',
    colorDark: '#15803d',
    role: 'Neat Freak',
    prop: 'broom',
    icon: '🧹',
    desc: 'Vacuums and sweeps his room—sometimes mischievously sweeping dust clouds right into a neighbor cube!'
  },
  {
    id: 'sparky',
    name: 'SPARKY',
    series: 'Series 3',
    category: '1x1',
    gridW: 1,
    gridH: 1,
    color: '#b45309',
    colorDark: '#78350f',
    role: 'Firefighter',
    prop: 'hose',
    icon: '🚒',
    desc: 'Slides rapidly down a fireman pole into cubes below and sprays his firehose when things heat up!'
  },

  // ================= SERIES 5 (2008) — 1x1 MODIFIER CUBES =================
  {
    id: 'splash',
    name: 'SPLASH MOD',
    series: 'Series 5 Mod',
    category: 'mod',
    gridW: 1,
    gridH: 1,
    color: '#06b6d4',
    colorDark: '#0e7490',
    role: 'Faucet Modifier',
    prop: 'faucet',
    icon: '🚰',
    isMod: true,
    modType: 'water',
    desc: 'Modifier Cube! Opens a giant faucet that floods connected neighbor cubes with water so stickmen swim!'
  },
  {
    id: 'hiphop',
    name: 'HIP HOP MOD',
    series: 'Series 5 Mod',
    category: 'mod',
    gridW: 1,
    gridH: 1,
    color: '#334155',
    colorDark: '#0f172a',
    role: 'Subwoofer Modifier',
    prop: 'speaker',
    icon: '🔊',
    isMod: true,
    modType: 'bass',
    desc: 'Modifier Cube! Giant speaker blasts sonic bass waves that vibrate neighbor rooms and start a breakdance party!'
  },
  {
    id: 'scifi',
    name: 'SCI-FI MOD',
    series: 'Series 5 Mod',
    category: 'mod',
    gridW: 1,
    gridH: 1,
    color: '#e2e8f0',
    colorDark: '#94a3b8',
    bezelDarkText: true,
    role: 'Zero-G Teleporter',
    prop: 'beam',
    icon: '🛸',
    isMod: true,
    modType: 'zerog',
    desc: 'Modifier Cube! Emits an anti-gravity particle beam that levitates stick figures and warps them across the network!'
  },

  // ================= MULTI-SIZE CUBES (2x1, 1x2, 2x2 JUMBO PLACES) =================
  {
    id: 'grinder_park',
    name: 'GRINDER PARK',
    series: 'Series 4 Wide',
    category: 'jumbo',
    gridW: 2,
    gridH: 1,
    color: '#d97706',
    colorDark: '#92400e',
    role: '2×1 Skate Half-Pipe',
    prop: 'skateboard',
    icon: '🛹',
    desc: 'Double-wide 2×1 Extreme Skate Park! Stickmen drop into the wide half-pipe ramp and launch aerial kickflips.'
  },
  {
    id: 'sky_tower',
    name: 'LIFT TOWER',
    series: 'Places Tall',
    category: 'jumbo',
    gridW: 1,
    gridH: 2,
    color: '#6366f1',
    colorDark: '#4338ca',
    role: '1×2 Double-Decker',
    prop: 'elevator',
    icon: '🛗',
    desc: 'Double-tall 1×2 Elevator & Loft! Connects lower and upper floors seamlessly so stickmen can travel vertically.'
  },
  {
    id: 'block_bash',
    name: 'BLOCK BASH',
    series: 'Jumbo Places',
    category: 'jumbo',
    gridW: 2,
    gridH: 2,
    color: '#f59e0b',
    colorDark: '#b45309',
    role: '2×2 City Party Pad',
    prop: 'dj',
    icon: '🏙️',
    desc: 'Authentic 2×2 Jumbo Cube! Two-story city lounge with DJ turntables, arcade cabinet, and 8 magnetic doors for huge parties!'
  },
  {
    id: 'global_getaways',
    name: 'GLOBAL GETAWAYS',
    series: 'Jumbo Places',
    category: 'jumbo',
    gridW: 2,
    gridH: 2,
    color: '#0284c7',
    colorDark: '#0369a1',
    role: '2×2 Vacation Resort',
    prop: 'surf',
    icon: '🏝️',
    desc: 'Authentic 2×2 Jumbo Cube! Two-story tropical island resort with palm tree, upper sun-deck, and wave pool!'
  }
];

function getCatalogById(id) {
  return CUBE_CATALOG.find((c) => c.id === id) || CUBE_CATALOG[0];
}

window.CW.CUBE_CATALOG = CUBE_CATALOG;
window.CW.getCatalogById = getCatalogById;
