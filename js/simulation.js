// Core Cube World 2D Simulation Engine
// Handles multi-size magnetic adjacency, cross-cube doors, stickman AI, dog/ball/dust entities, and Mod effects
window.CW = window.CW || {};

(function () {
  const {
    CELL_PX,
    renderCubeEnvironment,
    renderStickman,
    drawPixelDog,
    drawPixelCircle,
    drawTinyText,
    drawSparkIcon,
    drawDustCloud
  } = window.CW.sprites;
  const audio = window.CW.audio;

  const UNIT_PX = 148;

  class CubeWorldSimulation {
    constructor(onEventCallback) {
      this.cubes = []; // Array of CubeInstance
      this.people = []; // Array of StickPerson
      this.projectiles = []; // Cross-cube balls, dogs, dust clouds
      this.simTime = 0;
      this.worldTilt = 0; // -90, 0, 90, 180
      this.shakeTimer = 0;
      this.nextUid = 1;
      this.onEvent = onEventCallback || (() => {});
    }

    emitEvent(msg) {
      this.onEvent(msg);
    }

    addCube(catalogItem, x, y) {
      const uid = `cube_${this.nextUid++}`;
      const cube = {
        uid,
        id: catalogItem.id,
        name: catalogItem.name,
        series: catalogItem.series,
        category: catalogItem.category,
        gridW: catalogItem.gridW,
        gridH: catalogItem.gridH,
        color: catalogItem.color,
        colorDark: catalogItem.colorDark,
        bezelDarkText: Boolean(catalogItem.bezelDarkText),
        role: catalogItem.role,
        desc: catalogItem.desc,
        isMod: Boolean(catalogItem.isMod),
        modType: catalogItem.modType || null,
        modEnabled: true,
        x: Math.round(x),
        y: Math.round(y),
        doors: [], // [{ side: 'N'|'S'|'E'|'W', localX, localY, targetUid, targetLocalX, targetLocalY }]
        activeMods: { water: false, bass: false, zerog: false },
        flashTimer: 0.6,
        miniGame: null,
        domEl: null,
        canvas: null,
        ctx: null
      };

      this.cubes.push(cube);

      // Spawn resident stickman for non-Mod cubes
      if (!cube.isMod) {
        const resident = this.createStickPerson(cube, catalogItem);
        this.people.push(resident);

        // If this is SCOOP, also spawn his loyal pixel dog!
        if (cube.id === 'scoop') {
          this.projectiles.push({
            type: 'dog',
            ownerUid: cube.uid,
            cubeUid: cube.uid,
            floorRow: 0,
            x: 42,
            y: CELL_PX - 6,
            vx: 16,
            dir: 1
          });
        }
      }

      this.recomputeConnections(false);
      return cube;
    }

    createStickPerson(cube, catalogItem) {
      const startFloor = cube.gridH - 1;
      const startX = (cube.gridW * CELL_PX) / 2;
      const startY = (startFloor + 1) * CELL_PX - 6;

      return {
        uid: `person_${this.nextUid++}`,
        name: catalogItem.name,
        charId: catalogItem.id,
        homeCubeId: cube.uid,
        currentCubeId: cube.uid,
        floorRow: startFloor,
        x: startX,
        y: startY,
        targetX: startX,
        targetFloor: startFloor,
        dir: 1,
        state: 'IDLE',
        stateTimer: 1.5 + Math.random() * 2,
        phase: Math.random() * 10,
        pendingDoor: null
      };
    }

    removeCube(cubeUid) {
      const idx = this.cubes.findIndex((c) => c.uid === cubeUid);
      if (idx === -1) return;
      const cube = this.cubes[idx];

      // Remove resident stickman & projectiles belonging to this cube
      this.people = this.people.filter((p) => p.homeCubeId !== cubeUid);
      this.projectiles = this.projectiles.filter((pr) => pr.ownerUid !== cubeUid);

      // Any visitors currently inside this removed cube immediately return to their home cube!
      for (const p of this.people) {
        if (p.currentCubeId === cubeUid) {
          this.sendPersonHomeImmediate(p);
        }
      }
      for (const pr of this.projectiles) {
        if (pr.cubeUid === cubeUid) {
          pr.cubeUid = pr.ownerUid;
          pr.x = 32;
          pr.floorRow = 0;
        }
      }

      if (cube.domEl && cube.domEl.parentNode) {
        cube.domEl.parentNode.removeChild(cube.domEl);
      }
      this.cubes.splice(idx, 1);
      this.recomputeConnections(false);
    }

    clearAll() {
      for (const c of this.cubes) {
        if (c.domEl && c.domEl.parentNode) {
          c.domEl.parentNode.removeChild(c.domEl);
        }
      }
      this.cubes = [];
      this.people = [];
      this.projectiles = [];
    }

    sendPersonHomeImmediate(p) {
      const home = this.getCubeByUid(p.homeCubeId);
      if (!home) return;
      p.currentCubeId = home.uid;
      p.floorRow = home.gridH - 1;
      p.x = (home.gridW * CELL_PX) / 2;
      p.y = (p.floorRow + 1) * CELL_PX - 6;
      p.state = 'IDLE';
      p.pendingDoor = null;
    }

    recallAllHome() {
      let count = 0;
      for (const p of this.people) {
        if (p.currentCubeId !== p.homeCubeId) {
          this.sendPersonHomeImmediate(p);
          count++;
        }
      }
      for (const pr of this.projectiles) {
        if (pr.cubeUid !== pr.ownerUid) {
          pr.cubeUid = pr.ownerUid;
          pr.x = 32;
          pr.floorRow = 0;
        }
      }
      audio.playButton();
      this.emitEvent(
        count > 0
          ? `🏠 Recalled ${count} visiting stick figure(s) back to their home cubes!`
          : 'All stick figures are at their home cubes!'
      );
    }

    getCubeByUid(uid) {
      return this.cubes.find((c) => c.uid === uid) || null;
    }

    getOccupants(cubeUid) {
      return this.people.filter((p) => p.currentCubeId === cubeUid);
    }

    // Compute all magnetic edge connections across all cubes (supports 1x1, 2x1, 1x2, 2x2)
    recomputeConnections(triggerHandshake = true) {
      const prevDoorCounts = new Map();
      for (const c of this.cubes) {
        prevDoorCounts.set(c.uid, c.doors.length);
        c.doors = [];
        c.activeMods = { water: false, bass: false, zerog: false };
      }

      const TOL = 5; // pixel alignment tolerance for snapped edges

      for (let i = 0; i < this.cubes.length; i++) {
        const A = this.cubes[i];
        const aRight = A.x + A.gridW * UNIT_PX;
        const aBottom = A.y + A.gridH * UNIT_PX;

        for (let j = i + 1; j < this.cubes.length; j++) {
          const B = this.cubes[j];
          const bRight = B.x + B.gridW * UNIT_PX;
          const bBottom = B.y + B.gridH * UNIT_PX;

          // Check if A's East edge touches B's West edge
          if (Math.abs(aRight - B.x) <= TOL) {
            for (let rA = 0; rA < A.gridH; rA++) {
              const yA = A.y + rA * UNIT_PX;
              for (let rB = 0; rB < B.gridH; rB++) {
                const yB = B.y + rB * UNIT_PX;
                if (Math.abs(yA - yB) <= TOL) {
                  A.doors.push({ side: 'E', localX: A.gridW - 1, localY: rA, targetUid: B.uid, targetLocalX: 0, targetLocalY: rB });
                  B.doors.push({ side: 'W', localX: 0, localY: rB, targetUid: A.uid, targetLocalX: A.gridW - 1, targetLocalY: rA });
                }
              }
            }
          }

          // Check if B's East edge touches A's West edge
          if (Math.abs(bRight - A.x) <= TOL) {
            for (let rB = 0; rB < B.gridH; rB++) {
              const yB = B.y + rB * UNIT_PX;
              for (let rA = 0; rA < A.gridH; rA++) {
                const yA = A.y + rA * UNIT_PX;
                if (Math.abs(yB - yA) <= TOL) {
                  B.doors.push({ side: 'E', localX: B.gridW - 1, localY: rB, targetUid: A.uid, targetLocalX: 0, targetLocalY: rA });
                  A.doors.push({ side: 'W', localX: 0, localY: rA, targetUid: B.uid, targetLocalX: B.gridW - 1, targetLocalY: rB });
                }
              }
            }
          }

          // Check if A's South edge touches B's North edge
          if (Math.abs(aBottom - B.y) <= TOL) {
            for (let cA = 0; cA < A.gridW; cA++) {
              const xA = A.x + cA * UNIT_PX;
              for (let cB = 0; cB < B.gridW; cB++) {
                const xB = B.x + cB * UNIT_PX;
                if (Math.abs(xA - xB) <= TOL) {
                  A.doors.push({ side: 'S', localX: cA, localY: A.gridH - 1, targetUid: B.uid, targetLocalX: cB, targetLocalY: 0 });
                  B.doors.push({ side: 'N', localX: cB, localY: 0, targetUid: A.uid, targetLocalX: cA, targetLocalY: A.gridH - 1 });
                }
              }
            }
          }

          // Check if B's South edge touches A's North edge
          if (Math.abs(bBottom - A.y) <= TOL) {
            for (let cB = 0; cB < B.gridW; cB++) {
              const xB = B.x + cB * UNIT_PX;
              for (let cA = 0; cA < A.gridW; cA++) {
                const xA = A.x + cA * UNIT_PX;
                if (Math.abs(xB - xA) <= TOL) {
                  B.doors.push({ side: 'S', localX: cB, localY: B.gridH - 1, targetUid: A.uid, targetLocalX: cA, targetLocalY: 0 });
                  A.doors.push({ side: 'N', localX: cA, localY: 0, targetUid: B.uid, targetLocalX: cB, targetLocalY: B.gridH - 1 });
                }
              }
            }
          }
        }
      }

      // Propagate active Mod Cube effects across connected components!
      for (const modCube of this.cubes) {
        if (modCube.isMod && modCube.modEnabled && modCube.doors.length > 0) {
          const visited = new Set([modCube.uid]);
          const queue = [modCube];
          while (queue.length > 0) {
            const curr = queue.shift();
            if (modCube.modType === 'water') curr.activeMods.water = true;
            if (modCube.modType === 'bass') curr.activeMods.bass = true;
            if (modCube.modType === 'zerog') curr.activeMods.zerog = true;

            for (const d of curr.doors) {
              if (!visited.has(d.targetUid)) {
                visited.add(d.targetUid);
                const nextCube = this.getCubeByUid(d.targetUid);
                if (nextCube) queue.push(nextCube);
              }
            }
          }
        }
      }

      // Update magnetic contact pin highlights on DOM elements & flash newly connected cubes
      for (const c of this.cubes) {
        this.updateMagnetPinsDOM(c);
        const oldCount = prevDoorCounts.get(c.uid) || 0;
        if (triggerHandshake && c.doors.length > oldCount) {
          c.flashTimer = 0.7;
          if (c.domEl) {
            c.domEl.classList.remove('snap-flash');
            void c.domEl.offsetWidth;
            c.domEl.classList.add('snap-flash');
          }
        }
      }
    }

    updateMagnetPinsDOM(cube) {
      if (!cube.domEl) return;
      const pins = cube.domEl.querySelectorAll('.magnet-pin');
      pins.forEach((pin) => {
        const side = pin.dataset.side;
        const idx = Number(pin.dataset.index);
        const isConnected = cube.doors.some((d) => {
          if (d.side !== side) return false;
          return (side === 'N' || side === 'S') ? d.localX === idx : d.localY === idx;
        });
        pin.classList.toggle('connected', isConnected);
      });
    }

    // Return all cubes in the same connected cluster as rootCube
    getConnectedCluster(rootCube) {
      const visited = new Set([rootCube.uid]);
      const queue = [rootCube];
      const result = [rootCube];
      while (queue.length > 0) {
        const curr = queue.shift();
        for (const d of curr.doors) {
          if (!visited.has(d.targetUid)) {
            visited.add(d.targetUid);
            const next = this.getCubeByUid(d.targetUid);
            if (next) {
              result.push(next);
              queue.push(next);
            }
          }
        }
      }
      return result;
    }

    // Trigger a specific cube's resident or occupant to perform a signature trick!
    triggerTrickOnCube(cubeUid) {
      const cube = this.getCubeByUid(cubeUid);
      if (!cube) return;

      if (cube.isMod) {
        cube.modEnabled = !cube.modEnabled;
        this.recomputeConnections(false);
        audio.playTrick(cube.id);
        this.emitEvent(`${cube.name}: ${cube.modEnabled ? 'Activated' : 'Paused'} ${cube.role} effect!`);
        return;
      }

      const occupants = this.getOccupants(cubeUid);
      const targetPerson = occupants[0] || this.people.find((p) => p.homeCubeId === cubeUid);
      if (!targetPerson) return;

      targetPerson.state = 'TRICK';
      targetPerson.stateTimer = 3.2;
      audio.playTrick(cube.id);

      // Special cross-cube interactions on trick!
      if (targetPerson.charId === 'dodger') {
        this.spawnCrossCubeBall(targetPerson);
      } else if (targetPerson.charId === 'whip') {
        this.tryLassoNeighbor(targetPerson, cube);
      } else if (targetPerson.charId === 'slim') {
        this.tryCeilingPoke(targetPerson, cube);
      } else if (targetPerson.charId === 'dusty') {
        this.spawnDustSweep(targetPerson, cube);
      } else {
        this.emitEvent(`${targetPerson.name} is performing their signature ${cube.role} trick!`);
      }
    }

    tryCeilingPoke(slimPerson, cube) {
      const nDoor = cube.doors.find((d) => d.side === 'N');
      if (nDoor) {
        const upstairs = this.getCubeByUid(nDoor.targetUid);
        if (upstairs) {
          slimPerson.x = nDoor.localX * CELL_PX + 32;
          slimPerson.state = 'POKE_CEILING';
          slimPerson.stateTimer = 2.6;
          const upOcc = this.getOccupants(upstairs.uid);
          if (upOcc.length > 0) {
            upOcc[0].state = 'TILTED';
            upOcc[0].stateTimer = 1.8;
            this.emitEvent(`🦯 SLIM poked his stick through the ceiling to tickle ${upOcc[0].name} in ${upstairs.name}!`);
            return;
          }
        }
      }
      this.emitEvent(`🦯 SLIM spun his bo-staff 360°!`);
    }

    spawnDustSweep(dustyPerson, cube) {
      const horizDoor = cube.doors.find((d) => d.side === 'E' || d.side === 'W');
      const dir = horizDoor ? (horizDoor.side === 'E' ? 1 : -1) : dustyPerson.dir;
      dustyPerson.dir = dir;

      this.projectiles.push({
        type: 'dust',
        ownerUid: dustyPerson.homeCubeId,
        cubeUid: cube.uid,
        floorRow: dustyPerson.floorRow,
        x: dustyPerson.x + dir * 8,
        y: dustyPerson.y,
        vx: dir * 32,
        life: 3.5
      });
      this.emitEvent(`🧹 DUSTY swept a dust bunny toward his neighbor's cube!`);
    }

    spawnCrossCubeBall(person) {
      const cube = this.getCubeByUid(person.currentCubeId);
      if (!cube) return;
      const horizDoor = cube.doors.find((d) => d.side === 'E' || d.side === 'W');
      const dir = horizDoor ? (horizDoor.side === 'E' ? 1 : -1) : person.dir;
      person.dir = dir;

      this.projectiles.push({
        type: 'ball',
        ownerUid: person.homeCubeId,
        cubeUid: cube.uid,
        floorRow: person.floorRow,
        x: person.x + dir * 6,
        y: person.y - 6,
        vx: dir * 62,
        vy: -38,
        bounces: 0,
        maxBounces: 9
      });
      this.emitEvent(`⚽ ${person.name} kicked a ball across the cube network!`);
    }

    tryLassoNeighbor(whipPerson, cube) {
      for (const door of cube.doors) {
        if (door.side === 'E' || door.side === 'W') {
          const neighbor = this.getCubeByUid(door.targetUid);
          if (!neighbor) continue;
          const occ = this.getOccupants(neighbor.uid);
          if (occ.length > 0 && this.getOccupants(cube.uid).length < 4) {
            const friend = occ[0];
            friend.currentCubeId = cube.uid;
            friend.floorRow = door.localY;
            friend.x = door.side === 'E' ? cube.gridW * CELL_PX - 14 : 14;
            friend.y = (door.localY + 1) * CELL_PX - 6;
            friend.state = 'SOCIAL_HIGHFIVE';
            friend.stateTimer = 3.0;
            whipPerson.state = 'SOCIAL_HIGHFIVE';
            whipPerson.stateTimer = 3.0;
            audio.playDoorCross();
            this.emitEvent(`➰ WHIP lassoed ${friend.name} right through the doorway into ${cube.name}!`);
            return;
          }
        }
      }
      this.emitEvent(`➰ WHIP twirled a giant overhead lasso!`);
    }

    // Command a stickman in cubeUid to walk/climb into a connected neighbor cube!
    triggerVisitFromCube(cubeUid) {
      const cube = this.getCubeByUid(cubeUid);
      if (!cube) return false;
      if (cube.doors.length === 0) {
        this.emitEvent(`${cube.name} isn't snapped to any neighbors yet — drag another cube against its magnets!`);
        return false;
      }

      // If it's Sci-Fi Mod, warp a random stickman across the network!
      if (cube.id === 'scifi') {
        const cluster = this.getConnectedCluster(cube).filter((c) => !c.isMod);
        if (cluster.length >= 2) {
          const dest = cluster[Math.floor(Math.random() * cluster.length)];
          const person = this.people.find((p) => cluster.some((c) => c.uid === p.currentCubeId));
          if (person && dest.uid !== person.currentCubeId) {
            person.currentCubeId = dest.uid;
            person.floorRow = dest.gridH - 1;
            person.x = (dest.gridW * CELL_PX) / 2;
            person.y = (person.floorRow + 1) * CELL_PX - 6;
            person.state = 'TRICK';
            person.stateTimer = 2.5;
            dest.flashTimer = 0.5;
            audio.playTrick('scifi');
            this.emitEvent(`🛸 SCI-FI MOD beamed ${person.name} directly into ${dest.name}!`);
            return true;
          }
        }
      }

      const occupants = this.getOccupants(cubeUid);
      if (occupants.length === 0) {
        const owner = this.people.find((p) => p.homeCubeId === cubeUid);
        if (owner) {
          this.sendPersonHomeImmediate(owner);
          this.emitEvent(`${owner.name} returned home to ${cube.name}!`);
          return true;
        }
        return false;
      }

      const person = occupants[Math.floor(Math.random() * occupants.length)];
      return this.startDoorTransition(person, cube);
    }

    triggerGlobalGathering() {
      let moved = 0;
      for (const c of this.cubes) {
        if (c.doors.length > 0 && !c.isMod) {
          const occ = this.getOccupants(c.uid);
          if (occ.length > 0 && Math.random() < 0.75) {
            if (this.startDoorTransition(occ[0], c)) moved++;
          }
        }
      }
      if (moved > 0) {
        audio.playDoorCross();
        this.emitEvent(`🎉 Stick figures are heading through doorways to visit their neighbors!`);
      } else {
        this.emitEvent(`Snap two or more cubes together so stick figures can visit each other!`);
      }
    }

    startDoorTransition(person, cube) {
      if (!cube || cube.doors.length === 0) return false;

      const validDoors = cube.doors.filter((d) => {
        const target = this.getCubeByUid(d.targetUid);
        if (!target || target.isMod) return false;
        const maxCap = (target.gridW * target.gridH > 1) ? 6 : 4;
        return this.getOccupants(target.uid).length < maxCap;
      });

      if (validDoors.length === 0) return false;

      const sameFloorDoors = validDoors.filter((d) => d.localY === person.floorRow);
      const chosenDoor = (sameFloorDoors.length > 0)
        ? sameFloorDoors[Math.floor(Math.random() * sameFloorDoors.length)]
        : validDoors[Math.floor(Math.random() * validDoors.length)];

      person.pendingDoor = chosenDoor;
      person.state = 'VISITING';
      person.stateTimer = 6.0;
      return true;
    }

    toggleMiniGame(cubeUid) {
      const cube = this.getCubeByUid(cubeUid);
      if (!cube || cube.isMod) return;
      if (cube.miniGame && cube.miniGame.active) {
        cube.miniGame = null;
        this.emitEvent(`Exited mini-game on ${cube.name}.`);
      } else {
        cube.miniGame = {
          active: true,
          ballX: (cube.gridW * CELL_PX) / 2,
          ballY: 10,
          vx: 26,
          vy: 30,
          score: 0
        };
        audio.playButton();
        this.emitEvent(`🎮 Started Bounce-Catch Mini-Game in ${cube.name}! Use cube L/R buttons or Left/Right Arrow keys!`);
      }
    }

    nudgeResident(cubeUid, dir) {
      const cube = this.getCubeByUid(cubeUid);
      if (!cube) return;
      const occ = this.getOccupants(cubeUid);
      if (occ.length === 0) return;
      const p = occ[0];
      const W = cube.gridW * CELL_PX;
      p.dir = dir;
      p.x = Math.max(8, Math.min(W - 8, p.x + dir * 10));
      p.targetX = p.x;
      audio.playButton();
    }

    // Main 60fps simulation tick
    update(dt) {
      this.simTime += dt;
      if (this.shakeTimer > 0) {
        this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      }

      for (const c of this.cubes) {
        if (c.flashTimer > 0) {
          c.flashTimer = Math.max(0, c.flashTimer - dt);
        }
        if (c.miniGame && c.miniGame.active) {
          this.updateCubeMiniGame(c, dt);
        }
      }

      for (const p of this.people) {
        this.updatePerson(p, dt);
      }

      this.updateProjectiles(dt);
    }

    updateCubeMiniGame(cube, dt) {
      const mg = cube.miniGame;
      const W = cube.gridW * CELL_PX;
      const fy = (cube.gridH) * CELL_PX - 6;

      mg.ballX += mg.vx * dt;
      mg.ballY += mg.vy * dt;

      if (mg.ballX < 6) {
        mg.ballX = 6;
        mg.vx = Math.abs(mg.vx);
      } else if (mg.ballX > W - 6) {
        mg.ballX = W - 6;
        mg.vx = -Math.abs(mg.vx);
      }

      if (mg.ballY < 8) {
        mg.ballY = 8;
        mg.vy = Math.abs(mg.vy);
      }

      const occ = this.getOccupants(cube.uid);
      const player = occ[0];

      if (mg.ballY >= fy - 18) {
        if (player && Math.abs(player.x - mg.ballX) <= 13) {
          mg.ballY = fy - 19;
          mg.vy = -Math.abs(mg.vy) * 1.03;
          mg.vx += (mg.ballX - player.x) * 2.5;
          mg.score++;
          player.state = 'TRICK';
          player.stateTimer = 0.45;
          audio.playButton();
        } else if (mg.ballY >= fy - 2) {
          mg.ballY = 10;
          mg.vy = 28;
          mg.score = 0;
          audio.playDetach();
        }
      }
    }

    updatePerson(p, dt) {
      const cube = this.getCubeByUid(p.currentCubeId);
      if (!cube) return;

      const W = cube.gridW * CELL_PX;
      const H = cube.gridH * CELL_PX;
      const floorY = (p.floorRow + 1) * CELL_PX - 6;

      // Handle Gyroscope Tilt / Shake reactions!
      if (this.worldTilt !== 0 || this.shakeTimer > 0) {
        p.state = 'TILTED';
        if (this.worldTilt === -90) {
          p.x = Math.max(8, p.x - 38 * dt);
          p.dir = -1;
        } else if (this.worldTilt === 90) {
          p.x = Math.min(W - 8, p.x + 38 * dt);
          p.dir = 1;
        } else if (this.shakeTimer > 0) {
          p.x = Math.max(8, Math.min(W - 8, p.x + Math.sin(this.simTime * 40 + p.phase) * 90 * dt));
        }
        p.y = floorY;
        return;
      } else if (p.state === 'TILTED' && p.stateTimer <= 0) {
        p.state = 'IDLE';
        p.stateTimer = 1.0;
      }

      // Handle active cross-cube door transition (`VISITING`)
      if (p.state === 'VISITING' && p.pendingDoor) {
        const door = p.pendingDoor;
        const targetCube = this.getCubeByUid(door.targetUid);
        if (!targetCube) {
          p.pendingDoor = null;
          p.state = 'IDLE';
          return;
        }

        // First: if person is on a different floor inside a multi-story cube (e.g. 1x2 or 2x2), climb internal ladder to door.localY!
        if (p.floorRow !== door.localY) {
          const ladderX = cube.id === 'sky_tower' ? 14 : 60;
          if (Math.abs(p.x - ladderX) > 2) {
            p.dir = ladderX > p.x ? 1 : -1;
            p.x += p.dir * 26 * dt;
            p.state = 'VISITING';
            return;
          } else {
            const desiredY = (door.localY + 1) * CELL_PX - 6;
            p.state = 'CLIMBING';
            const climbDir = desiredY > p.y ? 1 : -1;
            p.y += climbDir * 28 * dt;
            if (Math.abs(p.y - desiredY) <= 2) {
              p.floorRow = door.localY;
              p.y = desiredY;
            }
            p.state = 'VISITING';
            return;
          }
        }

        // Now on the same floor as the doorway!
        if (door.side === 'W' || door.side === 'E') {
          const exitX = door.side === 'W' ? 3 : W - 3;
          p.dir = exitX > p.x ? 1 : -1;
          p.x += p.dir * 28 * dt;
          p.y = floorY;

          if (Math.abs(p.x - exitX) <= 2.5) {
            p.currentCubeId = targetCube.uid;
            p.floorRow = door.targetLocalY;
            p.x = door.side === 'W' ? (targetCube.gridW * CELL_PX - 6) : 6;
            p.y = (p.floorRow + 1) * CELL_PX - 6;
            p.dir = door.side === 'W' ? -1 : 1;
            p.pendingDoor = null;
            p.state = 'WALKING';
            p.targetX = Math.max(14, Math.min(targetCube.gridW * CELL_PX - 14, (door.targetLocalX + 0.5) * CELL_PX));
            p.stateTimer = 2.5;
            audio.playDoorCross();
            this.emitEvent(`🚶 ${p.name} walked into ${targetCube.name}'s cube!`);
          }
          return;
        }

        if (door.side === 'N' || door.side === 'S') {
          const hatchX = door.localX * CELL_PX + 32;
          if (Math.abs(p.x - hatchX) > 2.5) {
            p.dir = hatchX > p.x ? 1 : -1;
            p.x += p.dir * 26 * dt;
            p.y = floorY;
            return;
          } else {
            p.x = hatchX;
            const exitY = door.side === 'N' ? 2 : H - 1;
            const climbDir = exitY > p.y ? 1 : -1;
            p.y += climbDir * 26 * dt;
            if (Math.abs(p.y - exitY) <= 2.5) {
              p.currentCubeId = targetCube.uid;
              p.floorRow = door.targetLocalY;
              p.x = door.targetLocalX * CELL_PX + 32;
              p.y = (p.floorRow + 1) * CELL_PX - 6;
              p.pendingDoor = null;
              p.state = 'IDLE';
              p.stateTimer = 2.0;
              audio.playDoorCross();
              this.emitEvent(`🪜 ${p.name} climbed ${door.side === 'N' ? 'up' : 'down'} into ${targetCube.name}'s cube!`);
            }
            return;
          }
        }
      }

      // Normal walking toward targetX
      if (p.state === 'WALKING') {
        p.y = floorY;
        const dx = p.targetX - p.x;
        if (Math.abs(dx) <= 2) {
          p.x = p.targetX;
          p.state = 'IDLE';
          p.stateTimer = 1.2 + Math.random() * 1.8;
        } else {
          p.dir = dx > 0 ? 1 : -1;
          p.x += p.dir * 22 * dt;
        }
      }

      // Countdown stateTimer and pick next autonomous behavior!
      p.stateTimer -= dt;
      if (p.stateTimer <= 0) {
        this.chooseNextBehavior(p, cube);
      }
    }

    chooseNextBehavior(p, cube) {
      const W = cube.gridW * CELL_PX;
      const sameFloorPeers = this.people.filter(
        (other) => other.uid !== p.uid && other.currentCubeId === cube.uid && other.floorRow === p.floorRow
      );

      // 1. If sharing a floor with another stickman, high chance of Social Interaction!
      if (sameFloorPeers.length > 0 && Math.random() < 0.65) {
        const peer = sameFloorPeers[0];
        p.dir = peer.x >= p.x ? 1 : -1;
        peer.dir = -p.dir;

        const mid = Math.max(16, Math.min(W - 16, (p.x + peer.x) / 2));
        p.x = mid - p.dir * 8;
        peer.x = mid + p.dir * 8;

        const socialModes = ['SOCIAL_HIGHFIVE', 'SOCIAL_DANCE', 'SOCIAL_CHAT', 'TRICK'];
        const mode = (cube.id === 'mic' || cube.id === 'block_bash' || cube.activeMods.bass)
          ? 'SOCIAL_DANCE'
          : socialModes[Math.floor(Math.random() * socialModes.length)];

        p.state = mode;
        peer.state = mode;
        p.stateTimer = 2.6 + Math.random() * 1.5;
        peer.stateTimer = p.stateTimer;

        if (Math.random() < 0.35) {
          const actionDesc = mode === 'SOCIAL_HIGHFIVE'
            ? 'high-fiving'
            : mode === 'SOCIAL_DANCE'
            ? 'jamming & dancing together'
            : 'hanging out together';
          this.emitEvent(`🤝 ${p.name} and ${peer.name} are ${actionDesc} in ${cube.name}!`);
        }
        return;
      }

      // 2. If connected to other cubes, chance to autonomously walk/climb into a neighbor cube!
      if (cube.doors.length > 0 && Math.random() < 0.32) {
        if (this.startDoorTransition(p, cube)) {
          return;
        }
      }

      // 3. If visiting another cube for a while and wants to head back toward home cube
      if (p.currentCubeId !== p.homeCubeId && Math.random() < 0.25) {
        const doorBack = cube.doors.find((d) => d.targetUid === p.homeCubeId) || cube.doors[0];
        if (doorBack) {
          p.pendingDoor = doorBack;
          p.state = 'VISITING';
          p.stateTimer = 5.0;
          return;
        }
      }

      // 4. Multi-story internal exploration (for 1x2 and 2x2 cubes)
      if (cube.gridH > 1 && Math.random() < 0.28) {
        const nextFloor = p.floorRow === 0 ? 1 : 0;
        p.floorRow = nextFloor;
        p.y = (nextFloor + 1) * CELL_PX - 6;
        p.state = 'TRICK';
        p.stateTimer = 2.2;
        return;
      }

      // 5. Perform signature character trick or stroll across room
      const roll = Math.random();
      if (roll < 0.45) {
        p.state = 'TRICK';
        p.stateTimer = 2.4 + Math.random() * 2.0;
        if (p.charId === 'dodger' && cube.doors.some((d) => d.side === 'E' || d.side === 'W') && Math.random() < 0.35) {
          this.spawnCrossCubeBall(p);
        } else if (p.charId === 'slim' && cube.doors.some((d) => d.side === 'N') && Math.random() < 0.35) {
          this.tryCeilingPoke(p, cube);
        } else if (p.charId === 'dusty' && cube.doors.some((d) => d.side === 'E' || d.side === 'W') && Math.random() < 0.35) {
          this.spawnDustSweep(p, cube);
        }
      } else if (roll < 0.85) {
        p.state = 'WALKING';
        p.targetX = 12 + Math.random() * (W - 24);
        p.stateTimer = 3.0;
      } else {
        p.state = 'IDLE';
        p.stateTimer = 1.5 + Math.random() * 1.5;
      }
    }

    updateProjectiles(dt) {
      const remaining = [];

      for (const pr of this.projectiles) {
        const cube = this.getCubeByUid(pr.cubeUid);
        if (!cube) continue;
        const W = cube.gridW * CELL_PX;
        const fy = (pr.floorRow + 1) * CELL_PX - 6;

        if (pr.type === 'dog') {
          pr.x += pr.vx * dt;
          pr.y = fy;
          pr.dir = pr.vx >= 0 ? 1 : -1;

          if (pr.x <= 4) {
            const wDoor = cube.doors.find((d) => d.side === 'W' && d.localY === pr.floorRow);
            const target = wDoor ? this.getCubeByUid(wDoor.targetUid) : null;
            if (target && !target.isMod && Math.random() < 0.65) {
              pr.cubeUid = target.uid;
              pr.floorRow = wDoor.targetLocalY;
              pr.x = target.gridW * CELL_PX - 6;
              this.emitEvent(`🐕 Scoop's dog trotted into ${target.name}'s cube!`);
            } else {
              pr.x = 5;
              pr.vx = Math.abs(pr.vx);
            }
          } else if (pr.x >= W - 4) {
            const eDoor = cube.doors.find((d) => d.side === 'E' && d.localY === pr.floorRow);
            const target = eDoor ? this.getCubeByUid(eDoor.targetUid) : null;
            if (target && !target.isMod && Math.random() < 0.65) {
              pr.cubeUid = target.uid;
              pr.floorRow = eDoor.targetLocalY;
              pr.x = 6;
              this.emitEvent(`🐕 Scoop's dog trotted into ${target.name}'s cube!`);
            } else {
              pr.x = W - 5;
              pr.vx = -Math.abs(pr.vx);
            }
          }

          remaining.push(pr);
        } else if (pr.type === 'dust') {
          pr.x += pr.vx * dt;
          pr.y = fy;
          pr.life -= dt;

          if (pr.x <= 3) {
            const wDoor = cube.doors.find((d) => d.side === 'W' && d.localY === pr.floorRow);
            const target = wDoor ? this.getCubeByUid(wDoor.targetUid) : null;
            if (target) {
              pr.cubeUid = target.uid;
              pr.floorRow = wDoor.targetLocalY;
              pr.x = target.gridW * CELL_PX - 5;
              const occ = this.getOccupants(target.uid);
              if (occ.length > 0) {
                occ[0].state = 'TILTED';
                occ[0].stateTimer = 1.4;
              }
            } else {
              pr.life = 0;
            }
          } else if (pr.x >= W - 3) {
            const eDoor = cube.doors.find((d) => d.side === 'E' && d.localY === pr.floorRow);
            const target = eDoor ? this.getCubeByUid(eDoor.targetUid) : null;
            if (target) {
              pr.cubeUid = target.uid;
              pr.floorRow = eDoor.targetLocalY;
              pr.x = 5;
              const occ = this.getOccupants(target.uid);
              if (occ.length > 0) {
                occ[0].state = 'TILTED';
                occ[0].stateTimer = 1.4;
              }
            } else {
              pr.life = 0;
            }
          }

          if (pr.life > 0) remaining.push(pr);
        } else if (pr.type === 'ball') {
          pr.x += pr.vx * dt;
          pr.y += pr.vy * dt;
          pr.vy += 95 * dt;

          if (pr.y >= fy - 2) {
            pr.y = fy - 2;
            pr.vy = -Math.abs(pr.vy) * 0.78;
            pr.bounces++;
          }

          if (pr.x <= 3) {
            const wDoor = cube.doors.find((d) => d.side === 'W' && d.localY === pr.floorRow);
            const target = wDoor ? this.getCubeByUid(wDoor.targetUid) : null;
            if (target) {
              pr.cubeUid = target.uid;
              pr.floorRow = wDoor.targetLocalY;
              pr.x = target.gridW * CELL_PX - 5;
              pr.y = (pr.floorRow + 1) * CELL_PX - 14;
            } else {
              pr.x = 4;
              pr.vx = Math.abs(pr.vx);
            }
          } else if (pr.x >= W - 3) {
            const eDoor = cube.doors.find((d) => d.side === 'E' && d.localY === pr.floorRow);
            const target = eDoor ? this.getCubeByUid(eDoor.targetUid) : null;
            if (target) {
              pr.cubeUid = target.uid;
              pr.floorRow = eDoor.targetLocalY;
              pr.x = 5;
              pr.y = (pr.floorRow + 1) * CELL_PX - 14;
            } else {
              pr.x = W - 4;
              pr.vx = -Math.abs(pr.vx);
            }
          }

          const occ = this.getOccupants(pr.cubeUid);
          for (const person of occ) {
            if (person.floorRow === pr.floorRow && Math.abs(person.x - pr.x) < 8 && Math.abs(person.y - pr.y) < 14) {
              pr.vx = -pr.vx;
              pr.vy = -42;
              pr.x += (pr.vx > 0 ? 6 : -6);
              person.state = 'TRICK';
              person.stateTimer = 0.8;
              break;
            }
          }

          if (pr.bounces < pr.maxBounces) {
            remaining.push(pr);
          }
        }
      }

      this.projectiles = remaining;
    }

    // Render all Cube LCD canvases
    renderAll() {
      for (const cube of this.cubes) {
        if (!cube.ctx) continue;
        const ctx = cube.ctx;

        // 1. Draw room interior, furniture, active mod effects, and open doorways
        renderCubeEnvironment(ctx, cube, this.simTime);

        // 2. Draw all stick figures currently inside this cube
        const occupants = this.getOccupants(cube.uid);
        for (const person of occupants) {
          const drawState = (person.state === 'VISITING' && person.pendingDoor && (person.pendingDoor.side === 'N' || person.pendingDoor.side === 'S') && Math.abs(person.x - (person.pendingDoor.localX * CELL_PX + 32)) <= 3)
            ? 'CLIMBING'
            : person.state;
          const prevState = person.state;
          person.state = drawState;
          renderStickman(ctx, person, cube, this.simTime, this.worldTilt);
          person.state = prevState;
        }

        // 3. Draw cross-cube projectiles (Scoop's dog, Dodger's ball, Dusty's dust) inside this cube
        for (const pr of this.projectiles) {
          if (pr.cubeUid === cube.uid) {
            if (pr.type === 'dog') {
              drawPixelDog(ctx, pr.x, pr.y, pr.dir, this.simTime, Math.floor(this.simTime * 2) % 3 === 0);
            } else if (pr.type === 'ball') {
              drawPixelCircle(ctx, pr.x, pr.y, 2, true);
            } else if (pr.type === 'dust') {
              drawDustCloud(ctx, pr.x, pr.y, this.simTime);
            }
          }
        }

        // 4. Draw Mini-Game ball & score if active
        if (cube.miniGame && cube.miniGame.active) {
          drawPixelCircle(ctx, cube.miniGame.ballX, cube.miniGame.ballY, 3, true);
          drawTinyText(ctx, `PTS ${cube.miniGame.score}`, 6, 6);
        }

        // 5. Connection Handshake spark animation when newly snapped
        if (cube.flashTimer > 0) {
          drawSparkIcon(ctx, (cube.gridW * CELL_PX) / 2 - 2, 10);
        }
      }
    }
  }

  window.CW.UNIT_PX = UNIT_PX;
  window.CW.CubeWorldSimulation = CubeWorldSimulation;
})();
