// colorNames.js - Compact NTC-style color name lookup
// Covers 140 colors with strong fashion/design coverage

const COLOR_NAMES = [
  [0,0,0,'Black'],[255,255,255,'White'],[128,128,128,'Gray'],[192,192,192,'Silver'],
  [169,169,169,'Dark Gray'],[211,211,211,'Light Gray'],[245,245,245,'White Smoke'],
  // Reds
  [255,0,0,'Red'],[220,20,60,'Crimson'],[178,34,34,'Firebrick'],[139,0,0,'Dark Red'],
  [205,92,92,'Indian Red'],[240,128,128,'Light Coral'],[255,99,71,'Tomato'],
  [255,69,0,'Orange Red'],[250,128,114,'Salmon'],[255,160,122,'Light Salmon'],
  // Pinks
  [255,192,203,'Pink'],[255,182,193,'Light Pink'],[255,105,180,'Hot Pink'],
  [255,20,147,'Deep Pink'],[219,112,147,'Pale Violet Red'],[199,21,133,'Medium Violet Red'],
  [255,182,193,'Rose'],[255,228,225,'Misty Rose'],[255,240,245,'Lavender Blush'],
  // Oranges
  [255,165,0,'Orange'],[255,140,0,'Dark Orange'],[255,127,80,'Coral'],
  [255,228,196,'Bisque'],[255,218,185,'Peach Puff'],[255,222,173,'Navajo White'],
  [250,235,215,'Antique White'],
  // Yellows
  [255,255,0,'Yellow'],[255,215,0,'Gold'],[240,230,140,'Khaki'],[189,183,107,'Dark Khaki'],
  [255,255,224,'Light Yellow'],[255,250,205,'Lemon Chiffon'],[255,245,157,'Pale Yellow'],
  [218,165,32,'Goldenrod'],[184,134,11,'Dark Goldenrod'],
  // Greens
  [0,128,0,'Green'],[0,255,0,'Lime'],[0,100,0,'Dark Green'],[144,238,144,'Light Green'],
  [152,251,152,'Pale Green'],[0,255,127,'Spring Green'],[0,250,154,'Medium Spring Green'],
  [50,205,50,'Lime Green'],[124,252,0,'Lawn Green'],[127,255,0,'Chartreuse'],
  [34,139,34,'Forest Green'],[46,139,87,'Sea Green'],[60,179,113,'Medium Sea Green'],
  [143,188,143,'Dark Sea Green'],[32,178,170,'Light Sea Green'],
  [128,128,0,'Olive'],[85,107,47,'Dark Olive Green'],[107,142,35,'Olive Drab'],
  // Teals/Cyans
  [0,128,128,'Teal'],[0,255,255,'Cyan'],[0,139,139,'Dark Cyan'],
  [32,178,170,'Light Teal'],[64,224,208,'Turquoise'],[72,209,204,'Medium Turquoise'],
  [175,238,238,'Pale Turquoise'],[127,255,212,'Aquamarine'],[102,205,170,'Medium Aquamarine'],
  // Blues
  [0,0,255,'Blue'],[0,0,139,'Dark Blue'],[0,0,205,'Medium Blue'],[173,216,230,'Light Blue'],
  [135,206,235,'Sky Blue'],[135,206,250,'Light Sky Blue'],[30,144,255,'Dodger Blue'],
  [0,191,255,'Deep Sky Blue'],[100,149,237,'Cornflower Blue'],[70,130,180,'Steel Blue'],
  [176,196,222,'Light Steel Blue'],[65,105,225,'Royal Blue'],[25,25,112,'Midnight Blue'],
  [0,0,128,'Navy'],[0,0,80,'Deep Navy'],[240,248,255,'Alice Blue'],
  // Purples
  [128,0,128,'Purple'],[148,0,211,'Dark Violet'],[138,43,226,'Blue Violet'],
  [153,50,204,'Dark Orchid'],[186,85,211,'Medium Orchid'],[218,112,214,'Orchid'],
  [221,160,221,'Plum'],[238,130,238,'Violet'],[255,0,255,'Magenta'],
  [139,0,139,'Dark Magenta'],[75,0,130,'Indigo'],[72,61,139,'Dark Slate Blue'],
  [106,90,205,'Slate Blue'],[123,104,238,'Medium Slate Blue'],
  [147,112,219,'Medium Purple'],[216,191,216,'Thistle'],[230,230,250,'Lavender'],
  [248,240,255,'Ghost White'],
  // Browns/Earth
  [165,42,42,'Brown'],[139,69,19,'Saddle Brown'],[160,82,45,'Sienna'],
  [210,105,30,'Chocolate'],[205,133,63,'Peru'],[222,184,135,'Burlywood'],
  [245,245,220,'Beige'],[245,222,179,'Wheat'],[244,164,96,'Sandy Brown'],
  [210,180,140,'Tan'],[188,143,143,'Rosy Brown'],[255,248,220,'Cornsilk'],
  [253,245,230,'Old Lace'],[250,250,210,'Light Goldenrod'],
  // Fashion specials
  [183,110,121,'Mauve'],[255,100,150,'Flamingo'],[255,179,179,'Blush'],
  [255,228,181,'Champagne'],[245,230,211,'Ivory'],[204,153,0,'Mustard'],
  [150,111,51,'Bronze'],[180,130,70,'Caramel'],[91,60,17,'Espresso'],
  [142,69,133,'Berry'],[190,30,45,'Burgundy'],[109,7,26,'Oxblood'],
  [255,117,56,'Tangerine'],[255,95,31,'Burnt Orange'],[179,255,179,'Mint'],
  [152,255,208,'Seafoam'],[175,225,175,'Sage'],[119,158,203,'Periwinkle'],
  [221,65,36,'Rust'],[183,65,14,'Terracotta'],[58,95,11,'Moss'],
];

// hex string "#RRGGBB" → [r, g, b]
const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

// Euclidean distance in RGB space
const colorDistance = (r1, g1, b1, r2, g2, b2) =>
  Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

/**
 * Returns the closest named color for a hex string.
 * @param {string} hex  e.g. "#FF6B6B"
 * @returns {string}    e.g. "Light Coral"
 */
export const getColorName = (hex) => {
  if (!hex || typeof hex !== 'string') return '';
  try {
    const [r, g, b] = hexToRgb(hex);
    let minDist = Infinity;
    let name = '';
    for (const [nr, ng, nb, n] of COLOR_NAMES) {
      const d = colorDistance(r, g, b, nr, ng, nb);
      if (d < minDist) {
        minDist = d;
        name = n;
      }
    }
    return name;
  } catch {
    return '';
  }
};
