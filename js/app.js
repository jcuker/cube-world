// Main Application Controller for Cube World Simulator
// Handles Catalog UI, Drag & Drop, Magnetic Multi-Size Snapping, Camera Pan/Zoom, Gyroscope, and Presets
window.CW = window.CW || {};

(function () {
  const { CUBE_CATALOG, getCatalogById, UNIT_PX, CubeWorldSimulation, audio } = window.CW;
  const { CELL_PX } = window.CW.sprites;

  const SNAP_RADIUS = 54;

  class CubeWorldApp {
    constructor() {
      // DOM Elements
      this.viewport = document.getElementById('world-viewport');
      this.stage = document.getElementById('world-stage');
      this.cubesContainer = document.getElementById('cubes-container');
      this.snapPreview = document.getElementById('snap-preview');
      this.catalogList = document.getElementById('catalog-list');
      this.catalogFilters = document.getElementById('catalog-filters');
      this.dragGhost = document.getElementById('catalog-drag-ghost');
      this.statsPill = document.getElementById('world-stats-pill');
      this.feedText = document.getElementById('feed-text');

      // Inspector DOM
      this.inspector = document.getElementById('cube-inspector');
      this.inspSeries = document.getElementById('insp-series');
      this.inspName = document.getElementById('insp-name');
      this.inspSize = document.getElementById('insp-size');
      this.inspDesc = document.getElementById('insp-desc');
      this.inspOccupants = document.getElementById('insp-occupants');
      this.inspNeighbors = document.getElementById('insp-neighbors');
      this.inspState = document.getElementById('insp-state');

      // Camera state
      this.camX = -420;
      this.camY = -360;
      this.zoom = 1.0;

      // Interaction state
      this.selectedCubeUid = null;
      this.dragClusterMode = false;
      this.activeFilter = 'all';

      // Simulation instance
      this.sim = new CubeWorldSimulation((msg) => this.setFeedMessage(msg));

      this.initCatalog();
      this.initControls();
      this.initViewportInteractions();
      this.initKeyboardShortcuts();

      // Center camera nicely and load starter mixed-size showcase
      this.centerCamera();
      this.loadPreset('blockparty');

      // Start 60fps animation loop
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    setFeedMessage(msg) {
      if (this.feedText) {
        this.feedText.textContent = msg;
      }
    }

    // ================= CATALOG SIDEBAR =================
    initCatalog() {
      const allBtn = this.catalogFilters.querySelector('[data-filter="all"]');
      if (allBtn) allBtn.textContent = `All (${CUBE_CATALOG.length})`;

      this.renderCatalogList('all');

      this.catalogFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-tab');
        if (!btn) return;
        this.catalogFilters.querySelectorAll('.filter-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.renderCatalogList(this.activeFilter);
      });
    }

    renderCatalogList(filter) {
      this.catalogList.innerHTML = '';
      const items = CUBE_CATALOG.filter((item) => {
        if (filter === 'all') return true;
        return item.category === filter;
      });

      for (const item of items) {
        const card = document.createElement('div');
        card.className = 'catalog-card';
        card.dataset.id = item.id;

        const sizeStr = `${item.gridW}×${item.gridH}`;
        const isMulti = item.gridW > 1 || item.gridH > 1;

        card.innerHTML = `
          <div class="card-mini-cube size-${item.gridW}x${item.gridH}"
               style="background: linear-gradient(145deg, ${item.color} 0%, ${item.colorDark} 100%);">
            <div class="card-mini-screen">${item.icon}</div>
            <div class="card-mini-btns"><span></span><span></span><span></span></div>
          </div>
          <div class="card-info">
            <div class="card-header-line">
              <span class="card-name">${item.name}</span>
              <span class="card-badge-size ${isMulti ? 'jumbo' : ''}">${sizeStr}</span>
              <span class="card-badge-series">${item.series}</span>
            </div>
            <div class="card-role">${item.role}</div>
            <div class="card-desc">${item.desc}</div>
          </div>
        `;

        card.addEventListener('pointerdown', (e) => this.onCatalogCardPointerDown(e, item));
        this.catalogList.appendChild(card);
      }
    }

    onCatalogCardPointerDown(e, catalogItem) {
      if (e.button !== 0) return;
      e.preventDefault();
      audio.init();

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let isDragging = false;
      let candidatePos = null;

      // Prepare floating ghost
      const wPx = catalogItem.gridW * UNIT_PX * 0.72;
      const hPx = catalogItem.gridH * UNIT_PX * 0.72;
      this.dragGhost.style.width = `${wPx}px`;
      this.dragGhost.style.height = `${hPx}px`;
      this.dragGhost.innerHTML = `
        <div class="cube-unit" style="position:static; width:100%; height:100%; background: linear-gradient(145deg, ${catalogItem.color} 0%, ${catalogItem.colorDark} 100%);">
          <div class="cube-top-bezel">
            <span class="cube-bezel-label">${catalogItem.name}</span>
            <span class="cube-bezel-tag">${catalogItem.gridW}×${catalogItem.gridH}</span>
          </div>
          <div class="cube-screen-well" style="align-items:center; justify-content:center; color:#182014; font-size:24px;">
            ${catalogItem.icon}
          </div>
        </div>
      `;

      const onMove = (moveEvt) => {
        const dist = Math.hypot(moveEvt.clientX - startClientX, moveEvt.clientY - startClientY);
        if (!isDragging && dist > 6) {
          isDragging = true;
          this.dragGhost.hidden = false;
        }
        if (!isDragging) return;

        this.dragGhost.style.left = `${moveEvt.clientX}px`;
        this.dragGhost.style.top = `${moveEvt.clientY}px`;

        const rect = this.viewport.getBoundingClientRect();
        if (moveEvt.clientX >= rect.left && moveEvt.clientX <= rect.right &&
            moveEvt.clientY >= rect.top && moveEvt.clientY <= rect.bottom) {
          const worldPt = this.screenToWorld(moveEvt.clientX, moveEvt.clientY);
          const rawX = worldPt.x - (catalogItem.gridW * UNIT_PX) / 2;
          const rawY = worldPt.y - (catalogItem.gridH * UNIT_PX) / 2;

          candidatePos = this.computeSnapPosition(rawX, rawY, catalogItem.gridW, catalogItem.gridH, new Set());
          this.showSnapPreview(candidatePos.x, candidatePos.y, catalogItem.gridW, catalogItem.gridH, candidatePos.snapped);
        } else {
          this.hideSnapPreview();
          candidatePos = null;
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        this.dragGhost.hidden = true;
        this.hideSnapPreview();

        if (isDragging && candidatePos) {
          const cube = this.spawnCubeInWorld(catalogItem, candidatePos.x, candidatePos.y);
          if (candidatePos.snapped) {
            audio.playSnap();
            this.setFeedMessage(`🧲 Snapped ${cube.name} (${cube.gridW}×${cube.gridH}) onto the cube network!`);
          } else {
            audio.playButton();
            this.setFeedMessage(`Placed ${cube.name} (${cube.gridW}×${cube.gridH}) into the 2D world.`);
          }
          this.selectCube(cube.uid);
        } else if (!isDragging) {
          const spot = this.findAutoSpawnSpot(catalogItem.gridW, catalogItem.gridH);
          const cube = this.spawnCubeInWorld(catalogItem, spot.x, spot.y);
          if (spot.snapped) {
            audio.playSnap();
            this.setFeedMessage(`🧲 Spawned & snapped ${cube.name} (${cube.gridW}×${cube.gridH}) onto the network!`);
          } else {
            audio.playButton();
            this.setFeedMessage(`Spawned ${cube.name} (${cube.gridW}×${cube.gridH}) into the world.`);
          }
          this.selectCube(cube.uid);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }

    // ================= SPAWNING & DOM CREATION FOR CUBES =================
    spawnCubeInWorld(catalogItem, x, y) {
      const cube = this.sim.addCube(catalogItem, x, y);

      const el = document.createElement('div');
      el.className = 'cube-unit';
      el.dataset.uid = cube.uid;
      el.style.width = `${cube.gridW * UNIT_PX}px`;
      el.style.height = `${cube.gridH * UNIT_PX}px`;
      el.style.left = `${cube.x}px`;
      el.style.top = `${cube.y}px`;
      el.style.background = `linear-gradient(145deg, ${cube.color} 0%, ${cube.colorDark} 100%)`;

      const labelColor = cube.bezelDarkText ? 'color: #0f172a; text-shadow: none;' : '';

      el.innerHTML = `
        <div class="cube-top-bezel">
          <span class="cube-bezel-label" style="${labelColor}">${cube.name}</span>
          <span class="cube-bezel-tag">${cube.gridW}×${cube.gridH}</span>
        </div>
        <div class="cube-screen-well">
          <canvas class="cube-lcd-canvas" width="${cube.gridW * CELL_PX}" height="${cube.gridH * CELL_PX}"></canvas>
        </div>
        <div class="cube-bottom-controls">
          <button class="cube-hw-button" data-btn="left" title="Left Button (Move Left)"></button>
          <button class="cube-hw-button action-btn" data-btn="action" title="Middle Action Button (Perform Signature Trick / Toggle Mod)"></button>
          <button class="cube-hw-button" data-btn="right" title="Right Button (Move Right)"></button>
        </div>
      `;

      // Add metallic magnetic contact pins along all unit edges!
      for (let c = 0; c < cube.gridW; c++) {
        const centerPct = ((c + 0.5) / cube.gridW) * 100;
        const pinN = document.createElement('div');
        pinN.className = 'magnet-pin edge-n';
        pinN.dataset.side = 'N';
        pinN.dataset.index = c;
        pinN.style.left = `calc(${centerPct}% - 12px)`;
        el.appendChild(pinN);

        const pinS = document.createElement('div');
        pinS.className = 'magnet-pin edge-s';
        pinS.dataset.side = 'S';
        pinS.dataset.index = c;
        pinS.style.left = `calc(${centerPct}% - 12px)`;
        el.appendChild(pinS);
      }

      for (let r = 0; r < cube.gridH; r++) {
        const centerPct = ((r + 0.5) / cube.gridH) * 100;
        const pinW = document.createElement('div');
        pinW.className = 'magnet-pin edge-w';
        pinW.dataset.side = 'W';
        pinW.dataset.index = r;
        pinW.style.top = `calc(${centerPct}% - 12px)`;
        el.appendChild(pinW);

        const pinE = document.createElement('div');
        pinE.className = 'magnet-pin edge-e';
        pinE.dataset.side = 'E';
        pinE.dataset.index = r;
        pinE.style.top = `calc(${centerPct}% - 12px)`;
        el.appendChild(pinE);
      }

      const canvas = el.querySelector('.cube-lcd-canvas');
      cube.domEl = el;
      cube.canvas = canvas;
      cube.ctx = canvas.getContext('2d');
      cube.ctx.imageSmoothingEnabled = false;

      // Bind front hardware buttons on the cube
      el.querySelectorAll('.cube-hw-button').forEach((btn) => {
        btn.addEventListener('pointerdown', (evt) => {
          evt.stopPropagation();
        });
        btn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          this.onCubeHardwareButton(cube, btn.dataset.btn);
        });
      });

      // Bind dragging the cube inside the 2D world
      el.addEventListener('pointerdown', (evt) => this.onWorldCubePointerDown(evt, cube));

      // Double-click triggers a visit or trick
      el.addEventListener('dblclick', (evt) => {
        evt.stopPropagation();
        if (!this.sim.triggerVisitFromCube(cube.uid)) {
          this.sim.triggerTrickOnCube(cube.uid);
        }
      });

      this.cubesContainer.appendChild(el);
      this.sim.recomputeConnections(true);
      this.updateStatsUI();
      return cube;
    }

    onCubeHardwareButton(cube, btnType) {
      this.selectCube(cube.uid);
      if (btnType === 'action') {
        this.sim.triggerTrickOnCube(cube.uid);
      } else if (btnType === 'left') {
        this.sim.nudgeResident(cube.uid, -1);
      } else if (btnType === 'right') {
        this.sim.nudgeResident(cube.uid, 1);
      }
    }

    // ================= DRAGGING CUBES IN 2D WORLD & MAGNETIC SNAPPING =================
    onWorldCubePointerDown(e, cube) {
      if (e.button !== 0) return;
      e.stopPropagation();
      audio.init();

      this.selectCube(cube.uid);

      const startWorld = this.screenToWorld(e.clientX, e.clientY);
      const moveWholeCluster = this.dragClusterMode || e.shiftKey;
      const movingCubes = moveWholeCluster ? this.sim.getConnectedCluster(cube) : [cube];
      const movingSet = new Set(movingCubes.map((c) => c.uid));

      const initialPositions = new Map();
      for (const mc of movingCubes) {
        initialPositions.set(mc.uid, { x: mc.x, y: mc.y });
        mc.domEl.classList.add('dragging');
      }

      const hadDoorsBefore = cube.doors.length > 0;
      let movedSignificantly = false;
      let lastSnapped = false;

      const onMove = (moveEvt) => {
        const currWorld = this.screenToWorld(moveEvt.clientX, moveEvt.clientY);
        const dx = currWorld.x - startWorld.x;
        const dy = currWorld.y - startWorld.y;

        if (!movedSignificantly && Math.hypot(dx, dy) > 4) {
          movedSignificantly = true;
          if (!moveWholeCluster && hadDoorsBefore) {
            audio.playDetach();
          }
        }

        if (!movedSignificantly) return;

        const baseInit = initialPositions.get(cube.uid);
        const rawX = baseInit.x + dx;
        const rawY = baseInit.y + dy;

        if (movingCubes.length === 1) {
          const snap = this.computeSnapPosition(rawX, rawY, cube.gridW, cube.gridH, movingSet);
          cube.x = Math.round(snap.x);
          cube.y = Math.round(snap.y);
          cube.domEl.style.left = `${cube.x}px`;
          cube.domEl.style.top = `${cube.y}px`;
          lastSnapped = snap.snapped;

          if (snap.snapped) {
            this.showSnapPreview(snap.x, snap.y, cube.gridW, cube.gridH, true);
          } else {
            this.hideSnapPreview();
          }
        } else {
          let bestDeltaX = dx;
          let bestDeltaY = dy;
          let clusterSnapped = false;

          for (const mc of movingCubes) {
            const initPos = initialPositions.get(mc.uid);
            const candidate = this.computeSnapPosition(initPos.x + dx, initPos.y + dy, mc.gridW, mc.gridH, movingSet);
            if (candidate.snapped) {
              const candDx = candidate.x - initPos.x;
              const candDy = candidate.y - initPos.y;
              const allValid = movingCubes.every((c2) => {
                const p2 = initialPositions.get(c2.uid);
                return !this.overlapsAnyStationary(p2.x + candDx, p2.y + candDy, c2.gridW, c2.gridH, movingSet);
              });
              if (allValid) {
                bestDeltaX = candDx;
                bestDeltaY = candDy;
                clusterSnapped = true;
                break;
              }
            }
          }

          for (const mc of movingCubes) {
            const initPos = initialPositions.get(mc.uid);
            mc.x = Math.round(initPos.x + bestDeltaX);
            mc.y = Math.round(initPos.y + bestDeltaY);
            mc.domEl.style.left = `${mc.x}px`;
            mc.domEl.style.top = `${mc.y}px`;
          }
          lastSnapped = clusterSnapped;
          this.hideSnapPreview();
        }

        this.sim.recomputeConnections(false);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);

        for (const mc of movingCubes) {
          mc.domEl.classList.remove('dragging');
        }
        this.hideSnapPreview();

        if (movedSignificantly) {
          this.sim.recomputeConnections(true);
          if (lastSnapped || cube.doors.length > 0) {
            audio.playSnap();
            const neighborNames = [...new Set(cube.doors.map((d) => this.sim.getCubeByUid(d.targetUid)?.name).filter(Boolean))];
            this.setFeedMessage(`🧲 ${cube.name} snapped to ${neighborNames.join(', ')}! Doors opened!`);
          }
        }
        this.updateInspectorUI();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }

    // Compute best magnetic snap position for a cube of size (gridW, gridH) near (rawX, rawY)
    computeSnapPosition(rawX, rawY, gridW, gridH, ignoreUids = new Set()) {
      const stationary = this.sim.cubes.filter((c) => !ignoreUids.has(c.uid));
      let bestCandidate = null;
      let bestDist = SNAP_RADIUS;

      for (const B of stationary) {
        // 1. Left of B
        const candWestX = B.x - gridW * UNIT_PX;
        for (let rA = 0; rA < gridH; rA++) {
          for (let rB = 0; rB < B.gridH; rB++) {
            const candY = B.y + (rB - rA) * UNIT_PX;
            const d = Math.hypot(rawX - candWestX, rawY - candY);
            if (d < bestDist && !this.overlapsAnyStationary(candWestX, candY, gridW, gridH, ignoreUids)) {
              bestDist = d;
              bestCandidate = { x: candWestX, y: candY, snapped: true };
            }
          }
        }

        // 2. Right of B
        const candEastX = B.x + B.gridW * UNIT_PX;
        for (let rA = 0; rA < gridH; rA++) {
          for (let rB = 0; rB < B.gridH; rB++) {
            const candY = B.y + (rB - rA) * UNIT_PX;
            const d = Math.hypot(rawX - candEastX, rawY - candY);
            if (d < bestDist && !this.overlapsAnyStationary(candEastX, candY, gridW, gridH, ignoreUids)) {
              bestDist = d;
              bestCandidate = { x: candEastX, y: candY, snapped: true };
            }
          }
        }

        // 3. Above B
        const candNorthY = B.y - gridH * UNIT_PX;
        for (let cA = 0; cA < gridW; cA++) {
          for (let cB = 0; cB < B.gridW; cB++) {
            const candX = B.x + (cB - cA) * UNIT_PX;
            const d = Math.hypot(rawX - candX, rawY - candNorthY);
            if (d < bestDist && !this.overlapsAnyStationary(candX, candNorthY, gridW, gridH, ignoreUids)) {
              bestDist = d;
              bestCandidate = { x: candX, y: candNorthY, snapped: true };
            }
          }
        }

        // 4. Below B
        const candSouthY = B.y + B.gridH * UNIT_PX;
        for (let cA = 0; cA < gridW; cA++) {
          for (let cB = 0; cB < B.gridW; cB++) {
            const candX = B.x + (cB - cA) * UNIT_PX;
            const d = Math.hypot(rawX - candX, rawY - candSouthY);
            if (d < bestDist && !this.overlapsAnyStationary(candX, candSouthY, gridW, gridH, ignoreUids)) {
              bestDist = d;
              bestCandidate = { x: candX, y: candSouthY, snapped: true };
            }
          }
        }
      }

      if (bestCandidate) {
        return bestCandidate;
      }

      if (!this.overlapsAnyStationary(rawX, rawY, gridW, gridH, ignoreUids)) {
        return { x: rawX, y: rawY, snapped: false };
      }

      let fallback = { x: rawX, y: rawY, snapped: false };
      let fallbackDist = Infinity;
      for (const B of stationary) {
        const candidates = [
          { x: B.x - gridW * UNIT_PX, y: B.y },
          { x: B.x + B.gridW * UNIT_PX, y: B.y },
          { x: B.x, y: B.y - gridH * UNIT_PX },
          { x: B.x, y: B.y + B.gridH * UNIT_PX }
        ];
        for (const c of candidates) {
          const d = Math.hypot(rawX - c.x, rawY - c.y);
          if (d < fallbackDist && !this.overlapsAnyStationary(c.x, c.y, gridW, gridH, ignoreUids)) {
            fallbackDist = d;
            fallback = { x: c.x, y: c.y, snapped: true };
          }
        }
      }
      return fallback;
    }

    overlapsAnyStationary(x, y, gridW, gridH, ignoreUids) {
      const pad = 3;
      const left = x + pad;
      const right = x + gridW * UNIT_PX - pad;
      const top = y + pad;
      const bottom = y + gridH * UNIT_PX - pad;

      for (const B of this.sim.cubes) {
        if (ignoreUids.has(B.uid)) continue;
        const bLeft = B.x + pad;
        const bRight = B.x + B.gridW * UNIT_PX - pad;
        const bTop = B.y + pad;
        const bBottom = B.y + B.gridH * UNIT_PX - pad;

        if (left < bRight && right > bLeft && top < bBottom && bottom > bTop) {
          return true;
        }
      }
      return false;
    }

    findAutoSpawnSpot(gridW, gridH) {
      if (this.sim.cubes.length === 0) {
        return { x: 1000, y: 800, snapped: false };
      }
      for (const B of this.sim.cubes) {
        const tries = [
          { x: B.x + B.gridW * UNIT_PX, y: B.y },
          { x: B.x - gridW * UNIT_PX, y: B.y },
          { x: B.x, y: B.y - gridH * UNIT_PX },
          { x: B.x, y: B.y + B.gridH * UNIT_PX }
        ];
        for (const t of tries) {
          if (!this.overlapsAnyStationary(t.x, t.y, gridW, gridH, new Set())) {
            return { x: t.x, y: t.y, snapped: true };
          }
        }
      }
      return { x: 1000 + Math.random() * 200, y: 800 + Math.random() * 200, snapped: false };
    }

    showSnapPreview(x, y, gridW, gridH, isSnapped) {
      this.snapPreview.hidden = false;
      this.snapPreview.style.left = `${x}px`;
      this.snapPreview.style.top = `${y}px`;
      this.snapPreview.style.width = `${gridW * UNIT_PX}px`;
      this.snapPreview.style.height = `${gridH * UNIT_PX}px`;
      this.snapPreview.classList.toggle('snapped-glow', Boolean(isSnapped));
    }

    hideSnapPreview() {
      this.snapPreview.hidden = true;
    }

    // ================= HARDWARE TOOLBAR & INSPECTOR CONTROLS =================
    initControls() {
      const gyroContainer = document.getElementById('gyro-controls');
      gyroContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.hw-btn');
        if (!btn) return;
        gyroContainer.querySelectorAll('.hw-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tilt = Number(btn.dataset.tilt);
        this.sim.worldTilt = tilt;
        audio.playTilt();
        this.setFeedMessage(
          tilt === 0
            ? 'Gyroscope upright (0°) — stick figures returned to normal gravity!'
            : `📐 Gyroscope tilted to ${tilt}°! Watch the stick figures react to gravity!`
        );
      });

      document.getElementById('btn-shake').addEventListener('click', () => {
        this.sim.shakeTimer = 1.2;
        audio.playShake();
        this.setFeedMessage('⚡ Shaking the Cube World network! Stick figures are tumbling!');
      });

      const presetSelect = document.getElementById('preset-select');
      presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
          this.loadPreset(presetSelect.value);
          presetSelect.value = '';
        }
      });

      const btnDragMode = document.getElementById('btn-drag-mode');
      btnDragMode.addEventListener('click', () => {
        this.dragClusterMode = !this.dragClusterMode;
        btnDragMode.classList.toggle('active', this.dragClusterMode);
        btnDragMode.textContent = this.dragClusterMode ? '🧲 Cluster Drag' : 'Single Cube';
        this.setFeedMessage(
          this.dragClusterMode
            ? 'Cluster Drag ON: Dragging a cube moves all cubes snapped to it together!'
            : 'Single Cube Drag: Dragging a cube detaches it from its neighbors (or hold Shift for cluster).'
        );
      });

      const btnSound = document.getElementById('btn-sound');
      btnSound.addEventListener('click', () => {
        audio.enabled = !audio.enabled;
        btnSound.classList.toggle('active', audio.enabled);
        btnSound.textContent = audio.enabled ? '🔊 Piezo' : '🔇 Muted';
        if (audio.enabled) audio.playButton();
      });

      const btnTranslucent = document.getElementById('btn-translucent');
      btnTranslucent.addEventListener('click', () => {
        document.body.classList.toggle('translucent-shells');
        const isClear = document.body.classList.contains('translucent-shells');
        btnTranslucent.classList.toggle('active', isClear);
        audio.playButton();
        this.setFeedMessage(
          isClear
            ? '💎 Special Edition Translucent Shells enabled ("Clear Craze" plastic housing)!'
            : 'Standard matte plastic Cube World shells enabled.'
        );
      });

      document.getElementById('btn-clear').addEventListener('click', () => {
        this.sim.clearAll();
        this.selectCube(null);
        this.updateStatsUI();
        audio.playDetach();
        this.setFeedMessage('Cleared all cubes from the workspace. Drag cubes from the left catalog to build!');
      });

      document.getElementById('btn-CallHome').addEventListener('click', () => {
        this.sim.recallAllHome();
      });
      document.getElementById('btn-Party').addEventListener('click', () => {
        this.sim.triggerGlobalGathering();
      });

      document.getElementById('btn-zoom-in').addEventListener('click', () => this.setZoom(this.zoom + 0.12));
      document.getElementById('btn-zoom-out').addEventListener('click', () => this.setZoom(this.zoom - 0.12));
      document.getElementById('btn-zoom-reset').addEventListener('click', () => {
        this.zoom = 1.0;
        this.centerCamera();
      });

      document.getElementById('insp-close').addEventListener('click', () => this.selectCube(null));
      document.getElementById('insp-btn-trick').addEventListener('click', () => {
        if (this.selectedCubeUid) this.sim.triggerTrickOnCube(this.selectedCubeUid);
      });
      document.getElementById('insp-btn-visit').addEventListener('click', () => {
        if (this.selectedCubeUid) this.sim.triggerVisitFromCube(this.selectedCubeUid);
      });
      document.getElementById('insp-btn-game').addEventListener('click', () => {
        if (this.selectedCubeUid) this.sim.toggleMiniGame(this.selectedCubeUid);
      });
      document.getElementById('insp-btn-remove').addEventListener('click', () => {
        if (this.selectedCubeUid) {
          const uid = this.selectedCubeUid;
          this.selectCube(null);
          this.sim.removeCube(uid);
          this.updateStatsUI();
          audio.playDetach();
        }
      });
    }

    initKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        if (!this.selectedCubeUid) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.sim.nudgeResident(this.selectedCubeUid, -1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.sim.nudgeResident(this.selectedCubeUid, 1);
        } else if (e.key === ' ') {
          e.preventDefault();
          this.sim.triggerTrickOnCube(this.selectedCubeUid);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          const uid = this.selectedCubeUid;
          this.selectCube(null);
          this.sim.removeCube(uid);
          this.updateStatsUI();
          audio.playDetach();
        }
      });
    }

    // ================= VIEWPORT PANNING & ZOOMING =================
    initViewportInteractions() {
      let isPanning = false;
      let startX = 0;
      let startY = 0;
      let initCamX = 0;
      let initCamY = 0;

      this.viewport.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.cube-unit') || e.target.closest('.world-hud-bottom') || e.target.closest('.cube-inspector')) {
          return;
        }
        this.selectCube(null);
        isPanning = true;
        this.viewport.classList.add('panning');
        startX = e.clientX;
        startY = e.clientY;
        initCamX = this.camX;
        initCamY = this.camY;

        const onMove = (me) => {
          if (!isPanning) return;
          this.camX = initCamX + (me.clientX - startX);
          this.camY = initCamY + (me.clientY - startY);
          this.applyCameraTransform();
        };

        const onUp = () => {
          isPanning = false;
          this.viewport.classList.remove('panning');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });

      this.viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        this.setZoom(this.zoom + delta);
      }, { passive: false });
    }

    centerCamera() {
      const rect = this.viewport.getBoundingClientRect();
      const targetWorldX = 1150;
      const targetWorldY = 820;
      this.camX = rect.width / 2 - targetWorldX * this.zoom;
      this.camY = rect.height / 2 - targetWorldY * this.zoom;
      this.applyCameraTransform();
    }

    setZoom(newZoom) {
      const rect = this.viewport.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const worldCenterX = (centerX - this.camX) / this.zoom;
      const worldCenterY = (centerY - this.camY) / this.zoom;

      this.zoom = Math.max(0.5, Math.min(1.6, Number(newZoom.toFixed(2))));
      this.camX = centerX - worldCenterX * this.zoom;
      this.camY = centerY - worldCenterY * this.zoom;
      this.applyCameraTransform();
    }

    applyCameraTransform() {
      this.stage.style.transform = `translate(${this.camX}px, ${this.camY}px) scale(${this.zoom})`;
      const readout = document.getElementById('zoom-readout');
      if (readout) readout.textContent = `${Math.round(this.zoom * 100)}%`;
    }

    screenToWorld(clientX, clientY) {
      const rect = this.viewport.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - this.camX) / this.zoom,
        y: (sy - this.camY) / this.zoom
      };
    }

    // ================= SELECTION & INSPECTOR =================
    selectCube(uid) {
      this.selectedCubeUid = uid;
      for (const c of this.sim.cubes) {
        if (c.domEl) {
          c.domEl.classList.toggle('selected', c.uid === uid);
        }
      }
      this.updateInspectorUI();
    }

    updateInspectorUI() {
      if (!this.selectedCubeUid) {
        this.inspector.hidden = true;
        return;
      }
      const cube = this.sim.getCubeByUid(this.selectedCubeUid);
      if (!cube) {
        this.inspector.hidden = true;
        return;
      }

      this.inspector.hidden = false;
      this.inspSeries.textContent = cube.series.toUpperCase();
      this.inspName.textContent = cube.name;
      this.inspSize.textContent = `${cube.gridW}×${cube.gridH}`;
      this.inspDesc.textContent = cube.desc;

      const occ = this.sim.getOccupants(cube.uid);
      const maxCap = (cube.gridW * cube.gridH > 1) ? 6 : 4;
      this.inspOccupants.textContent = cube.isMod
        ? 'Modifier Unit'
        : `${occ.length} / ${maxCap} (${occ.map((p) => p.name).join(', ') || 'Visiting away'})`;
      this.inspNeighbors.textContent = `${cube.doors.length} open door(s)`;

      if (cube.isMod) {
        this.inspState.textContent = cube.modEnabled ? `Active (${cube.modType.toUpperCase()})` : 'Standby';
      } else if (occ.length > 0) {
        this.inspState.textContent = occ[0].state;
      } else {
        this.inspState.textContent = 'Away visiting neighbor';
      }
    }

    updateStatsUI() {
      if (this.statsPill) {
        this.statsPill.textContent = `${this.sim.cubes.length} / 16 Cubes`;
      }
    }

    // ================= PRESET WORLD LAYOUTS =================
    loadPreset(presetName) {
      this.sim.clearAll();
      this.selectCube(null);

      const bx = 920;
      const by = 680;
      const U = UNIT_PX;

      if (presetName === 'starter') {
        this.spawnCubeInWorld(getCatalogById('scoop'), bx, by);
        this.spawnCubeInWorld(getCatalogById('dodger'), bx + U, by);
        this.spawnCubeInWorld(getCatalogById('slim'), bx, by + U);
        this.spawnCubeInWorld(getCatalogById('whip'), bx + U, by + U);
        this.setFeedMessage('Loaded Preset: Series 1 Classic Quad (Scoop, Dodger, Slim & Whip)!');
      } else if (presetName === 'blockparty') {
        this.spawnCubeInWorld(getCatalogById('block_bash'), bx, by); // 2x2
        this.spawnCubeInWorld(getCatalogById('scoop'), bx - U, by); // 1x1
        this.spawnCubeInWorld(getCatalogById('dodger'), bx - U, by + U); // 1x1
        this.spawnCubeInWorld(getCatalogById('mic'), bx + 2 * U, by); // 1x1
        this.spawnCubeInWorld(getCatalogById('hans'), bx + 2 * U, by + U); // 1x1
        this.spawnCubeInWorld(getCatalogById('grinder_park'), bx, by - U); // 2x1 Wide
        this.spawnCubeInWorld(getCatalogById('sky_tower'), bx + 3 * U, by); // 1x2 Tall
        this.setFeedMessage('Loaded Block Bash Mega-Party! Watch stick figures explore 1×1, 2×1, 1×2, and 2×2 cubes!');
      } else if (presetName === 'tower') {
        this.spawnCubeInWorld(getCatalogById('sky_tower'), bx, by); // 1x2
        this.spawnCubeInWorld(getCatalogById('slim'), bx + U, by); // 1x1
        this.spawnCubeInWorld(getCatalogById('handy'), bx + U, by + U); // 1x1
        this.spawnCubeInWorld(getCatalogById('sparky'), bx + U, by - U); // 1x1
        this.spawnCubeInWorld(getCatalogById('whip'), bx, by - U); // 1x1
        this.spawnCubeInWorld(getCatalogById('grinder_park'), bx, by + 2 * U); // 2x1
        this.setFeedMessage('Loaded High-Rise Stick Tower! Stick figures climb ladders, fire poles & elevators!');
      } else if (presetName === 'modlab') {
        this.spawnCubeInWorld(getCatalogById('hiphop'), bx, by);
        this.spawnCubeInWorld(getCatalogById('mic'), bx + U, by);
        this.spawnCubeInWorld(getCatalogById('scoop'), bx + 2 * U, by);
        this.spawnCubeInWorld(getCatalogById('scifi'), bx + U, by - U);
        this.spawnCubeInWorld(getCatalogById('splash'), bx + 4 * U, by);
        this.spawnCubeInWorld(getCatalogById('hans'), bx + 5 * U, by);
        this.setFeedMessage('Loaded Mod Madness! Snap SPLASH, HIP HOP, or SCI-FI Mods onto cubes to transform them!');
      } else if (presetName === 'resort') {
        this.spawnCubeInWorld(getCatalogById('global_getaways'), bx, by); // 2x2
        this.spawnCubeInWorld(getCatalogById('splash'), bx - U, by + U); // 1x1 water mod
        this.spawnCubeInWorld(getCatalogById('whip'), bx - U, by); // 1x1
        this.spawnCubeInWorld(getCatalogById('dodger'), bx + 2 * U, by + U); // 1x1
        this.spawnCubeInWorld(getCatalogById('dusty'), bx + 2 * U, by); // 1x1
        this.setFeedMessage('Loaded Global Getaways 2×2 Vacation Resort!');
      }

      this.centerCamera();
      audio.playSnap();
    }

    // ================= MAIN LOOP =================
    loop(now) {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      this.sim.update(dt);
      this.sim.renderAll();

      if (this.selectedCubeUid && Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) {
        this.updateInspectorUI();
      }

      requestAnimationFrame((t) => this.loop(t));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.cubeWorldApp = new CubeWorldApp();
  });
})();
