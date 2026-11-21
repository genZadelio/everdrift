(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const random = (min = 0, max = 1) => min + Math.random() * (max - min);
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const TAU = Math.PI * 2;

  const canvas = $("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const shell = $("#gameShell");
  const hud = $("#hud");
  const startScreen = $("#startScreen");
  const pauseScreen = $("#pauseScreen");
  const gameOverScreen = $("#gameOverScreen");
  const controlsDialog = $("#controlsDialog");
  const pauseButton = $("#pauseButton");
  const phaseButton = $("#phaseButton");
  const soundButton = $("#soundButton");
  const helpButton = $("#helpButton");
  const installButton = $("#installButton");
  const controlHint = $("#controlHint");
  const toast = $("#toast");
  const toastText = $("#toastText");
  const milestone = $("#milestone");
  const milestoneValue = $("#milestoneValue");

  const ui = {
    distance: $("#distanceValue"),
    score: $("#scoreValue"),
    multiplier: $("#multiplierValue"),
    integrityText: $("#integrityText"),
    integrityBar: $("#integrityBar"),
    chargeText: $("#chargeText"),
    chargeBar: $("#chargeBar"),
    best: $("#bestValue"),
    startBest: $("#startBest"),
    biome: $("#biomeName"),
    fieldStatus: $("#fieldStatus"),
    finalDistance: $("#finalDistance"),
    finalScore: $("#finalScore"),
    finalBiome: $("#finalBiome"),
    newBest: $("#newBest")
  };

  const BIOMES = [
    {
      name: "THE INDIGO EXPANSE",
      top: "#090b20",
      bottom: "#030510",
      accent: "#7df9ff",
      accent2: "#8f78ff",
      hazard: "#ff6f91"
    },
    {
      name: "EMBER DRIFT",
      top: "#1b0910",
      bottom: "#08040b",
      accent: "#ffb36b",
      accent2: "#ff668c",
      hazard: "#ff5e73"
    },
    {
      name: "AURORA REACH",
      top: "#03191c",
      bottom: "#020b13",
      accent: "#65ffd5",
      accent2: "#7df9ff",
      hazard: "#f274ff"
    },
    {
      name: "THE VIOLET VOID",
      top: "#160b2d",
      bottom: "#070313",
      accent: "#b58cff",
      accent2: "#ff79c9",
      hazard: "#ff617d"
    },
    {
      name: "GOLDEN CURRENT",
      top: "#211607",
      bottom: "#0c0803",
      accent: "#ffe47b",
      accent2: "#ff9e62",
      hazard: "#ff5f87"
    },
    {
      name: "THE PALE BETWEEN",
      top: "#121728",
      bottom: "#050711",
      accent: "#e9f5ff",
      accent2: "#8da7ff",
      hazard: "#ff7c9f"
    }
  ];

  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // The game still works when storage is unavailable.
      }
    }
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const state = {
    phase: "menu",
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: 1,
    distance: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    integrity: 100,
    charge: 100,
    speed: 180,
    spawnDistance: 0,
    spawnRow: 0,
    biomeIndex: 0,
    deepestBiome: 0,
    nextMilestone: 500,
    elapsed: 0,
    lastTime: performance.now(),
    hudClock: 0,
    shake: 0,
    menuTime: 0,
    player: {
      x: 0.5,
      y: 0.72,
      vx: 0,
      vy: 0,
      r: 12,
      phaseTime: 0,
      cooldown: 0,
      invulnerable: 0,
      trailClock: 0,
      targetX: 0.5,
      targetY: 0.72
    },
    objects: [],
    particles: [],
    stars: [],
    nebulae: [],
    keys: new Set(),
    pointer: {
      active: false,
      down: false,
      x: 0.5,
      y: 0.72
    },
    best: Number(storage.get("everdrift-best", "0")) || 0,
    muted: storage.get("everdrift-muted", "false") === "true",
    soundReady: false
  };

  let toastTimer;
  let installPrompt;
  let audioContext;
  let masterGain;
  let lastPointerType = "mouse";

  function resizeCanvas() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    createBackdrop();
  }

  function createBackdrop() {
    const starCount = clamp(Math.floor((state.width * state.height) / 8500), 80, 240);
    state.stars = Array.from({ length: starCount }, () => ({
      x: random(0, state.width),
      y: random(0, state.height),
      z: random(0.18, 1),
      size: random(0.45, 1.8),
      alpha: random(0.18, 0.9),
      phase: random(0, TAU),
      hue: Math.random() > 0.83 ? "warm" : "cool"
    }));

    state.nebulae = [
      { x: 0.18, y: 0.2, r: 0.32, speed: 0.012, phase: 0.2 },
      { x: 0.78, y: 0.37, r: 0.27, speed: 0.008, phase: 2.4 },
      { x: 0.54, y: 0.74, r: 0.38, speed: 0.01, phase: 4.1 },
      { x: 0.93, y: 0.83, r: 0.21, speed: 0.014, phase: 1.1 }
    ];
  }

  function resetRun() {
    state.distance = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.integrity = 100;
    state.charge = 100;
    state.speed = 180;
    state.spawnDistance = 0;
    state.spawnRow = 0;
    state.biomeIndex = 0;
    state.deepestBiome = 0;
    state.nextMilestone = 500;
    milestoneValue.textContent = "500 M";
    state.objects.length = 0;
    state.particles.length = 0;
    state.player.x = 0.5;
    state.player.y = 0.72;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.phaseTime = 0;
    state.player.cooldown = 0;
    state.player.invulnerable = 0;
    state.player.trailClock = 0;
    state.player.targetX = 0.5;
    state.player.targetY = 0.72;
    state.shake = 0;
    ui.biome.textContent = BIOMES[0].name;
    updateHud(true);
  }

  function startGame() {
    resetRun();
    state.phase = "playing";
    initAudio();
    pauseButton.setAttribute("aria-label", "Pause game");
    updateHud(true);
    hideScreen(startScreen);
    hideScreen(pauseScreen);
    hideScreen(gameOverScreen);
    hud.hidden = false;
    pauseButton.hidden = false;
    phaseButton.hidden = false;
    controlHint.classList.add("is-visible");
    ui.fieldStatus.textContent = "FIELD ACTIVE // DRIFTING";
    document.body.classList.remove("is-muted");
    updateSoundButton();
    showToast("DRIFT INITIATED // NO RETURN COORDINATE");
    playTone(180, 0.18, "sine", 0.09, 420);
  }

  function togglePause(forcePause = false) {
    if (state.phase === "playing" || forcePause) {
      if (state.phase !== "playing") return;
      state.phase = "paused";
      showScreen(pauseScreen);
      pauseButton.setAttribute("aria-label", "Resume game");
      ui.fieldStatus.textContent = "FIELD SUSPENDED";
      controlHint.classList.remove("is-visible");
      return;
    }

    if (state.phase === "paused") {
      state.phase = "playing";
      hideScreen(pauseScreen);
      pauseButton.setAttribute("aria-label", "Pause game");
      ui.fieldStatus.textContent = "FIELD ACTIVE // DRIFTING";
      controlHint.classList.add("is-visible");
      state.lastTime = performance.now();
    }
  }

  function endGame() {
    if (state.phase !== "playing") return;
    state.phase = "gameover";
    const finalDistance = Math.floor(state.distance);
    const isNewBest = finalDistance > state.best;
    if (isNewBest) {
      state.best = finalDistance;
      storage.set("everdrift-best", String(state.best));
    }

    burst(state.player.x * state.width, state.player.y * state.height, BIOMES[state.biomeIndex].accent, 46, 320);
    burst(state.player.x * state.width, state.player.y * state.height, "#ffffff", 24, 220);
    state.shake = 0.8;
    playHit();
    playTone(130, 0.8, "sawtooth", 0.09, 42);

    ui.finalDistance.innerHTML = `${finalDistance.toLocaleString()}<small>m</small>`;
    ui.finalScore.textContent = Math.floor(state.score).toLocaleString();
    updateHud(true);
    ui.finalBiome.textContent = BIOMES[state.deepestBiome].name.replace("THE ", "");
    ui.newBest.hidden = !isNewBest;
    ui.best.textContent = state.best.toLocaleString();
    ui.startBest.textContent = `${state.best.toLocaleString()} M`;
    ui.fieldStatus.textContent = "SIGNAL LOST // FIELD AWAITS";
    pauseButton.hidden = true;
    phaseButton.hidden = true;
    controlHint.classList.remove("is-visible");
    showScreen(gameOverScreen);
  }

  function showScreen(screen) {
    screen.hidden = false;
    screen.classList.remove("is-leaving");
  }

  function hideScreen(screen) {
    screen.classList.add("is-leaving");
    window.setTimeout(() => {
      screen.hidden = true;
      screen.classList.remove("is-leaving");
    }, prefersReducedMotion ? 20 : 430);
  }

  function activatePhase() {
    if (state.phase !== "playing" || state.player.cooldown > 0 || state.charge < 25) return;
    state.charge -= 25;
    state.player.phaseTime = 0.42;
    state.player.cooldown = 2.5;
    const px = state.player.x * state.width;
    const py = state.player.y * state.height;
    burst(px, py, BIOMES[state.biomeIndex].accent2, 22, 180);
    createRing(px, py, BIOMES[state.biomeIndex].accent2, 70);
    playTone(220, 0.22, "triangle", 0.08, 920);
  }

  function updatePlayer(dt) {
    const player = state.player;
    const keys = state.keys;
    const horizontal = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const vertical = Number(keys.has("KeyS") || keys.has("ArrowDown")) - Number(keys.has("KeyW") || keys.has("ArrowUp"));

    player.cooldown = Math.max(0, player.cooldown - dt);
    player.phaseTime = Math.max(0, player.phaseTime - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    let targetX = player.x;
    let targetY = player.y;
    let responsiveness = 9;

    if (horizontal || vertical) {
      player.vx = horizontal * 500;
      player.vy = vertical * 430;
      player.x += (player.vx / state.width) * dt;
      player.y += (player.vy / state.height) * dt;
    } else if (state.pointer.active || lastPointerType === "mouse") {
      targetX = state.pointer.x;
      targetY = state.pointer.y;
      responsiveness = state.pointer.down ? 14 : 9.5;
      const oldX = player.x;
      const oldY = player.y;
      player.x = lerp(player.x, targetX, 1 - Math.exp(-responsiveness * dt));
      player.y = lerp(player.y, targetY, 1 - Math.exp(-responsiveness * dt));
      player.vx = ((player.x - oldX) / Math.max(dt, 0.001)) * state.width;
      player.vy = ((player.y - oldY) / Math.max(dt, 0.001)) * state.height;
    } else {
      player.vx *= Math.pow(0.02, dt);
      player.vy *= Math.pow(0.02, dt);
    }

    player.x = clamp(player.x, 0.045, 0.955);
    player.y = clamp(player.y, 0.23, 0.87);
    player.trailClock -= dt;

    if (player.trailClock <= 0 && state.phase === "playing") {
      player.trailClock = player.phaseTime > 0 ? 0.018 : 0.055;
      const biome = BIOMES[state.biomeIndex];
      state.particles.push({
        x: player.x * state.width - player.vx * 0.012,
        y: player.y * state.height + 13,
        vx: -player.vx * 0.08 + random(-8, 8),
        vy: random(35, 75),
        life: player.phaseTime > 0 ? 0.65 : 0.42,
        maxLife: player.phaseTime > 0 ? 0.65 : 0.42,
        size: player.phaseTime > 0 ? random(2.2, 4.8) : random(1, 2.4),
        color: player.phaseTime > 0 ? biome.accent2 : biome.accent,
        drag: 0.96
      });
    }
  }

  function spawnWave() {
    const lanes = [0.09, 0.24, 0.39, 0.54, 0.69, 0.84, 0.95];
    const difficulty = clamp(state.distance / 3200, 0, 1);
    const biome = BIOMES[state.biomeIndex];
    state.spawnRow += 1;

    const lightCount = state.spawnRow % 5 === 0 ? 1 : Math.floor(random(2, 4.8));
    const startLane = Math.floor(random(0, Math.max(1, lanes.length - lightCount + 1)));
    const usedLanes = new Set();

    for (let index = 0; index < lightCount; index += 1) {
      const lane = clamp(startLane + index, 0, lanes.length - 1);
      usedLanes.add(lane);
      let type = "mote";
      const rareRoll = Math.random();
      if (state.spawnRow % 17 === 0 && index === 0) type = "repair";
      else if (state.spawnRow % 11 === 0 && index === 0 && rareRoll > 0.45) type = "prism";
      state.objects.push({
        type,
        x: lanes[lane] + random(-0.018, 0.018),
        y: -24 + index * 6,
        r: type === "prism" ? 12 : type === "repair" ? 11 : 8,
        rot: random(0, TAU),
        spin: random(-1.3, 1.3),
        phase: random(0, TAU),
        color: type === "prism" ? biome.accent2 : type === "repair" ? "#c8ff74" : biome.accent
      });
    }

    const hazardChance = 0.22 + difficulty * 0.26;
    if (state.spawnRow > 2 && Math.random() < hazardChance) {
      const safeLanes = lanes.map((_, index) => index).filter((index) => !usedLanes.has(index));
      const lane = pick(safeLanes.length ? safeLanes : [0, 1, 2, 3, 4, 5, 6]);
      const riftChance = difficulty > 0.25 && Math.random() < 0.1 + difficulty * 0.08;
      state.objects.push({
        type: riftChance ? "rift" : "shard",
        x: lanes[lane],
        y: -125 + random(-15, 15),
        r: riftChance ? random(31, 40) : random(16, 25),
        rot: random(0, TAU),
        spin: random(-0.7, 0.7),
        phase: random(0, TAU),
        color: biome.hazard
      });
    }
  }

  function updateObjects(dt) {
    state.spawnDistance += state.speed * dt;
    const difficulty = clamp(state.distance / 3200, 0, 1);
    const baseSpacing = lerp(178, 143, difficulty);
    const spacing = baseSpacing + random(-24, 30);

    while (state.spawnDistance >= spacing) {
      state.spawnDistance -= spacing;
      spawnWave();
    }

    const playerX = state.player.x * state.width;
    const playerY = state.player.y * state.height;

    for (const object of state.objects) {
      object.y += state.speed * dt;
      object.rot += object.spin * dt;
      object.phase += dt * 2;

      const objectX = object.x * state.width;
      const distance = Math.hypot(objectX - playerX, object.y - playerY);
      const collisionRadius = object.r + state.player.r * 0.65;

      if (distance < collisionRadius && state.phase === "playing") {
        if (object.type === "mote" || object.type === "prism" || object.type === "repair") {
          collectObject(object, objectX);
          object.dead = true;
        } else if (state.player.phaseTime <= 0 && state.player.invulnerable <= 0) {
          damagePlayer(object, objectX);
          object.dead = object.type === "shard";
        }
      }
    }

    state.objects = state.objects.filter((object) => !object.dead && object.y < state.height + 90);
  }

  function collectObject(object, objectX) {
    const biome = BIOMES[state.biomeIndex];
    if (object.type === "repair") {
      state.integrity = clamp(state.integrity + 16, 0, 100);
      state.score += 45 * state.multiplier;
      state.charge = clamp(state.charge + 12, 0, 100);
      burst(objectX, object.y, "#c8ff74", 18, 145);
      createRing(objectX, object.y, "#c8ff74", 35);
      showToast("HULL REPAIRED // +16");
      playTone(520, 0.18, "sine", 0.07, 880);
      return;
    }

    if (object.type === "prism") {
      state.score += 150 * state.multiplier;
      state.charge = clamp(state.charge + 18, 0, 100);
      state.combo += 4;
      burst(objectX, object.y, biome.accent2, 28, 210);
      createRing(objectX, object.y, biome.accent2, 58);
      showToast("PRISM FRACTURE // RESONANCE AMPLIFIED");
      playTone(440, 0.24, "triangle", 0.09, 1320);
      updateMultiplier();
      return;
    }

    state.combo += 1;
    state.comboTimer = 2.45;
    state.score += 12 * state.multiplier;
    state.charge = clamp(state.charge + 3.5, 0, 100);
    burst(objectX, object.y, biome.accent, 7, 90);
    playTone(360 + Math.min(state.combo, 28) * 16, 0.075, "sine", 0.045, 520 + Math.min(state.combo, 28) * 8);
    updateMultiplier();
  }

  function updateMultiplier() {
    const next = clamp(1 + Math.floor(state.combo / 6), 1, 8);
    if (next !== state.multiplier) {
      state.multiplier = next;
      if (next > 1) {
        showToast(`RESONANCE ×${next} // HOLD THE CHAIN`);
        playTone(620, 0.13, "triangle", 0.06, 940);
      }
    }
  }

  function damagePlayer(object, objectX) {
    const damage = object.type === "rift" ? 34 : 22;
    state.integrity = clamp(state.integrity - damage, 0, 100);
    state.player.invulnerable = 1.05;
    state.combo = 0;
    state.multiplier = 1;
    state.comboTimer = 0;
    state.shake = 0.45;
    burst(objectX, object.y, BIOMES[state.biomeIndex].hazard, 30, 250);
    createRing(objectX, object.y, BIOMES[state.biomeIndex].hazard, 74);
    playHit();
    showToast(`HULL IMPACT // −${damage}%`);
    if (state.integrity <= 0) endGame();
  }

  function updateDifficulty(dt) {
    const targetSpeed = 180 + Math.min(240, state.distance * 0.24);
    state.speed = lerp(state.speed, targetSpeed, 1 - Math.exp(-0.7 * dt));
    state.distance += state.speed * dt * 0.105;

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    const biomeIndex = Math.floor(state.distance / 1200) % BIOMES.length;
    if (biomeIndex !== state.biomeIndex) {
      state.biomeIndex = biomeIndex;
      ui.biome.textContent = BIOMES[biomeIndex].name;
      showToast(`ENTERING ${BIOMES[biomeIndex].name}`);
      createRing(state.width * 0.5, state.height * 0.48, BIOMES[biomeIndex].accent, Math.max(state.width, state.height) * 0.72);
      playTone(170, 0.5, "sine", 0.07, 510);
    }
    state.deepestBiome = Math.max(state.deepestBiome, biomeIndex);

    if (state.distance >= state.nextMilestone) {
      const mark = state.nextMilestone;
      state.nextMilestone += 500;
      milestoneValue.textContent = `${mark.toLocaleString()} M`;
      milestone.classList.remove("is-active");
      void milestone.offsetWidth;
      milestone.classList.add("is-active");
      playTone(260, 0.32, "triangle", 0.07, 780);
    }
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(particle.drag, dt * 60);
      particle.vy *= Math.pow(particle.drag, dt * 60);
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function burst(x, y, color, count = 12, force = 140) {
    if (prefersReducedMotion) count = Math.ceil(count * 0.35);
    for (let index = 0; index < count; index += 1) {
      const angle = random(0, TAU);
      const speed = random(force * 0.25, force);
      const life = random(0.3, 0.85);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: random(1, 3.4),
        color,
        drag: 0.94
      });
    }
  }

  function createRing(x, y, color, radius) {
    state.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.62,
      maxLife: 0.62,
      size: radius,
      color,
      drag: 1,
      ring: true
    });
  }

  function updateBackdrop(dt, speedMultiplier = 1) {
    const scroll = state.speed * speedMultiplier * dt;
    for (const star of state.stars) {
      star.y += scroll * star.z;
      star.phase += dt * (1 + star.z * 2);
      if (star.y > state.height + 4) {
        star.y = -4;
        star.x = random(0, state.width);
      }
    }
    state.menuTime += dt;
  }

  function update(dt) {
    state.elapsed += dt;
    updateBackdrop(dt, state.phase === "menu" ? 0.42 : 1);

    if (state.phase === "menu") {
      state.player.x = 0.5 + Math.sin(state.menuTime * 0.42) * 0.08;
      state.player.y = 0.7 + Math.cos(state.menuTime * 0.55) * 0.025;
      state.player.trailClock -= dt;
      if (state.player.trailClock <= 0) {
        state.player.trailClock = 0.06;
        state.particles.push({
          x: state.player.x * state.width + random(-3, 3),
          y: state.player.y * state.height + 13,
          vx: random(-4, 4),
          vy: random(28, 52),
          life: 0.55,
          maxLife: 0.55,
          size: random(1, 2.2),
          color: BIOMES[0].accent,
          drag: 0.96
        });
      }
      updateParticles(dt);
      state.shake = Math.max(0, state.shake - dt);
      return;
    }

    if (state.phase !== "playing") {
      updateParticles(dt * 0.35);
      state.shake = Math.max(0, state.shake - dt);
      return;
    }

    updateDifficulty(dt);
    updatePlayer(dt);
    updateObjects(dt);
    updateParticles(dt);
    state.shake = Math.max(0, state.shake - dt * 1.8);

    state.hudClock -= dt;
    if (state.hudClock <= 0) {
      state.hudClock = 0.08;
      updateHud();
    }
  }

  function updateHud(force = false) {
    const distance = Math.floor(state.distance);
    ui.distance.textContent = distance.toLocaleString();
    ui.score.textContent = Math.floor(state.score).toString().padStart(6, "0");
    ui.multiplier.textContent = `×${state.multiplier}`;
    ui.integrityText.textContent = `${Math.ceil(state.integrity)}%`;
    ui.integrityBar.style.transform = `scaleX(${state.integrity / 100})`;
    ui.chargeBar.style.transform = `scaleX(${state.charge / 100})`;
    ui.chargeText.textContent = state.player.cooldown > 0 ? `${state.player.cooldown.toFixed(1)}s` : state.charge >= 25 ? "READY" : "CHARGING";
    ui.best.textContent = state.best.toLocaleString();
    ui.startBest.textContent = `${state.best.toLocaleString()} M`;
    phaseButton.disabled = state.player.cooldown > 0 || state.charge < 25 || state.phase !== "playing";
    phaseButton.style.setProperty("--charge", `${state.charge}%`);
    phaseButton.classList.toggle("is-charging", state.player.cooldown > 0 || state.charge < 25);
    if (force) ui.biome.textContent = BIOMES[state.biomeIndex].name;
  }

  function showToast(message) {
    toastText.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function drawBackdrop() {
    const biome = BIOMES[state.biomeIndex];
    const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, biome.top);
    gradient.addColorStop(1, biome.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    for (const nebula of state.nebulae) {
      const x = nebula.x * state.width + Math.sin(state.menuTime * nebula.speed) * 45;
      const y = nebula.y * state.height + Math.cos(state.menuTime * nebula.speed * 1.2) * 30;
      const radius = nebula.r * Math.min(state.width, state.height);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, hexToRgba(biome.accent2, 0.075));
      glow.addColorStop(0.42, hexToRgba(biome.accent, 0.025));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    drawFlowLines(biome);

    for (const star of state.stars) {
      const twinkle = prefersReducedMotion ? 1 : 0.72 + Math.sin(star.phase) * 0.28;
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = star.hue === "warm" ? "#ffd6c7" : "#dff8ff";
      const size = star.size * (0.75 + star.z * 0.5);
      ctx.fillRect(star.x, star.y, size, size * (star.z > 0.8 ? 2.2 : 1));
    }
    ctx.globalAlpha = 1;
  }

  function drawFlowLines(biome) {
    const lineCount = 7;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 1;
    for (let index = 0; index < lineCount; index += 1) {
      const baseX = (index + 0.5) / lineCount * state.width;
      ctx.beginPath();
      for (let y = -20; y <= state.height + 20; y += 34) {
        const x = baseX + Math.sin(y * 0.012 + state.menuTime * 0.16 + index * 0.9) * 16;
        if (y === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawObject(object) {
    const x = object.x * state.width;
    const y = object.y;
    const biome = BIOMES[state.biomeIndex];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(object.rot);

    if (object.type === "mote") {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = object.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = object.color;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
    } else if (object.type === "prism") {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = object.color;
      ctx.shadowBlur = 24;
      ctx.fillStyle = object.color;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 7);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
    } else if (object.type === "repair") {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = object.color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = object.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.moveTo(-5, 0);
      ctx.lineTo(5, 0);
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 5);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
    } else if (object.type === "shard") {
      ctx.shadowColor = object.color;
      ctx.shadowBlur = 15;
      const points = 7;
      const radius = object.r;
      ctx.beginPath();
      for (let point = 0; point < points; point += 1) {
        const angle = (point / points) * TAU;
        const pointRadius = radius * (point % 2 === 0 ? 1 : 0.68);
        const pointX = Math.cos(angle) * pointRadius;
        const pointY = Math.sin(angle) * pointRadius;
        if (point === 0) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(8, 8, 20, .88)";
      ctx.fill();
      ctx.strokeStyle = object.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.45, radius * 0.12);
      ctx.lineTo(0, -radius * 0.35);
      ctx.lineTo(radius * 0.46, -radius * 0.08);
      ctx.stroke();
    } else if (object.type === "rift") {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = object.color;
      ctx.shadowBlur = 26;
      ctx.strokeStyle = object.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, object.r, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      const core = ctx.createRadialGradient(0, 0, object.r * 0.15, 0, 0, object.r);
      core.addColorStop(0, "rgba(2,2,9,1)");
      core.addColorStop(0.75, "rgba(10,4,18,.94)");
      core.addColorStop(1, "rgba(20,5,30,.2)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, object.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, object.r * 0.68, state.elapsed * 1.2, state.elapsed * 1.2 + Math.PI * 1.4);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawPlayer() {
    const player = state.player;
    const x = player.x * state.width;
    const y = player.y * state.height;
    const biome = BIOMES[state.biomeIndex];
    const tilt = clamp(player.vx / 650, -0.48, 0.48);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    if (player.phaseTime > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = biome.accent2;
      ctx.shadowBlur = 32;
      ctx.strokeStyle = biome.accent2;
      ctx.lineWidth = 1.5;
      for (let ring = 0; ring < 3; ring += 1) {
        const progress = 1 - player.phaseTime / 0.42;
        ctx.globalAlpha = 0.6 - ring * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + ring * 8 + progress * 18, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
    }

    const glow = ctx.createRadialGradient(0, 4, 1, 0, 4, 46);
    glow.addColorStop(0, hexToRgba(biome.accent, 0.3));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-48, -44, 96, 96);

    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = biome.accent;
    ctx.shadowBlur = 18;
    ctx.fillStyle = biome.accent;
    ctx.beginPath();
    ctx.moveTo(0, 19);
    ctx.lineTo(-4, 6);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo(6, -10, 17, 16);
    ctx.lineTo(4, 11);
    ctx.lineTo(0, 16);
    ctx.lineTo(-4, 11);
    ctx.lineTo(-17, 16);
    ctx.quadraticCurveTo(-6, -10, 0, -21);
    ctx.closePath();
    ctx.fillStyle = "rgba(11, 14, 32, .94)";
    ctx.fill();
    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 8);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fillStyle = "#f5fcff";
    ctx.shadowColor = biome.accent;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    } else {
      ctx.globalAlpha = 1;
    }

    if (player.invulnerable > 0) {
      ctx.strokeStyle = "#ff7d9d";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      if (particle.ring) {
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 1.5 * alpha;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (1 - alpha * 0.82), 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.save();

    if (state.shake > 0 && !prefersReducedMotion) {
      const amount = state.shake * 10;
      ctx.translate(random(-amount, amount), random(-amount, amount));
    }

    drawBackdrop();
    for (const object of state.objects) drawObject(object);
    drawPlayer();
    drawParticles();
    ctx.restore();
  }

  function loop(timestamp) {
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.034);
    state.lastTime = timestamp;
    update(dt);
    render();
    window.requestAnimationFrame(loop);
  }

  function initAudio() {
    if (state.soundReady) {
      if (audioContext?.state === "suspended") audioContext.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      audioContext = new AudioContext();
      masterGain = audioContext.createGain();
      masterGain.gain.value = state.muted ? 0 : 0.38;
      masterGain.connect(audioContext.destination);

      const droneGain = audioContext.createGain();
      droneGain.gain.value = 0.018;
      droneGain.connect(masterGain);
      const low = audioContext.createOscillator();
      const high = audioContext.createOscillator();
      low.type = "sine";
      high.type = "triangle";
      low.frequency.value = 44;
      high.frequency.value = 66.5;
      low.connect(droneGain);
      high.connect(droneGain);
      low.start();
      high.start();
      state.soundReady = true;
    } catch {
      state.soundReady = false;
    }
  }

  function playTone(frequency, duration, type = "sine", volume = 0.05, endFrequency = frequency) {
    if (state.muted || !audioContext || !masterGain) return;
    try {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.03);
    } catch {
      // Sound is optional and should never interrupt play.
    }
  }

  function playHit() {
    if (state.muted || !audioContext || !masterGain) return;
    try {
      const length = Math.floor(audioContext.sampleRate * 0.18);
      const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 2.4);
      }
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      gain.gain.value = 0.18;
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      source.start();
    } catch {
      // Sound is optional and should never interrupt play.
    }
  }

  function updateSoundButton() {
    soundButton.classList.toggle("is-muted", state.muted);
    soundButton.setAttribute("aria-pressed", String(state.muted));
    soundButton.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
  }

  function toggleSound() {
    state.muted = !state.muted;
    storage.set("everdrift-muted", String(state.muted));
    updateSoundButton();
    if (!state.soundReady) initAudio();
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime(state.muted ? 0 : 0.38, audioContext.currentTime, 0.04);
    }
    if (!state.muted) playTone(440, 0.12, "sine", 0.05, 660);
  }

  function hexToRgba(hex, alpha) {
    const normalized = hex.replace("#", "");
    const value = Number.parseInt(normalized, 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function handlePointerMove(event) {
    lastPointerType = event.pointerType || "mouse";
    state.pointer.x = clamp(event.clientX / state.width, 0.045, 0.955);
    state.pointer.y = clamp(event.clientY / state.height, 0.23, 0.87);
    if (event.pointerType !== "touch") state.pointer.active = true;
  }

  function bindEvents() {
    $("#startButton").addEventListener("click", startGame);
    $("#restartButton").addEventListener("click", startGame);
    $("#restartFromPause").addEventListener("click", startGame);
    $("#resumeButton").addEventListener("click", () => togglePause());
    pauseButton.addEventListener("click", () => togglePause());
    phaseButton.addEventListener("click", activatePhase);
    soundButton.addEventListener("click", toggleSound);

    helpButton.addEventListener("click", () => {
      if (typeof controlsDialog.showModal === "function") controlsDialog.showModal();
      else controlsDialog.setAttribute("open", "");
    });
    $("#closeControls").addEventListener("click", () => controlsDialog.close());
    controlsDialog.addEventListener("click", (event) => {
      const rect = controlsDialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) controlsDialog.close();
    });

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", (event) => {
      handlePointerMove(event);
      state.pointer.down = true;
      state.pointer.active = true;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointerup", (event) => {
      state.pointer.down = false;
      if (event.pointerType === "touch") state.pointer.active = false;
      canvas.releasePointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointercancel", () => {
      state.pointer.down = false;
      state.pointer.active = false;
    });

    window.addEventListener("keydown", (event) => {
      const controlled = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
      if (controlled.includes(event.code)) event.preventDefault();
      state.keys.add(event.code);
      if (event.repeat) return;

      if (event.code === "Space") activatePhase();
      if (event.code === "KeyP" || event.code === "Escape") {
        if (controlsDialog.open) {
          controlsDialog.close();
        } else {
          togglePause();
        }
      }
      if (event.code === "Enter" && state.phase === "gameover") startGame();
    });

    window.addEventListener("keyup", (event) => state.keys.delete(event.code));
    window.addEventListener("blur", () => {
      state.keys.clear();
      if (state.phase === "playing") togglePause(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.phase === "playing") togglePause(true);
    });
    window.addEventListener("resize", resizeCanvas, { passive: true });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      installButton.hidden = false;
    });
    installButton.addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = result?.outcome === "accepted";
    });
    window.addEventListener("appinstalled", () => {
      installButton.hidden = true;
      installPrompt = null;
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is progressive enhancement.
    });
  }

  function init() {
    resizeCanvas();
    resetRun();
    updateSoundButton();
    bindEvents();
    registerServiceWorker();
    if (coarsePointer) {
      controlHint.querySelector(".control-hint__keys").innerHTML = "<kbd>DRAG</kbd><span>to steer</span>";
    }
    window.requestAnimationFrame((timestamp) => {
      state.lastTime = timestamp;
      loop(timestamp);
    });
  }

  init();
})();
