// Crisp Dot-Matrix LCD Pixel Renderer for Cube World Simulator
// Each 1x1 unit is 64x64 LCD pixels (2x1 = 128x64, 1x2 = 64x128, 2x2 = 128x128)
window.CW = window.CW || {};

const CELL_PX = 64;
const PIXEL_ON = '#182014';
const PIXEL_DIM = 'rgba(24, 32, 20, 0.22)';
const PIXEL_BG = '#9cad84';
const PIXEL_BG_FLASH = '#b5c99a';

// Integer Bresenham line on canvas context
function drawPixelLine(ctx, x0, y0, x1, y1, color = PIXEL_ON) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  ctx.fillStyle = color;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function drawPixelRect(ctx, x, y, w, h, filled = false, color = PIXEL_ON) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  ctx.fillStyle = color;
  if (filled) {
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }
}

function drawPixelCircle(ctx, cx, cy, r, filled = false, color = PIXEL_ON) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d2 = x * x + y * y;
      if (filled) {
        if (d2 <= r * r + 1) ctx.fillRect(cx + x, cy + y, 1, 1);
      } else {
        if (d2 <= r * r + 1 && d2 >= (r - 1) * (r - 1)) {
          ctx.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
  }
}

// Tiny 3x5 pixel bitmap font for LCD labels/scores/emotes
const TINY_FONT = {
  A: [0b010, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b011, 0b100, 0b100, 0b100, 0b011],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b110, 0b100, 0b111],
  F: [0b111, 0b100, 0b110, 0b100, 0b100],
  G: [0b011, 0b100, 0b101, 0b101, 0b011],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  J: [0b001, 0b001, 0b001, 0b101, 0b010],
  K: [0b101, 0b101, 0b110, 0b101, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  M: [0b101, 0b111, 0b101, 0b101, 0b101],
  N: [0b111, 0b101, 0b101, 0b101, 0b101],
  O: [0b010, 0b101, 0b101, 0b101, 0b010],
  P: [0b110, 0b101, 0b110, 0b100, 0b100],
  R: [0b110, 0b101, 0b110, 0b101, 0b101],
  S: [0b011, 0b100, 0b010, 0b001, 0b110],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  U: [0b101, 0b101, 0b101, 0b101, 0b111],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  W: [0b101, 0b101, 0b101, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0b001, 0b010, 0b100, 0b111],
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b001, 0b001],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  '!': [0b010, 0b010, 0b010, 0b000, 0b010],
  '?': [0b111, 0b001, 0b010, 0b000, 0b010]
};

function drawTinyText(ctx, text, x, y, color = PIXEL_ON) {
  ctx.fillStyle = color;
  const str = String(text).toUpperCase();
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ' ') {
      cx += 3;
      continue;
    }
    const rows = TINY_FONT[ch];
    if (rows) {
      for (let r = 0; r < 5; r++) {
        const bits = rows[r];
        if (bits & 0b100) ctx.fillRect(cx, cy + r, 1, 1);
        if (bits & 0b010) ctx.fillRect(cx + 1, cy + r, 1, 1);
        if (bits & 0b001) ctx.fillRect(cx + 2, cy + r, 1, 1);
      }
    }
    cx += 4;
  }
}

// Draw musical note icon (5x5)
function drawNoteIcon(ctx, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = PIXEL_ON;
  ctx.fillRect(x + 2, y, 3, 1);
  ctx.fillRect(x + 2, y + 1, 1, 3);
  ctx.fillRect(x + 4, y + 1, 1, 3);
  ctx.fillRect(x + 1, y + 3, 2, 2);
  ctx.fillRect(x + 3, y + 3, 2, 2);
}

// Draw heart icon (5x5)
function drawHeartIcon(ctx, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = PIXEL_ON;
  ctx.fillRect(x, y + 1, 2, 2);
  ctx.fillRect(x + 3, y + 1, 2, 2);
  ctx.fillRect(x + 1, y + 2, 3, 2);
  ctx.fillRect(x + 2, y + 4, 1, 1);
}

// Draw star/spark icon (5x5)
function drawSparkIcon(ctx, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = PIXEL_ON;
  ctx.fillRect(x + 2, y, 1, 5);
  ctx.fillRect(x, y + 2, 5, 1);
  ctx.fillRect(x + 1, y + 1, 3, 3);
}

// Draw dust cloud (swept by Dusty into neighbor cubes)
function drawDustCloud(ctx, x, y, t) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = PIXEL_ON;
  const puff = Math.floor(t * 10) % 2;
  ctx.fillRect(x - 3, y - 3 - puff, 2, 2);
  ctx.fillRect(x, y - 4 + puff, 3, 2);
  ctx.fillRect(x + 2, y - 2, 2, 2);
  ctx.fillRect(x - 1, y - 1, 3, 1);
}

// Draw pixel dog (Scoop's companion)
function drawPixelDog(ctx, x, y, dir = 1, t = 0, barking = false) {
  x = Math.round(x);
  y = Math.round(y); // y is floor level
  ctx.fillStyle = PIXEL_ON;
  const step = Math.floor(t * 8) % 2;

  // Body (6x3)
  ctx.fillRect(x - 3, y - 5, 6, 3);
  // Head
  const hx = dir > 0 ? x + 2 : x - 5;
  ctx.fillRect(hx, y - 8, 4, 4);
  // Snout
  ctx.fillRect(dir > 0 ? hx + 4 : hx - 2, y - 7, 2, 2);
  // Floppy ear
  ctx.fillRect(dir > 0 ? hx : hx + 3, y - 9, 2, 2);
  // Wagging tail
  const tailY = (Math.floor(t * 12) % 2 === 0) ? y - 7 : y - 6;
  ctx.fillRect(dir > 0 ? x - 5 : x + 3, tailY, 2, 2);
  // Legs
  ctx.fillRect(x - 3 + step, y - 2, 1, 2);
  ctx.fillRect(x + 2 - step, y - 2, 1, 2);

  if (barking && Math.floor(t * 6) % 2 === 0) {
    drawPixelLine(ctx, dir > 0 ? hx + 7 : hx - 4, y - 9, dir > 0 ? hx + 9 : hx - 6, y - 11);
    drawPixelLine(ctx, dir > 0 ? hx + 7 : hx - 4, y - 7, dir > 0 ? hx + 10 : hx - 7, y - 7);
  }
}

// Render Cube Interior Furniture, Props & Connected Doorways
function renderCubeEnvironment(ctx, cube, simTime) {
  const W = cube.gridW * CELL_PX;
  const H = cube.gridH * CELL_PX;

  // Background fill (flashes briefly when newly snapped!)
  const isFlashing = cube.flashTimer > 0;
  ctx.fillStyle = isFlashing && (Math.floor(simTime * 16) % 2 === 0) ? PIXEL_BG_FLASH : PIXEL_BG;
  ctx.fillRect(0, 0, W, H);

  // Outer LCD border frame
  drawPixelRect(ctx, 1, 1, W - 2, H - 2, false, PIXEL_DIM);

  // Draw floors for each unit row
  for (let r = 0; r < cube.gridH; r++) {
    const floorY = (r + 1) * CELL_PX - 6;
    drawPixelLine(ctx, 2, floorY, W - 3, floorY, PIXEL_ON);
    // Floor hash ticks
    for (let gx = 6; gx < W - 6; gx += 8) {
      ctx.fillRect(gx, floorY + 1, 2, 1);
    }
  }

  // Draw internal vertical access (ladders/elevator) for multi-story cubes (gridH > 1)
  if (cube.gridH > 1) {
    const ladderX = cube.id === 'sky_tower' ? 14 : 60;
    for (let ly = 22; ly < H - 6; ly += 3) {
      ctx.fillRect(ladderX - 3, ly, 1, 3);
      ctx.fillRect(ladderX + 3, ly, 1, 3);
      if (ly % 6 === 0) {
        ctx.fillRect(ladderX - 3, ly, 7, 1);
      }
    }
  }

  // Draw open doorways on edges that are magnetically snapped to another cube!
  for (const door of cube.doors) {
    if (door.side === 'W') {
      const fy = (door.localY + 1) * CELL_PX - 6;
      ctx.fillStyle = PIXEL_BG;
      ctx.fillRect(0, fy - 18, 4, 18);
      drawPixelRect(ctx, 0, fy - 19, 5, 19, false, PIXEL_ON);
      ctx.fillStyle = PIXEL_BG;
      ctx.fillRect(0, fy - 18, 4, 17);
    } else if (door.side === 'E') {
      const fy = (door.localY + 1) * CELL_PX - 6;
      ctx.fillStyle = PIXEL_BG;
      ctx.fillRect(W - 4, fy - 18, 4, 18);
      drawPixelRect(ctx, W - 5, fy - 19, 5, 19, false, PIXEL_ON);
      ctx.fillStyle = PIXEL_BG;
      ctx.fillRect(W - 4, fy - 18, 4, 17);
    } else if (door.side === 'N') {
      const cx = door.localX * CELL_PX + 32;
      // Ceiling hatch + ladder down to this top floor
      ctx.fillStyle = PIXEL_BG;
      ctx.fillRect(cx - 6, 0, 12, 4);
      for (let ly = 0; ly < CELL_PX - 6; ly += 4) {
        ctx.fillStyle = PIXEL_ON;
        ctx.fillRect(cx - 4, ly, 1, 4);
        ctx.fillRect(cx + 4, ly, 1, 4);
        ctx.fillRect(cx - 4, ly + 1, 9, 1);
      }
    } else if (door.side === 'S') {
      const cx = door.localX * CELL_PX + 32;
      const fy = H - 6;
      // Floor hatch + steps down to bottom edge
      ctx.fillStyle = PIXEL_BG;
      ctx.fillRect(cx - 5, fy, 11, 6);
      for (let ly = fy; ly < H; ly += 2) {
        ctx.fillStyle = PIXEL_ON;
        ctx.fillRect(cx - 4, ly, 1, 2);
        ctx.fillRect(cx + 4, ly, 1, 2);
        ctx.fillRect(cx - 4, ly, 9, 1);
      }
    }
  }

  // Draw cube-specific background furniture & props
  drawCubeSpecificDecor(ctx, cube, W, H, simTime);

  // Draw active Mod overlays (Water flood, Bass waves, Zero-G field)
  if (cube.activeMods.water) {
    const waveY = 20 + Math.round(Math.sin(simTime * 3) * 2);
    for (let x = 2; x < W - 2; x += 4) {
      const wy = waveY + Math.round(Math.sin(simTime * 5 + x * 0.2) * 2);
      ctx.fillStyle = PIXEL_ON;
      ctx.fillRect(x, wy, 3, 1);
    }
    // Rising bubbles
    for (let b = 0; b < 4; b++) {
      const bx = ((b * 29 + 11) % (W - 12)) + 6;
      const by = H - 10 - ((Math.floor(simTime * 18 + b * 15)) % (H - 32));
      drawPixelRect(ctx, bx, by, 2, 2, false, PIXEL_ON);
    }
  }

  if (cube.activeMods.bass) {
    // Pulsing corner speaker brackets
    const pulse = Math.floor(simTime * 10) % 2;
    if (pulse === 0) {
      drawNoteIcon(ctx, 6, 8);
      drawNoteIcon(ctx, W - 12, 10);
    }
  }

  if (cube.activeMods.zerog) {
    // Floating anti-gravity particles
    for (let p = 0; p < 6; p++) {
      const px = ((p * 23 + Math.floor(simTime * 10)) % (W - 10)) + 5;
      const py = ((p * 17 - Math.floor(simTime * 14)) % (H - 14) + (H - 14)) % (H - 14) + 6;
      ctx.fillStyle = PIXEL_ON;
      ctx.fillRect(px, py, 2, 1);
    }
  }
}

function drawCubeSpecificDecor(ctx, cube, W, H, t) {
  const fy = H - 6;
  ctx.fillStyle = PIXEL_ON;

  switch (cube.id) {
    case 'scoop': {
      // Doghouse on left + food dish
      drawPixelRect(ctx, 6, fy - 11, 12, 11, false);
      drawPixelLine(ctx, 5, fy - 11, 12, fy - 17);
      drawPixelLine(ctx, 19, fy - 11, 12, fy - 17);
      ctx.fillRect(10, fy - 7, 4, 7); // door
      // Dog bowl
      drawPixelRect(ctx, 48, fy - 3, 7, 3, true);
      break;
    }
    case 'slim': {
      // Martial arts target banner on wall
      drawPixelRect(ctx, 8, 12, 10, 14, false, PIXEL_DIM);
      drawPixelCircle(ctx, 13, 19, 3, false, PIXEL_DIM);
      break;
    }
    case 'whip': {
      // Coiled rope on wall hook
      drawPixelCircle(ctx, 12, 18, 4, false, PIXEL_DIM);
      drawPixelCircle(ctx, 12, 18, 2, false, PIXEL_DIM);
      break;
    }
    case 'dodger': {
      // Mini soccer net on right side & scoreboard on top
      drawPixelRect(ctx, 20, 5, 24, 9, false);
      drawTinyText(ctx, 'GOAL', 24, 7);
      break;
    }
    case 'mic': {
      // Amp stack on left + mic stand
      drawPixelRect(ctx, 6, fy - 16, 12, 16, false);
      drawPixelCircle(ctx, 12, fy - 11, 3, false);
      drawPixelCircle(ctx, 12, fy - 4, 2, false);
      break;
    }
    case 'hans': {
      // Dumbbell rack on left + trophy
      drawPixelRect(ctx, 6, fy - 12, 10, 12, false);
      ctx.fillRect(8, fy - 9, 6, 2);
      ctx.fillRect(8, fy - 5, 6, 2);
      break;
    }
    case 'handy': {
      // Pegboard with tools + workbench
      drawPixelRect(ctx, 6, fy - 10, 15, 10, false);
      drawPixelRect(ctx, 8, 12, 16, 10, false, PIXEL_DIM);
      break;
    }
    case 'dusty': {
      // Bookshelf & neat picture frame
      drawPixelRect(ctx, 44, 14, 14, 18, false);
      drawPixelLine(ctx, 44, 20, 57, 20);
      drawPixelLine(ctx, 44, 26, 57, 26);
      break;
    }
    case 'sparky': {
      // Fire station pole from ceiling to floor + alarm bell
      drawPixelLine(ctx, 14, 2, 14, fy, PIXEL_ON);
      drawPixelCircle(ctx, 48, 14, 3, true);
      if (Math.floor(t * 8) % 2 === 0) {
        ctx.fillRect(53, 13, 2, 2);
      }
      break;
    }
    case 'splash': {
      // Giant Faucet in center-top pouring water!
      drawPixelRect(ctx, 24, 6, 16, 6, true);
      drawPixelRect(ctx, 28, 12, 8, 6, true);
      // Valve wheel
      drawPixelLine(ctx, 22, 3, 42, 3);
      ctx.fillRect(31, 3, 2, 3);
      // Pouring water stream
      for (let wy = 18; wy < fy; wy += 3) {
        const offset = (Math.floor(t * 15 + wy) % 3) - 1;
        ctx.fillRect(29 + offset, wy, 6, 2);
      }
      drawTinyText(ctx, 'H2O', 6, 7);
      break;
    }
    case 'hiphop': {
      // Giant Subwoofer Cone in center
      const r = (Math.floor(t * 12) % 2 === 0) ? 17 : 15;
      drawPixelRect(ctx, 12, 10, 40, 44, false);
      drawPixelCircle(ctx, 32, 32, r, false);
      drawPixelCircle(ctx, 32, 32, 6, true);
      drawTinyText(ctx, 'BASS', 24, 4);
      break;
    }
    case 'scifi': {
      // Teleporter emitter pads on ceiling & floor + energy rings
      drawPixelRect(ctx, 20, 3, 24, 4, true);
      drawPixelRect(ctx, 20, fy - 3, 24, 4, true);
      const ringY = 12 + ((Math.floor(t * 28)) % (fy - 20));
      drawPixelLine(ctx, 22, ringY, 42, ringY);
      drawPixelLine(ctx, 24, ringY + 8, 40, ringY + 8);
      drawTinyText(ctx, 'WARP', 6, 8);
      break;
    }
    case 'grinder_park': {
      // 2x1 Wide Skate Half-Pipe!
      drawTinyText(ctx, 'SKATE PARK', 44, 6);
      // Left quarter-pipe ramp
      drawPixelLine(ctx, 6, fy - 22, 26, fy);
      drawPixelLine(ctx, 6, fy - 22, 6, fy);
      // Right quarter-pipe ramp
      drawPixelLine(ctx, W - 7, fy - 22, W - 27, fy);
      drawPixelLine(ctx, W - 7, fy - 22, W - 7, fy);
      // Center grind rail
      drawPixelLine(ctx, 46, fy - 6, 82, fy - 6);
      drawPixelLine(ctx, 52, fy - 6, 52, fy);
      drawPixelLine(ctx, 76, fy - 6, 76, fy);
      break;
    }
    case 'sky_tower': {
      // 1x2 Tall Elevator Shaft & Two Floors
      const cabY = 12 + Math.round((Math.sin(t * 1.4) * 0.5 + 0.5) * 66);
      drawPixelLine(ctx, 22, 2, 22, H - 6, PIXEL_DIM);
      drawPixelLine(ctx, 42, 2, 42, H - 6, PIXEL_DIM);
      // Moving elevator car
      drawPixelRect(ctx, 24, cabY, 16, 22, false, PIXEL_ON);
      drawPixelLine(ctx, 32, 2, 32, cabY, PIXEL_ON); // cable
      drawTinyText(ctx, 'LIFT', 44, 8);
      break;
    }
    case 'block_bash': {
      // 2x2 Jumbo City Party Pad!
      const floor1Y = CELL_PX - 6;
      const floor2Y = H - 6;
      // Disco ball hanging from top center
      drawPixelLine(ctx, 64, 2, 64, 10);
      drawPixelCircle(ctx, 64, 15, 5, false);
      if (Math.floor(t * 6) % 2 === 0) {
        drawPixelLine(ctx, 54, 12, 50, 9);
        drawPixelLine(ctx, 74, 12, 78, 9);
        drawPixelLine(ctx, 56, 20, 51, 24);
        drawPixelLine(ctx, 72, 20, 77, 24);
      }
      // DJ Booth on top floor right
      drawPixelRect(ctx, 82, floor1Y - 11, 28, 11, false);
      drawTinyText(ctx, 'DJ', 92, floor1Y - 8);
      // Bottom floor: Arcade Cabinet + Lounge Couch
      drawPixelRect(ctx, 14, floor2Y - 20, 13, 20, false);
      ctx.fillRect(17, floor2Y - 16, 7, 6);
      // Couch
      drawPixelRect(ctx, 76, floor2Y - 9, 28, 9, false);
      drawTinyText(ctx, 'BLOCK BASH', 12, 6);
      break;
    }
    case 'global_getaways': {
      // 2x2 Jumbo Tropical Resort!
      const floor1Y = CELL_PX - 6;
      const floor2Y = H - 6;
      // Top deck: Palm tree & Sun
      drawPixelCircle(ctx, 108, 14, 6, false);
      // Palm trunk
      drawPixelLine(ctx, 24, floor1Y, 28, floor1Y - 26);
      drawPixelLine(ctx, 25, floor1Y, 29, floor1Y - 26);
      // Palm fronds
      drawPixelLine(ctx, 28, floor1Y - 26, 16, floor1Y - 22);
      drawPixelLine(ctx, 28, floor1Y - 26, 40, floor1Y - 22);
      drawPixelLine(ctx, 28, floor1Y - 26, 20, floor1Y - 32);
      drawPixelLine(ctx, 28, floor1Y - 26, 36, floor1Y - 32);
      // Lower floor: Wave pool & Tiki Bar
      drawPixelRect(ctx, 86, floor2Y - 16, 26, 16, false);
      drawPixelLine(ctx, 82, floor2Y - 16, 115, floor2Y - 16);
      drawTinyText(ctx, 'TIKI', 91, floor2Y - 10);
      // Animated waves on lower left
      for (let wx = 10; wx < 66; wx += 6) {
        const wy = floor2Y - 4 + Math.round(Math.sin(t * 5 + wx * 0.2) * 2);
        ctx.fillRect(wx, wy, 4, 2);
      }
      drawTinyText(ctx, 'RESORT', 46, 6);
      break;
    }
  }
}

// Render an articulated Stick Figure in the Cube!
function renderStickman(ctx, person, cube, simTime, worldTilt = 0) {
  const x = Math.round(person.x);
  const y = Math.round(person.y); // foot position
  const dir = person.dir || 1;
  const t = simTime + person.phase;
  const state = person.state;

  ctx.save();

  // Handle Gyroscope Tilt transformation around stickman center if tilted
  if (worldTilt !== 0) {
    ctx.translate(x, y - 12);
    ctx.rotate((worldTilt * Math.PI) / 180);
    ctx.translate(-x, -(y - 12));
  }

  // If Zero-G mod is active on this cube, float & gently bob mid-air!
  let yOff = 0;
  if (cube.activeMods.zerog && state !== 'CLIMBING') {
    yOff = -12 + Math.round(Math.sin(t * 3) * 5);
  } else if (cube.activeMods.bass && state !== 'CLIMBING') {
    yOff = -Math.abs(Math.round(Math.sin(t * 10) * 5));
  }

  const footY = y + yOff;
  const hipY = footY - 8;
  const neckY = footY - 17;
  const headY = footY - 21;

  // Draw visitor badge above head if visiting another cube!
  if (person.homeCubeId !== cube.uid) {
    drawTinyText(ctx, person.name.slice(0, 3), x - 5, headY - 9);
  }

  // Special pose: Swimming when Splash Mod floods the room
  if (cube.activeMods.water && state !== 'CLIMBING') {
    drawSwimmingStickman(ctx, x, footY - 14, dir, t, person);
    ctx.restore();
    return;
  }

  // Climbing ladder/pole vertically
  if (state === 'CLIMBING') {
    drawPixelCircle(ctx, x, headY, 3, false);
    drawCharacterAccessory(ctx, x, headY, dir, person.charId);
    drawPixelLine(ctx, x, neckY, x, hipY);
    const rung = Math.floor(t * 10) % 2;
    drawPixelLine(ctx, x, neckY + 2, x - 4, neckY - (rung ? 3 : -1));
    drawPixelLine(ctx, x, neckY + 2, x + 4, neckY - (rung ? -1 : 3));
    drawPixelLine(ctx, x, hipY, x - 3, footY - (rung ? 3 : 0));
    drawPixelLine(ctx, x, hipY, x + 3, footY - (rung ? 0 : 3));
    ctx.restore();
    return;
  }

  // Head
  const headBob = (state === 'WALKING' || state === 'DANCING') ? (Math.floor(t * 10) % 2) : 0;
  drawPixelCircle(ctx, x, headY + headBob, 3, false);
  drawCharacterAccessory(ctx, x, headY + headBob, dir, person.charId);

  // Torso
  drawPixelLine(ctx, x, neckY + headBob, x, hipY);

  // Legs & Arms based on state
  if (state === 'WALKING' || state === 'VISITING') {
    const stride = Math.round(Math.sin(t * 12) * 5);
    drawPixelLine(ctx, x, hipY, x + stride, footY);
    drawPixelLine(ctx, x, hipY, x - stride, footY);
    drawPixelLine(ctx, x, neckY + 2, x - stride, hipY - 1);
    drawPixelLine(ctx, x, neckY + 2, x + stride, hipY - 1);
  } else if (state === 'POKE_CEILING') {
    // Slim poking his long stick up through the ceiling hatch to tickle upstairs neighbor!
    drawPixelLine(ctx, x, hipY, x - 3, footY);
    drawPixelLine(ctx, x, hipY, x + 3, footY);
    const poke = (Math.floor(t * 12) % 2 === 0) ? 0 : 3;
    drawPixelLine(ctx, x, neckY + 2, x + 3, headY - 3);
    drawPixelLine(ctx, x, neckY + 2, x - 3, headY - 3);
    drawPixelLine(ctx, x, headY - 2, x, poke);
  } else if (state === 'SOCIAL_DANCE' || cube.activeMods.bass) {
    const wave = Math.round(Math.sin(t * 10) * 5);
    drawPixelLine(ctx, x, hipY, x - 4 + (wave > 0 ? 2 : 0), footY);
    drawPixelLine(ctx, x, hipY, x + 4 - (wave < 0 ? 2 : 0), footY);
    drawPixelLine(ctx, x, neckY + 2, x - 6, neckY - 3 + wave);
    drawPixelLine(ctx, x, neckY + 2, x + 6, neckY - 3 - wave);
    if (Math.floor(t * 4) % 2 === 0) {
      drawNoteIcon(ctx, x + 6, headY - 8);
    }
  } else if (state === 'SOCIAL_HIGHFIVE') {
    const jump = Math.abs(Math.round(Math.sin(t * 8) * 4));
    drawPixelLine(ctx, x, hipY - jump, x - 3, footY - jump);
    drawPixelLine(ctx, x, hipY - jump, x + 3, footY - jump);
    // High-five raised arm toward partner
    drawPixelLine(ctx, x, neckY + 2 - jump, x + dir * 7, neckY - 5 - jump);
    drawPixelLine(ctx, x, neckY + 2 - jump, x - dir * 4, hipY - jump);
    if (jump > 2) {
      drawSparkIcon(ctx, x + dir * 6, neckY - 9 - jump);
    }
  } else if (state === 'SOCIAL_CHAT') {
    drawPixelLine(ctx, x, hipY, x - 3, footY);
    drawPixelLine(ctx, x, hipY, x + 3, footY);
    const g = Math.round(Math.sin(t * 8) * 3);
    drawPixelLine(ctx, x, neckY + 2, x + dir * 6, neckY + g);
    drawPixelLine(ctx, x, neckY + 2, x - dir * 3, hipY - 1);
    if (Math.floor(t * 3) % 2 === 0) {
      drawHeartIcon(ctx, x - 2, headY - 10);
    }
  } else if (state === 'TRICK') {
    drawCharacterSignatureTrick(ctx, person, x, footY, hipY, neckY, headY, dir, t);
  } else if (state === 'TILTED') {
    // Flailing arms when gyroscope is tilted!
    const flail = Math.round(Math.sin(t * 16) * 5);
    drawPixelLine(ctx, x, hipY, x - 4, footY - 2);
    drawPixelLine(ctx, x, hipY, x + 4, footY - 2);
    drawPixelLine(ctx, x, neckY + 1, x - 6, neckY - 4 + flail);
    drawPixelLine(ctx, x, neckY + 1, x + 6, neckY - 4 - flail);
    drawTinyText(ctx, '!', x - 1, headY - 10);
  } else {
    // IDLE breathing & looking
    const breathe = Math.floor(t * 3) % 2;
    drawPixelLine(ctx, x, hipY, x - 3, footY);
    drawPixelLine(ctx, x, hipY, x + 3, footY);
    drawPixelLine(ctx, x, neckY + 2, x - 4, hipY - breathe);
    drawPixelLine(ctx, x, neckY + 2, x + 4, hipY - breathe);
  }

  ctx.restore();
}

function drawSwimmingStickman(ctx, x, y, dir, t, person) {
  const stroke = Math.round(Math.sin(t * 8) * 4);
  const hx = x + dir * 9;
  drawPixelCircle(ctx, hx, y, 3, false);
  drawCharacterAccessory(ctx, hx, y, dir, person.charId);
  // Horizontal torso
  drawPixelLine(ctx, x - dir * 2, y + 2, hx - dir * 3, y + 2);
  // Swimming arms & kicking legs
  drawPixelLine(ctx, hx - dir * 4, y + 2, hx + dir * 2, y - 3 + stroke);
  drawPixelLine(ctx, x - dir * 2, y + 2, x - dir * 8, y + stroke);
  drawPixelLine(ctx, x - dir * 2, y + 2, x - dir * 8, y + 4 - stroke);
}

// Small headgear/hat/hair detail so each stickman is recognizable across cubes
function drawCharacterAccessory(ctx, hx, hy, dir, charId) {
  ctx.fillStyle = PIXEL_ON;
  switch (charId) {
    case 'whip':
      // Cowboy hat brim
      drawPixelLine(ctx, hx - 5, hy - 3, hx + 5, hy - 3);
      ctx.fillRect(hx - 2, hy - 5, 5, 2);
      break;
    case 'sparky':
      // Firefighter helmet crest
      drawPixelLine(ctx, hx - 4, hy - 3, hx + 4, hy - 3);
      ctx.fillRect(hx - 2, hy - 5, 4, 2);
      break;
    case 'mic':
      // Spiky rocker hair
      ctx.fillRect(hx - 2, hy - 5, 1, 2);
      ctx.fillRect(hx, hy - 6, 1, 3);
      ctx.fillRect(hx + 2, hy - 5, 1, 2);
      break;
    case 'hans':
      // Sweatband + flat-top
      drawPixelLine(ctx, hx - 3, hy - 2, hx + 3, hy - 2);
      break;
    case 'handy':
      // Visor cap
      drawPixelLine(ctx, hx - 3, hy - 3, hx + dir * 5, hy - 3);
      break;
    default:
      break;
  }
}

// Unique signature tricks for each character type!
function drawCharacterSignatureTrick(ctx, person, x, footY, hipY, neckY, headY, dir, t) {
  switch (person.charId) {
    case 'slim': {
      // Spinning bo-staff overhead or pole-bounce!
      drawPixelLine(ctx, x, hipY, x - 3, footY);
      drawPixelLine(ctx, x, hipY, x + 3, footY);
      drawPixelLine(ctx, x, neckY + 2, x + dir * 5, neckY - 2);
      drawPixelLine(ctx, x, neckY + 2, x - dir * 4, hipY - 1);
      const angle = t * 10;
      const sx = Math.round(Math.cos(angle) * 10);
      const sy = Math.round(Math.sin(angle) * 10);
      drawPixelLine(ctx, x + dir * 5 - sx, neckY - 3 - sy, x + dir * 5 + sx, neckY - 3 + sy);
      break;
    }
    case 'whip': {
      // Twirling giant overhead lasso!
      drawPixelLine(ctx, x, hipY, x - 3, footY);
      drawPixelLine(ctx, x, hipY, x + 3, footY);
      drawPixelLine(ctx, x, neckY + 2, x + dir * 3, headY - 4);
      drawPixelLine(ctx, x, neckY + 2, x - dir * 4, hipY - 1);
      const lx = x + Math.round(Math.cos(t * 9) * 4);
      drawPixelCircle(ctx, lx, headY - 8, 7, false);
      break;
    }
    case 'dodger': {
      // Juggling soccer ball on knee & head!
      const bounce = Math.abs(Math.round(Math.sin(t * 10) * 10));
      drawPixelLine(ctx, x, hipY, x - 3, footY);
      drawPixelLine(ctx, x, hipY, x + dir * 5, hipY - 2);
      drawPixelLine(ctx, x, neckY + 2, x - 5, hipY - 2);
      drawPixelLine(ctx, x, neckY + 2, x + 5, hipY - 2);
      drawPixelCircle(ctx, x + dir * 6, hipY - 4 - bounce, 2, true);
      break;
    }
    case 'mic': {
      // Shredding electric guitar + floating music notes!
      drawPixelLine(ctx, x, hipY, x - 4, footY);
      drawPixelLine(ctx, x, hipY, x + 4, footY);
      // Guitar body & neck
      drawPixelCircle(ctx, x - dir * 1, hipY - 2, 3, true);
      drawPixelLine(ctx, x - dir * 2, hipY - 2, x + dir * 8, neckY - 1);
      drawNoteIcon(ctx, x + dir * 7, headY - 6 - (Math.floor(t * 6) % 6));
      break;
    }
    case 'hans': {
      // Overhead heavy barbell clean & press!
      const liftY = (Math.floor(t * 4) % 2 === 0) ? headY - 5 : neckY + 2;
      drawPixelLine(ctx, x, hipY, x - 4, footY);
      drawPixelLine(ctx, x, hipY, x + 4, footY);
      drawPixelLine(ctx, x, neckY + 2, x - 6, liftY);
      drawPixelLine(ctx, x, neckY + 2, x + 6, liftY);
      // Barbell bar + weight plates
      drawPixelLine(ctx, x - 11, liftY, x + 11, liftY);
      drawPixelRect(ctx, x - 11, liftY - 3, 3, 7, true);
      drawPixelRect(ctx, x + 9, liftY - 3, 3, 7, true);
      break;
    }
    case 'handy': {
      // Swinging wrench/hammer with sparks!
      drawPixelLine(ctx, x, hipY, x - 3, footY);
      drawPixelLine(ctx, x, hipY, x + 3, footY);
      const swing = (Math.floor(t * 10) % 2 === 0) ? -5 : 2;
      drawPixelLine(ctx, x, neckY + 2, x + dir * 6, neckY + swing);
      drawPixelLine(ctx, x + dir * 6, neckY + swing, x + dir * 9, neckY + swing - 3);
      if (swing > 0) {
        drawSparkIcon(ctx, x + dir * 8, neckY + 1);
      }
      break;
    }
    case 'dusty': {
      // Sweeping broom vigorously back and forth!
      drawPixelLine(ctx, x, hipY, x - 3, footY);
      drawPixelLine(ctx, x, hipY, x + 3, footY);
      const sweep = Math.round(Math.sin(t * 12) * 5);
      drawPixelLine(ctx, x, neckY + 2, x + dir * 4, hipY - 2);
      drawPixelLine(ctx, x + dir * 2, neckY + 2, x + dir * 5 + sweep, footY);
      drawPixelRect(ctx, x + dir * 3 + sweep, footY - 2, 5, 2, true);
      break;
    }
    case 'sparky': {
      // Spraying firehose stream!
      drawPixelLine(ctx, x, hipY, x - 3, footY);
      drawPixelLine(ctx, x, hipY, x + 3, footY);
      drawPixelLine(ctx, x, neckY + 2, x + dir * 6, neckY + 2);
      for (let i = 1; i <= 4; i++) {
        const wy = neckY + 2 + Math.round(Math.sin(t * 15 + i) * 2);
        ctx.fillRect(x + dir * (6 + i * 3), wy, 2, 2);
      }
      break;
    }
    case 'grinder_park': {
      // Skateboard kickflip!
      const air = Math.abs(Math.round(Math.sin(t * 8) * 6));
      drawPixelLine(ctx, x, hipY - air, x - 3, footY - 3 - air);
      drawPixelLine(ctx, x, hipY - air, x + 3, footY - 3 - air);
      drawPixelLine(ctx, x, neckY + 2 - air, x - 6, neckY - 2 - air);
      drawPixelLine(ctx, x, neckY + 2 - air, x + 6, neckY - 2 - air);
      // Skateboard deck & wheels
      drawPixelLine(ctx, x - 6, footY - 2 - air, x + 6, footY - 2 - air);
      ctx.fillRect(x - 4, footY - 1 - air, 2, 2);
      ctx.fillRect(x + 3, footY - 1 - air, 2, 2);
      break;
    }
    default: {
      // Backflip / Jumping Jack
      const up = (Math.floor(t * 8) % 2 === 0);
      drawPixelLine(ctx, x, hipY, x - (up ? 5 : 2), footY);
      drawPixelLine(ctx, x, hipY, x + (up ? 5 : 2), footY);
      drawPixelLine(ctx, x, neckY + 2, x - 6, up ? headY - 4 : hipY);
      drawPixelLine(ctx, x, neckY + 2, x + 6, up ? headY - 4 : hipY);
      break;
    }
  }
}

window.CW.sprites = {
  CELL_PX,
  renderCubeEnvironment,
  renderStickman,
  drawPixelDog,
  drawPixelCircle,
  drawTinyText,
  drawSparkIcon,
  drawDustCloud
};
