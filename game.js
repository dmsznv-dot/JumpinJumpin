/**
 * ГЕКСА-ГОНКА 3D (Hex-A-Fall Showdown)
 * Играбельный MVP-прототип в стиле Fall Guys (Hex-A-Gone + регенерация сот + бусты + боты + лидерборд)
 * Подготовлено под требования Яндекс Игр (без внешних ассетов, процедурный WebAudio, RU локализация, тач + клавиатура).
 */

(() => {
  'use strict';

  // ==================== КОНФИГУРАЦИЯ СЛОЖНОСТИ И РЕЖИМОВ ====================
  const DIFFICULTIES = {
    easy: {
      id: 'easy',
      name: 'Разминка',
      botsCount: 8,
      layersCount: 2,
      gridRadius: 6,      // радиус гекса-арены в сотах
      crackTime: 0.72,    // сколько секунд плитка дрожит до обвала
      regenTime: 4.0,     // через сколько секунд плитка восстанавливается
      botIQ: 0.45,        // точность выбора пути и прыжков ботами
      powerupInterval: 4.0,
      specialTileChance: 0.08,
      scoreMult: 1.0
    },
    normal: {
      id: 'normal',
      name: 'Классика шоу',
      botsCount: 11,
      layersCount: 3,
      gridRadius: 6,
      crackTime: 0.50,
      regenTime: 5.5,
      botIQ: 0.72,
      powerupInterval: 3.5,
      specialTileChance: 0.14,
      scoreMult: 1.5
    },
    hard: {
      id: 'hard',
      name: 'Кибер-хардкор',
      botsCount: 15,
      layersCount: 3,
      gridRadius: 6,
      crackTime: 0.30,
      regenTime: 7.5,
      botIQ: 0.92,
      powerupInterval: 3.8,
      specialTileChance: 0.18,
      scoreMult: 2.2
    },
    chaos: {
      id: 'chaos',
      name: 'Мега-Хаос',
      botsCount: 19,
      layersCount: 4,
      gridRadius: 7,
      crackTime: 0.38,
      regenTime: 5.2,
      botIQ: 0.82,
      powerupInterval: 2.0,
      specialTileChance: 0.32,
      scoreMult: 2.5
    }
  };

  // Палитра ярусов (сверху вниз)
  const LAYER_THEMES = [
    { top: '#00e5ff', side: '#0088a3', crack: '#ffeb3b', danger: '#ff3d71', name: 'Неоновый Верх' },
    { top: '#ffaa00', side: '#b26a00', crack: '#ffea00', danger: '#ff1744', name: 'Золотой Экватор' },
    { top: '#e040fb', side: '#8e24aa', crack: '#ffd740', danger: '#ff1744', name: 'Фиолетовый Шторм' },
    { top: '#ff2a85', side: '#9b0047', crack: '#ffff00', danger: '#ff1744', name: 'Лавовое Дно' }
  ];

  // Костюмы / скины
  const SKINS = [
    { c1: '#ff3864', c2: '#ffffff', hat: '👑' },
    { c1: '#00e5ff', c2: '#ffe600', hat: '⚡' },
    { c1: '#76ff03', c2: '#1a237e', hat: '🦖' },
    { c1: '#ff9100', c2: '#4a148c', hat: '🐯' },
    { c1: '#d500f9', c2: '#00e676', hat: '👽' },
    { c1: '#ffd700', c2: '#d32f2f', hat: '🏆' },
    { c1: '#ff6d00', c2: '#ffffff', hat: '🦊' },
    { c1: '#00bfa5', c2: '#fce4ec', hat: '🦈' }
  ];

  // Типы бонусов (Power-ups)
  const POWERUP_TYPES = [
    { id: 'speed',   name: 'Турбо-ботинки',   icon: '⚡', color: '#00e5ff', duration: 6.5, instant: false },
    { id: 'feather', name: 'Грави-перья',     icon: '🪽', color: '#b388ff', duration: 7.5, instant: false },
    { id: 'ghost',   name: 'Призрачный шаг',  icon: '👻', color: '#69f0ae', duration: 4.5, instant: false },
    { id: 'shield',  name: 'Батут-спасение',  icon: '🛡️', color: '#ffd740', duration: 14.0, instant: false },
    { id: 'shock',   name: 'Ударная волна',   icon: '💥', color: '#ff5252', duration: 0,   instant: true },
    { id: 'builder', name: 'Гекса-Строитель', icon: '🛠️', color: '#00e676', duration: 0,   instant: true }
  ];

  // Имена ботов для атмосферы шоу
  const BOT_NAMES = [
    'Пельмешек_3000', 'КиберБоб', 'ТурбоГусь', 'НеПадайБро', 'ГексаЛорд',
    'СладкийБублик', 'ПрыгСкок', 'КорольСлизи', 'НиндзяТапок', 'Бананчик_PRO',
    'ДерзкийПингвин', 'КосмоКот', 'МегаЖелейка', 'УльтраБобик', 'ФоллМастер',
    'ШустрыйЕнот', 'ЛазерныйКраб', 'КапитанПлюх', 'ЗефирныйВоин', 'ДискоКабачок'
  ];

  // ==================== ПРОЦЕДУРНЫЙ ЗВУКОВОЙ ДВИЖОК (Web Audio API) ====================
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    play(type) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'step') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240 + Math.random() * 80, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.065);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.065);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === 'break') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'regen') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.11);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.11);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.16);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else if (type === 'spring') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.28);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.29);
      } else if (type === 'dive') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'powerup') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.07);
        osc.frequency.setValueAtTime(880, now + 0.14);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.26);
        osc.start(now);
        osc.stop(now + 0.27);
      } else if (type === 'shock') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'elim') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.32);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.33);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, idx) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle';
          o.connect(g);
          g.connect(this.ctx.destination);
          o.frequency.setValueAtTime(n, now + idx * 0.09);
          g.gain.setValueAtTime(0.16, now + idx * 0.09);
          g.gain.linearRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);
          o.start(now + idx * 0.09);
          o.stop(now + idx * 0.09 + 0.3);
        });
      } else if (type === 'count') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    }
  }

  const sfx = new SoundFX();

  // ==================== ГЕОМЕТРИЯ ГЕКСАГОНОВ ====================
  const HEX_RADIUS = 38; // радиус одного шестиугольника в мировых единицах
  const SQRT3 = Math.sqrt(3);
  const LAYER_GAP = 210; // расстояние по вертикали (Z) между ярусами

  // Axial (q, r) -> World (x, y)
  function axialToWorld(q, r) {
    const x = HEX_RADIUS * SQRT3 * (q + r * 0.5);
    const y = HEX_RADIUS * 1.5 * r;
    return { x, y };
  }

  // World (x, y) -> ближайший Axial (q, r)
  function worldToAxial(x, y) {
    const q = (SQRT3 / 3 * x - 1 / 3 * y) / HEX_RADIUS;
    const r = (2 / 3 * y) / HEX_RADIUS;
    return axialRound(q, r);
  }

  function axialRound(q, r) {
    let x = q;
    let z = r;
    let y = -x - z;
    let rx = Math.round(x);
    let ry = Math.round(y);
    let rz = Math.round(z);

    const xDiff = Math.abs(rx - x);
    const yDiff = Math.abs(ry - y);
    const zDiff = Math.abs(rz - z);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }
    return { q: rx, r: rz };
  }

  function hexDistance(q1, r1, q2, r2) {
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
  }

  // ==================== ХРАНИЛИЩЕ И ЛИДЕРБОРД ====================
  const STORAGE_KEY = 'hex_fall_guys_save_v1';

  function loadSaveData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      playerName: 'Чемпион_01',
      skinIndex: 0,
      difficulty: 'normal',
      crowns: 0,
      totalScore: 0,
      matchesPlayed: 0,
      bestSurvivalSec: 0,
      recordsByDiff: {
        easy: { wins: 0, bestTime: 0, bestScore: 0 },
        normal: { wins: 0, bestTime: 0, bestScore: 0 },
        hard: { wins: 0, bestTime: 0, bestScore: 0 },
        chaos: { wins: 0, bestTime: 0, bestScore: 0 }
      },
      rivalStandings: [
        { name: 'ГексаЛорд_99', crowns: 14, bestTime: 94.2, score: 18400 },
        { name: 'КиберПельмень', crowns: 10, bestTime: 82.5, score: 14200 },
        { name: 'НеПадайБро', crowns: 7, bestTime: 75.0, score: 10900 },
        { name: 'ТурбоГусь_PRO', crowns: 5, bestTime: 68.4, score: 8300 },
        { name: 'КорольСлизи', crowns: 3, bestTime: 61.1, score: 5600 },
        { name: 'ПрыгСкок', crowns: 2, bestTime: 53.8, score: 3900 },
        { name: 'СладкийБублик', crowns: 1, bestTime: 44.0, score: 2100 }
      ]
    };
  }

  function saveGameData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (e) {}
  }

  let saveData = loadSaveData();

  // ==================== СОСТОЯНИЕ ИГРЫ ====================
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  let state = {
    phase: 'menu', // 'menu', 'countdown', 'playing', 'gameover'
    diffKey: saveData.difficulty || 'normal',
    config: DIFFICULTIES[saveData.difficulty || 'normal'],
    elapsed: 0,
    countdownTimer: 3.0,
    cameraYaw: 0.35,      // угол поворота камеры вокруг оси Z
    targetCameraYaw: 0.35,
    cameraPitch: 0.62,    // наклон изометрии (отношение по Y)
    camX: 0,
    camY: 0,
    camZ: 0,
    spectateSpeed: 1,
    spectateTarget: null,
    layers: [],           // массив ярусов с гекса-плитками
    actors: [],           // игрок + боты
    player: null,
    powerups: [],         // бонусы на поле
    particles: [],        // частицы
    shockwaves: [],       // визуальные кольца ударных волн
    eliminationOrder: [], // кто за кем выбыл
    powerupSpawnTimer: 2.5,
    eventTimer: 16.0,
    activeEventText: ''
  };

  // ==================== КЛАСС ГЕКСА-ПЛИТКИ ====================
  class HexTile {
    constructor(layerIndex, q, r, zHeight, specialType = 'normal') {
      this.layerIndex = layerIndex;
      this.q = q;
      this.r = r;
      this.key = `${q},${r}`;
      const pos = axialToWorld(q, r);
      this.x = pos.x;
      this.y = pos.y;
      this.baseZ = zHeight;

      // Специальные типы сот:
      // 'normal' — стандартная (трескается и падает, потом восстанавливается)
      // 'spring' — батутная сота (желто-зелёная пружина, подбрасывает высоко вверх)
      // 'bomb'   — взрывная сота (при обвале запускает цепную реакцию на соседей)
      // 'gold'   — прочная золотая сота (держится в 2.5 раза дольше и даёт +25 очков)
      this.specialType = specialType;

      this.status = 'solid'; // 'solid' | 'cracking' | 'falling' | 'regenerating'
      this.timer = 0;
      this.fallOffsetZ = 0;
      this.scale = 1;
      this.lastTouchedBy = null;
    }

    triggerStep(actor, config) {
      if (this.status !== 'solid') return;

      // Если у актёра активен «Призрачный шаг», плитка не ломается!
      if (actor && actor.buffs.ghost > 0) return;

      // Если это батутная плитка — подбрасывает актёра вверх!
      if (this.specialType === 'spring' && actor && actor.vz <= 5) {
        actor.vz = 420;
        actor.onGround = false;
        sfx.play('spring');
        spawnParticles(this.x, this.y, this.baseZ, '#00e676', 12);
      }

      this.status = 'cracking';
      const mult = this.specialType === 'gold' ? 2.4 : 1.0;
      this.timer = config.crackTime * mult;
      this.lastTouchedBy = actor;

      if (actor && actor.isPlayer) {
        sfx.play('step');
        if (this.specialType === 'gold') {
          actor.score += 25;
        }
      }
    }

    forceBreak(actor, config) {
      if (this.status === 'falling' || this.status === 'regenerating') return;
      this.status = 'falling';
      this.timer = 0.35;
      this.fallOffsetZ = 0;
      if (actor) {
        actor.tilesBroken++;
        actor.score += 10;
      }
      spawnParticles(this.x, this.y, this.baseZ, LAYER_THEMES[this.layerIndex % LAYER_THEMES.length].top, 6);
    }

    instantRepair() {
      if (this.status !== 'solid') {
        this.status = 'solid';
        this.timer = 0;
        this.fallOffsetZ = 0;
        this.scale = 1;
        spawnParticles(this.x, this.y, this.baseZ, '#00e676', 5);
      }
    }

    update(dt, config, layerMap) {
      if (this.status === 'cracking') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.status = 'falling';
          this.timer = 0.38;
          this.fallOffsetZ = 0;
          if (this.lastTouchedBy) {
            this.lastTouchedBy.tilesBroken++;
            this.lastTouchedBy.score += 10;
            if (this.lastTouchedBy.isPlayer) sfx.play('break');
          }
          // Если взрывная плитка — подрывает соседние!
          if (this.specialType === 'bomb') {
            sfx.play('shock');
            spawnShockwave(this.x, this.y, this.baseZ, HEX_RADIUS * 2.6, '#ff5252');
            const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
            dirs.forEach(([dq, dr]) => {
              const nb = layerMap.get(`${this.q + dq},${this.r + dr}`);
              if (nb && nb.status === 'solid') {
                nb.status = 'cracking';
                nb.timer = 0.12;
              }
            });
          }
        }
      } else if (this.status === 'falling') {
        this.timer -= dt;
        this.fallOffsetZ -= 290 * dt;
        this.scale = Math.max(0.1, this.timer / 0.38);
        if (this.timer <= 0) {
          this.status = 'regenerating';
          this.timer = config.regenTime;
          this.fallOffsetZ = 0;
          this.scale = 0;
        }
      } else if (this.status === 'regenerating') {
        this.timer -= dt;
        // За последние 0.6 сек плитка плавно вырастает (голограмма -> твёрдая сота)
        if (this.timer < 0.6) {
          this.scale = Math.min(1, 1 - (this.timer / 0.6));
        } else {
          this.scale = 0.25;
        }
        if (this.timer <= 0) {
          this.status = 'solid';
          this.scale = 1;
          this.timer = 0;
          spawnParticles(this.x, this.y, this.baseZ, '#ffffff', 4);
        }
      }
    }
  }

  // ==================== КЛАСС УЧАСТНИКА (ИГРОК ИЛИ БОТ) ====================
  class Actor {
    constructor(id, name, isPlayer, skin, startX, startY, startZ) {
      this.id = id;
      this.name = name;
      this.isPlayer = isPlayer;
      this.skin = skin;

      this.x = startX;
      this.y = startY;
      this.z = startZ;
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;

      this.radius = 15;
      this.facing = Math.random() * Math.PI * 2;
      this.onGround = false;
      this.currentLayer = 0;
      this.alive = true;
      this.survivalTime = 0;
      this.score = 0;
      this.tilesBroken = 0;

      // Прыжок и рывок
      this.jumpCount = 0;
      this.diveCooldown = 0;
      this.isDiving = false;
      this.diveTimer = 0;
      this.walkCycle = Math.random() * 10;

      // Активные бонусы (таймеры в секундах)
      this.buffs = {
        speed: 0,
        feather: 0,
        ghost: 0,
        shield: 0
      };

      // ИИ память для ботов
      this.aiTargetTile = null;
      this.aiRetargetTimer = 0;
    }

    getMaxJumps() {
      return this.buffs.feather > 0 ? 2 : 1;
    }

    jump() {
      if (!this.alive) return false;
      const maxJumps = this.getMaxJumps();
      if (this.onGround || this.jumpCount < maxJumps) {
        const boost = this.buffs.feather > 0 ? 1.24 : 1.0;
        this.vz = 295 * boost;
        this.onGround = false;
        this.jumpCount++;
        if (this.isPlayer) sfx.play('jump');
        spawnParticles(this.x, this.y, this.z, '#ffffff', 6);
        return true;
      }
      return false;
    }

    dive() {
      if (!this.alive || this.diveCooldown > 0) return false;
      this.diveCooldown = 2.0;
      this.isDiving = true;
      this.diveTimer = 0.32;

      const speed = 340;
      this.vx = Math.cos(this.facing) * speed;
      this.vy = Math.sin(this.facing) * speed;
      if (!this.onGround) {
        this.vz = Math.max(this.vz, 130);
      } else {
        this.vz = 150;
        this.onGround = false;
      }

      if (this.isPlayer) sfx.play('dive');
      spawnParticles(this.x, this.y, this.z + 10, '#ff9100', 10);

      // Рывок расталкивает ближайших соперников впереди!
      state.actors.forEach(other => {
        if (other !== this && other.alive && Math.abs(other.z - this.z) < 45) {
          const dx = other.x - this.x;
          const dy = other.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 62 && dist > 0.01) {
            const nx = dx / dist;
            const ny = dy / dist;
            other.vx += nx * 320;
            other.vy += ny * 320;
            other.vz = 160;
            other.onGround = false;
            this.score += 35;
          }
        }
      });

      return true;
    }
  }

  // ==================== ГЕНЕРАЦИЯ АРЕНЫ И МАТЧА ====================
  function buildArena(config) {
    state.layers = [];
    const R = config.gridRadius;

    for (let l = 0; l < config.layersCount; l++) {
      const zHeight = (config.layersCount - 1 - l) * LAYER_GAP;
      const map = new Map();
      const list = [];

      for (let q = -R; q <= R; q++) {
        const r1 = Math.max(-R, -q - R);
        const r2 = Math.min(R, -q + R);
        for (let r = r1; r <= r2; r++) {
          let special = 'normal';
          const distCenter = hexDistance(0, 0, q, r);
          if (distCenter > 1 && Math.random() < config.specialTileChance) {
            const roll = Math.random();
            if (roll < 0.36) special = 'spring';
            else if (roll < 0.72) special = 'gold';
            else special = 'bomb';
          }
          const tile = new HexTile(l, q, r, zHeight, special);
          map.set(tile.key, tile);
          list.push(tile);
        }
      }
      state.layers.push({ index: l, zHeight, map, list });
    }
  }

  function startMatch() {
    const diffKey = state.diffKey;
    const config = DIFFICULTIES[diffKey];
    state.config = config;
    state.elapsed = 0;
    state.countdownTimer = 3.0;
    state.phase = 'countdown';
    state.spectateSpeed = 1;
    state.spectateTarget = null;
    state.powerups = [];
    state.particles = [];
    state.shockwaves = [];
    state.eliminationOrder = [];
    state.powerupSpawnTimer = 2.0;
    state.eventTimer = 15.0;
    state.activeEventText = '';

    document.getElementById('event-banner').classList.add('hidden');
    document.getElementById('spectator-bar').classList.add('hidden');
    document.getElementById('start-modal').classList.add('hidden');
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('lb-modal').classList.add('hidden');
    document.getElementById('killfeed').innerHTML = '';

    buildArena(config);

    // Спавним участников на верхнем ярусе (layer 0) по кругу
    const topLayer = state.layers[0];
    const totalActors = 1 + config.botsCount;
    state.actors = [];

    const spawnTiles = topLayer.list.filter(t => hexDistance(0, 0, t.q, t.r) >= 2 && hexDistance(0, 0, t.q, t.r) <= config.gridRadius - 1);

    const playerSkin = SKINS[saveData.skinIndex % SKINS.length];
    const pTile = spawnTiles[0] || topLayer.list[0];
    const player = new Actor(
      'player',
      saveData.playerName || 'Чемпион_01',
      true,
      playerSkin,
      pTile.x,
      pTile.y,
      topLayer.zHeight + 10
    );
    state.player = player;
    state.actors.push(player);

    // Перемешиваем имена ботов
    const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);

    for (let i = 0; i < config.botsCount; i++) {
      const angle = ((i + 1) / totalActors) * Math.PI * 2;
      const ringDist = HEX_RADIUS * (config.gridRadius * 0.85);
      const bx = Math.cos(angle) * ringDist;
      const by = Math.sin(angle) * ringDist;
      const axial = worldToAxial(bx, by);
      const bTile = topLayer.map.get(`${axial.q},${axial.r}`) || spawnTiles[(i * 3) % spawnTiles.length];

      const botSkin = SKINS[(i + 1) % SKINS.length];
      const bot = new Actor(
        `bot_${i}`,
        shuffledNames[i % shuffledNames.length],
        false,
        botSkin,
        bTile.x + (Math.random() - 0.5) * 10,
        bTile.y + (Math.random() - 0.5) * 10,
        topLayer.zHeight + 10
      );
      state.actors.push(bot);
    }

    // Центрируем камеру на игроке
    state.camX = player.x;
    state.camY = player.y;
    state.camZ = player.z;

    // Показываем отсчёт
    const cdOverlay = document.getElementById('countdown-overlay');
    const cdText = document.getElementById('countdown-text');
    cdOverlay.classList.remove('hidden');
    cdText.textContent = '3';
    sfx.play('count');

    updateHUD();
  }

  // ==================== СПАВН БОНУСОВ И ЧАСТИЦ ====================
  function spawnPowerup(forcedLayerIndex = null) {
    const aliveActors = state.actors.filter(a => a.alive);
    if (aliveActors.length === 0) return;

    // Выбираем ярус, где сейчас есть живые игроки
    let layerIdx = forcedLayerIndex;
    if (layerIdx === null) {
      const sampleActor = aliveActors[Math.floor(Math.random() * aliveActors.length)];
      layerIdx = Math.min(state.layers.length - 1, Math.max(0, sampleActor.currentLayer));
    }

    const layer = state.layers[layerIdx];
    if (!layer) return;

    const solidTiles = layer.list.filter(t => t.status === 'solid');
    if (solidTiles.length === 0) return;

    const tile = solidTiles[Math.floor(Math.random() * solidTiles.length)];
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];

    state.powerups.push({
      x: tile.x,
      y: tile.y,
      z: layer.zHeight + 22,
      layerIndex: layerIdx,
      type,
      life: 14.0,
      bobPhase: Math.random() * Math.PI * 2
    });
  }

  function applyPowerup(actor, pu) {
    const t = pu.type;
    actor.score += 50;
    if (actor.isPlayer) {
      sfx.play('powerup');
      addFeedItem(`✨ Вы подобрали: ${t.icon} ${t.name}!`, t.color);
    }

    spawnParticles(pu.x, pu.y, pu.z, t.color, 14);

    if (t.id === 'speed') {
      actor.buffs.speed = t.duration;
    } else if (t.id === 'feather') {
      actor.buffs.feather = t.duration;
    } else if (t.id === 'ghost') {
      actor.buffs.ghost = t.duration;
    } else if (t.id === 'shield') {
      actor.buffs.shield = t.duration;
    } else if (t.id === 'shock') {
      // Мгновенная ударная волна: отбрасывает соперников и обрушивает соты вокруг них
      sfx.play('shock');
      spawnShockwave(actor.x, actor.y, actor.z, 155, '#ff5252');
      state.actors.forEach(other => {
        if (other !== actor && other.alive && Math.abs(other.z - actor.z) < 60) {
          const dx = other.x - actor.x;
          const dy = other.y - actor.y;
          const d = Math.hypot(dx, dy);
          if (d < 155 && d > 0.01) {
            const force = (1 - d / 155) * 420 + 140;
            other.vx += (dx / d) * force;
            other.vy += (dy / d) * force;
            other.vz = 210;
            other.onGround = false;
            actor.score += 40;
          }
        }
      });
    } else if (t.id === 'builder') {
      // Восстанавливает все разрушенные или мигающие соты в радиусе 2 шагов вокруг игрока
      sfx.play('regen');
      spawnShockwave(actor.x, actor.y, actor.z, 130, '#00e676');
      const layer = state.layers[actor.currentLayer];
      if (layer) {
        const centerAx = worldToAxial(actor.x, actor.y);
        layer.list.forEach(tile => {
          if (hexDistance(centerAx.q, centerAx.r, tile.q, tile.r) <= 2) {
            tile.instantRepair();
          }
        });
      }
    }
  }

  function spawnParticles(x, y, z, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      state.particles.push({
        x, y, z,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vz: 60 + Math.random() * 140,
        color,
        size: 3 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65
      });
    }
  }

  function spawnShockwave(x, y, z, maxRadius, color) {
    state.shockwaves.push({
      x, y, z,
      radius: 10,
      maxRadius,
      color,
      life: 0.45,
      maxLife: 0.45
    });
  }

  function addFeedItem(text, borderColor = '#ff2a85') {
    const feed = document.getElementById('killfeed');
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.style.borderLeftColor = borderColor;
    item.textContent = text;
    feed.prepend(item);
    while (feed.children.length > 5) {
      feed.lastChild.remove();
    }
    setTimeout(() => {
      if (item.parentNode) item.remove();
    }, 4500);
  }

  // ==================== УПРАВЛЕНИЕ (КЛАВИАТУРА + ДЖОЙСТИК) ====================
  const keys = {};
  const joystick = { active: false, dx: 0, dy: 0, pointerId: null };

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (state.phase === 'playing') {
      if (e.code === 'Space') {
        e.preventDefault();
        state.player?.jump();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') {
        e.preventDefault();
        state.player?.dive();
      } else if (e.code === 'KeyQ') {
        state.targetCameraYaw -= Math.PI / 4;
      } else if (e.code === 'KeyR') {
        state.targetCameraYaw += Math.PI / 4;
      }
    }

    if (e.code === 'KeyM') {
      toggleSound();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      openLeaderboard();
    } else if (e.code === 'Escape') {
      openStartModal();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Виртуальный стик
  const joyBase = document.getElementById('joystick-base');
  const joyStick = document.getElementById('joystick-stick');

  function handleJoystickMove(clientX, clientY) {
    const rect = joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    joystick.dx = dx / maxR;
    joystick.dy = dy / maxR;
  }

  function resetJoystick() {
    joystick.active = false;
    joystick.dx = 0;
    joystick.dy = 0;
    joystick.pointerId = null;
    joyStick.style.transform = 'translate(0px, 0px)';
  }

  joyBase.addEventListener('pointerdown', (e) => {
    joystick.active = true;
    joystick.pointerId = e.pointerId;
    joyBase.setPointerCapture(e.pointerId);
    handleJoystickMove(e.clientX, e.clientY);
  });

  joyBase.addEventListener('pointermove', (e) => {
    if (joystick.active && e.pointerId === joystick.pointerId) {
      handleJoystickMove(e.clientX, e.clientY);
    }
  });

  joyBase.addEventListener('pointerup', resetJoystick);
  joyBase.addEventListener('pointercancel', resetJoystick);

  // Тач-кнопки прыжка и рывка
  document.getElementById('btn-touch-jump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.player?.jump();
  });
  document.getElementById('btn-touch-dive').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.player?.dive();
  });
  document.getElementById('chip-jump').addEventListener('click', () => state.player?.jump());
  document.getElementById('chip-dive').addEventListener('click', () => state.player?.dive());
  document.getElementById('chip-cam').addEventListener('click', () => {
    state.targetCameraYaw += Math.PI / 4;
  });

  // ==================== ИИ БОТОВ (ПОИСК БЕЗОПАСНЫХ СОТ И БОНУСОВ) ====================
  function updateBotAI(bot, dt, config) {
    bot.aiRetargetTimer -= dt;

    // Определяем текущий ярус под ботом
    const layer = state.layers[bot.currentLayer] || state.layers[state.layers.length - 1];
    const curAx = worldToAxial(bot.x, bot.y);
    const curTile = layer.map.get(`${curAx.q},${curAx.r}`);

    // Если под ногами пустота или плитка вот-вот провалится — срочно ищем новую!
    const urgent = !curTile || curTile.status === 'falling' || curTile.status === 'regenerating' ||
      (curTile.status === 'cracking' && curTile.timer < 0.22);

    if (bot.aiRetargetTimer <= 0 || urgent || !bot.aiTargetTile ||
        bot.aiTargetTile.status === 'falling' || bot.aiTargetTile.status === 'regenerating') {
      bot.aiRetargetTimer = 0.16 + (1 - config.botIQ) * 0.22;

      // Проверяем, есть ли рядом вкусный бонус на твёрдой плитке
      let bestBonus = null;
      let bestBonusDist = 140;
      for (const pu of state.powerups) {
        if (pu.layerIndex === bot.currentLayer) {
          const d = Math.hypot(pu.x - bot.x, pu.y - bot.y);
          if (d < bestBonusDist) {
            bestBonusDist = d;
            bestBonus = pu;
          }
        }
      }

      if (bestBonus && Math.random() < config.botIQ) {
        const bAx = worldToAxial(bestBonus.x, bestBonus.y);
        const bTile = layer.map.get(`${bAx.q},${bAx.r}`);
        if (bTile && bTile.status === 'solid') {
          bot.aiTargetTile = bTile;
        }
      }

      // Иначе оцениваем соседние соты в радиусе 1..2 шагов
      if (!bot.aiTargetTile || bot.aiTargetTile.status !== 'solid') {
        let bestTile = null;
        let bestScore = -9999;

        for (let dq = -2; dq <= 2; dq++) {
          for (let dr = Math.max(-2, -dq - 2); dr <= Math.min(2, -dq + 2); dr++) {
            const hDist = hexDistance(0, 0, dq, dr);
            if (hDist === 0) continue;
            const candidate = layer.map.get(`${curAx.q + dq},${curAx.r + dr}`);
            if (!candidate) continue;

            if (candidate.status !== 'solid' && !(candidate.status === 'regenerating' && candidate.timer < 0.15)) {
              continue;
            }

            // Считаем сколько твёрдых соседей у этой плитки (чтобы бот не загонял себя в тупик)
            let solidNeighbors = 0;
            const nDirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
            for (const [nq, nr] of nDirs) {
              const nb = layer.map.get(`${candidate.q + nq},${candidate.r + nr}`);
              if (nb && nb.status === 'solid') solidNeighbors++;
            }

            let score = solidNeighbors * 12;
            if (hDist === 1) score += 18; // шаг на соседнюю клетку надёжнее прыжка через пропасть
            if (candidate.specialType === 'gold') score += 15;
            if (candidate.specialType === 'bomb') score -= 12;

            // Небольшой штраф за край арены
            const centerDist = hexDistance(0, 0, candidate.q, candidate.r);
            score -= centerDist * 2.5;

            // Добавляем шум в зависимости от IQ бота
            score += (Math.random() - 0.5) * (1.2 - config.botIQ) * 45;

            if (score > bestScore) {
              bestScore = score;
              bestTile = candidate;
            }
          }
        }
        bot.aiTargetTile = bestTile;
      }
    }

    // Двигаемся к выбранной плитке
    if (bot.aiTargetTile) {
      const dx = bot.aiTargetTile.x - bot.x;
      const dy = bot.aiTargetTile.y - bot.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 6) {
        const targetAngle = Math.atan2(dy, dx);
        bot.facing = targetAngle;

        const baseSpeed = 165 * (bot.buffs.speed > 0 ? 1.42 : 1.0);
        const desiredVx = Math.cos(targetAngle) * baseSpeed;
        const desiredVy = Math.sin(targetAngle) * baseSpeed;

        bot.vx += (desiredVx - bot.vx) * Math.min(1, dt * 10);
        bot.vy += (desiredVy - bot.vy) * Math.min(1, dt * 10);

        // Если между ботом и целевой плиткой дыра или дистанция > 1 соты — прыгаем!
        if (bot.onGround && (dist > HEX_RADIUS * 1.95 || !curTile || curTile.status === 'falling')) {
          if (Math.random() < 0.35 + config.botIQ * 0.55) {
            bot.jump();
          }
        }
      }
    }

    // Умные боты иногда делают рывок-толчок, если рядом соперник или нужно перелететь пропасть
    if (!bot.onGround && bot.vz < -20 && bot.diveCooldown <= 0 && bot.aiTargetTile) {
      const distToTarget = Math.hypot(bot.aiTargetTile.x - bot.x, bot.aiTargetTile.y - bot.y);
      if (distToTarget > 45 && Math.random() < config.botIQ * 0.25) {
        bot.dive();
      }
    }
  }

  // ==================== ФИЗИКА И ОБНОВЛЕНИЕ МИРА ====================
  function updateWorld(dt) {
    // Плавный поворот камеры
    state.cameraYaw += (state.targetCameraYaw - state.cameraYaw) * Math.min(1, dt * 8);

    if (state.phase === 'countdown') {
      const prevCeil = Math.ceil(state.countdownTimer);
      state.countdownTimer -= dt;
      const newCeil = Math.ceil(state.countdownTimer);

      const cdText = document.getElementById('countdown-text');
      if (newCeil !== prevCeil && newCeil > 0) {
        cdText.textContent = String(newCeil);
        sfx.play('count');
      }
      if (state.countdownTimer <= 0) {
        state.phase = 'playing';
        cdText.textContent = 'ВПЕРЁД!';
        sfx.play('powerup');
        setTimeout(() => {
          document.getElementById('countdown-overlay').classList.add('hidden');
        }, 550);
      }
      return;
    }

    if (state.phase !== 'playing') return;

    const simDt = dt * (state.player && !state.player.alive ? state.spectateSpeed : 1);
    state.elapsed += simDt;

    // 1. Периодический спавн бонусов и специальных событий арены
    state.powerupSpawnTimer -= simDt;
    if (state.powerupSpawnTimer <= 0) {
      state.powerupSpawnTimer = state.config.powerupInterval;
      if (state.powerups.length < 7) {
        spawnPowerup();
      }
    }

    state.eventTimer -= simDt;
    if (state.eventTimer <= 0) {
      state.eventTimer = 18.0;
      triggerArenaEvent();
    }

    // 2. Обновляем все гекса-плитки на всех ярусах
    for (const layer of state.layers) {
      for (const tile of layer.list) {
        tile.update(simDt, state.config, layer.map);
      }
    }

    // 3. Управление игроком
    const p = state.player;
    if (p && p.alive) {
      let moveX = 0;
      let moveY = 0;

      if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

      if (joystick.active) {
        moveX += joystick.dx;
        moveY += joystick.dy;
      }

      const len = Math.hypot(moveX, moveY);
      if (len > 0.05 && !p.isDiving) {
        const nx = moveX / Math.max(1, len);
        const ny = moveY / Math.max(1, len);

        // Переводим экранный вектор в мировые координаты с учётом поворота камеры
        const cosA = Math.cos(-state.cameraYaw);
        const sinA = Math.sin(-state.cameraYaw);
        const worldDirX = nx * cosA - ny * sinA;
        const worldDirY = nx * sinA + ny * cosA;

        p.facing = Math.atan2(worldDirY, worldDirX);
        const maxSpeed = 178 * (p.buffs.speed > 0 ? 1.45 : 1.0);
        const targetVx = worldDirX * maxSpeed * Math.min(1, len);
        const targetVy = worldDirY * maxSpeed * Math.min(1, len);

        const accel = p.onGround ? 12 : 6.5;
        p.vx += (targetVx - p.vx) * Math.min(1, simDt * accel);
        p.vy += (targetVy - p.vy) * Math.min(1, simDt * accel);
      } else if (!p.isDiving) {
        const friction = p.onGround ? 10 : 2.5;
        p.vx *= Math.max(0, 1 - simDt * friction);
        p.vy *= Math.max(0, 1 - simDt * friction);
      }
    }

    // 4. Обновляем всех участников (физика, коллизии с гексагонами, боты)
    const abyssZ = -LAYER_GAP - 160;

    for (const actor of state.actors) {
      if (!actor.alive) continue;

      actor.survivalTime = state.elapsed;
      actor.score += simDt * 12 * state.config.scoreMult;

      // Обновляем таймеры баффов
      for (const k of Object.keys(actor.buffs)) {
        if (actor.buffs[k] > 0) {
          actor.buffs[k] = Math.max(0, actor.buffs[k] - simDt);
        }
      }

      if (actor.diveCooldown > 0) actor.diveCooldown = Math.max(0, actor.diveCooldown - simDt);
      if (actor.isDiving) {
        actor.diveTimer -= simDt;
        if (actor.diveTimer <= 0) actor.isDiving = false;
      }

      if (!actor.isPlayer) {
        updateBotAI(actor, simDt, state.config);
      }

      const prevZ = actor.z;
      actor.x += actor.vx * simDt;
      actor.y += actor.vy * simDt;

      // Гравитация (с «Грави-перьями» падение плавнее)
      const gravity = actor.buffs.feather > 0 && actor.vz < 0 ? 480 : 760;
      actor.vz -= gravity * simDt;
      actor.z += actor.vz * simDt;

      const speedHoriz = Math.hypot(actor.vx, actor.vy);
      if (speedHoriz > 15 && actor.onGround) {
        actor.walkCycle += simDt * (speedHoriz * 0.085);
      }

      // Проверяем приземление на гекса-плитки каждого яруса
      actor.onGround = false;

      for (const layer of state.layers) {
        const surfaceZ = layer.zHeight;
        // Проверяем, пересекает ли актёр плоскость яруса сверху вниз
        if (prevZ >= surfaceZ - 8 && actor.z <= surfaceZ + 6 && actor.vz <= 0) {
          // Проверяем осевую плитку под центром и 6 точек вокруг стоп персонажа
          const checkOffsets = [
            [0, 0],
            [actor.radius * 0.55, 0],
            [-actor.radius * 0.55, 0],
            [0, actor.radius * 0.55],
            [0, -actor.radius * 0.55]
          ];

          let landedTile = null;
          for (const [ox, oy] of checkOffsets) {
            const ax = worldToAxial(actor.x + ox, actor.y + oy);
            const t = layer.map.get(`${ax.q},${ax.r}`);
            if (t && (t.status === 'solid' || t.status === 'cracking')) {
              landedTile = t;
              break;
            }
          }

          if (landedTile) {
            actor.z = surfaceZ;
            actor.vz = 0;
            actor.onGround = true;
            actor.jumpCount = 0;
            actor.currentLayer = layer.index;
            landedTile.triggerStep(actor, state.config);
            break;
          }
        }
      }

      // Подбор бонусов
      for (let i = state.powerups.length - 1; i >= 0; i--) {
        const pu = state.powerups[i];
        if (Math.abs(actor.z - pu.z) < 42 && Math.hypot(actor.x - pu.x, actor.y - pu.y) < 34) {
          applyPowerup(actor, pu);
          state.powerups.splice(i, 1);
        }
      }

      // Проверка падения в слизь (пропасть внизу)
      if (actor.z < abyssZ) {
        // Если есть активный «Батут-спасение» (shield) — катапультируем обратно на нижний ярус!
        if (actor.buffs.shield > 0) {
          actor.buffs.shield = 0;
          const bottomLayer = state.layers[state.layers.length - 1];
          actor.z = bottomLayer.zHeight + 90;
          actor.vz = 420;
          actor.x *= 0.3;
          actor.y *= 0.3;
          // Чиним центральную плитку под ним, чтобы было куда приземлиться
          const cAx = worldToAxial(actor.x, actor.y);
          const cTile = bottomLayer.map.get(`${cAx.q},${cAx.r}`) || bottomLayer.map.get('0,0');
          if (cTile) cTile.instantRepair();

          sfx.play('spring');
          spawnShockwave(actor.x, actor.y, bottomLayer.zHeight, 120, '#ffd740');
          if (actor.isPlayer) {
            addFeedItem('🛡️ Батут-спасение вернул вас из пропасти!', '#ffd740');
          }
        } else {
          actor.alive = false;
          state.eliminationOrder.push(actor);
          sfx.play('elim');
          spawnParticles(actor.x, actor.y, abyssZ + 20, '#ff2a85', 22);
          addFeedItem(`💦 ${actor.name} упал в слизь!`, actor.isPlayer ? '#00e5ff' : '#ff2a85');

          if (actor.isPlayer) {
            onPlayerEliminated();
          }
        }
      }
    }

    // 5. Мягкие столкновения между живыми участниками (толкание плечами)
    const aliveList = state.actors.filter(a => a.alive);
    for (let i = 0; i < aliveList.length; i++) {
      for (let j = i + 1; j < aliveList.length; j++) {
        const a = aliveList[i];
        const b = aliveList[j];
        if (Math.abs(a.z - b.z) < 34) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.radius + b.radius;
          if (dist < minDist && dist > 0.01) {
            const overlap = (minDist - dist) * 0.5;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;

            const push = 95;
            a.vx -= nx * push * simDt * 10;
            a.vy -= ny * push * simDt * 10;
            b.vx += nx * push * simDt * 10;
            b.vy += ny * push * simDt * 10;
          }
        }
      }
    }

    // 6. Обновление бонусов на арене, частиц и волн
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const pu = state.powerups[i];
      pu.life -= simDt;
      pu.bobPhase += simDt * 4;
      if (pu.life <= 0) state.powerups.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= simDt;
      pt.x += pt.vx * simDt;
      pt.y += pt.vy * simDt;
      pt.z += pt.vz * simDt;
      pt.vz -= 380 * simDt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.life -= simDt;
      sw.radius = sw.maxRadius * (1 - sw.life / sw.maxLife);
      if (sw.life <= 0) state.shockwaves.splice(i, 1);
    }

    // 7. Слежение камеры за игроком или наблюдаемым ботом
    let focusActor = state.player;
    if (!focusActor || !focusActor.alive) {
      if (!state.spectateTarget || !state.spectateTarget.alive) {
        state.spectateTarget = aliveList[0] || state.player;
      }
      focusActor = state.spectateTarget;
      if (focusActor) {
        document.getElementById('spec-target-name').textContent =
          `Наблюдаем за: ${focusActor.name} (Ярус ${focusActor.currentLayer + 1})`;
      }
    }

    if (focusActor) {
      state.camX += (focusActor.x - state.camX) * Math.min(1, dt * 6.5);
      state.camY += (focusActor.y - state.camY) * Math.min(1, dt * 6.5);
      state.camZ += (focusActor.z - state.camZ) * Math.min(1, dt * 5.0);
    }

    // 8. Проверка завершения матча (остался 1 победитель или 0)
    if (aliveList.length <= 1) {
      finishMatch(aliveList[0] || state.eliminationOrder[state.eliminationOrder.length - 1]);
    }

    updateHUD();
  }

  function triggerArenaEvent() {
    const roll = Math.random();
    const banner = document.getElementById('event-banner');
    banner.classList.remove('hidden');

    if (roll < 0.4) {
      banner.textContent = '🎁 СОБЫТИЕ: ДОЖДЬ БОНУСОВ НА ВСЕХ ЯРУСАХ!';
      for (let i = 0; i < 4; i++) spawnPowerup();
    } else if (roll < 0.75) {
      banner.textContent = '🛠️ СОБЫТИЕ: ВОЛНА РЕГЕНЕРАЦИИ СОТ!';
      for (const layer of state.layers) {
        layer.list.forEach(t => {
          if (t.status === 'regenerating' && Math.random() < 0.55) {
            t.instantRepair();
          }
        });
      }
      sfx.play('regen');
    } else {
      banner.textContent = '⚡ СОБЫТИЕ: НИЗКАЯ ГРАВИТАЦИЯ ВСЕМ (5 СЕК)!';
      state.actors.forEach(a => {
        if (a.alive) a.buffs.feather = Math.max(a.buffs.feather, 5.0);
      });
      sfx.play('powerup');
    }

    setTimeout(() => {
      banner.classList.add('hidden');
    }, 4200);
  }

  function onPlayerEliminated() {
    const aliveCount = state.actors.filter(a => a.alive).length;
    if (aliveCount > 1) {
      document.getElementById('spectator-bar').classList.remove('hidden');
    }
  }

  function finishMatch(winner) {
    if (state.phase === 'gameover') return;
    state.phase = 'gameover';
    document.getElementById('spectator-bar').classList.add('hidden');

    // Формируем итоговый список мест
    const aliveRemaining = state.actors.filter(a => a.alive);
    const standings = [...aliveRemaining];
    for (let i = state.eliminationOrder.length - 1; i >= 0; i--) {
      const a = state.eliminationOrder[i];
      if (!standings.includes(a)) standings.push(a);
    }

    const playerPlace = standings.findIndex(a => a.isPlayer) + 1;
    const p = state.player;
    const isVictory = playerPlace === 1;

    if (isVictory) {
      p.score += Math.round(500 * state.config.scoreMult);
      saveData.crowns += 1;
      saveData.recordsByDiff[state.diffKey].wins += 1;
      sfx.play('win');
    }

    const finalScore = Math.round(p.score);
    saveData.totalScore += finalScore;
    saveData.matchesPlayed += 1;
    if (p.survivalTime > saveData.bestSurvivalSec) {
      saveData.bestSurvivalSec = p.survivalTime;
    }

    const rec = saveData.recordsByDiff[state.diffKey];
    if (p.survivalTime > rec.bestTime) rec.bestTime = p.survivalTime;
    if (finalScore > rec.bestScore) rec.bestScore = finalScore;

    saveGameData();
    updateHUD();

    // Заполняем модальное окно результатов
    document.getElementById('result-ribbon').textContent = isVictory ? 'ЧЕМПИОН ШОУ!' : 'РАУНД ЗАВЕРШЁН';
    document.getElementById('result-title').textContent = isVictory
      ? 'ПОБЕДА! КОРОНА ВАША! 👑'
      : `ВЫ ЗАНЯЛИ #${playerPlace} МЕСТО!`;
    document.getElementById('result-subtitle').textContent = isVictory
      ? 'Вы перепрыгали всех соперников на многоярусной арене!'
      : `Победитель раунда: ${winner ? winner.name : 'Бот'} 👑`;

    document.getElementById('res-place').textContent = `#${playerPlace}`;
    document.getElementById('res-time').textContent = formatTime(p.survivalTime);
    document.getElementById('res-tiles').textContent = String(p.tilesBroken);
    document.getElementById('res-score').textContent = `+${finalScore}`;

    const standingsEl = document.getElementById('match-standings');
    standingsEl.innerHTML = '';
    standings.slice(0, 8).forEach((act, idx) => {
      const row = document.createElement('div');
      row.className = 'standing-row' + (act.isPlayer ? ' is-player' : '');
      const medal = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
      row.innerHTML = `
        <span>${medal} <strong>${act.name}</strong> ${act.isPlayer ? '(Вы)' : ''}</span>
        <span>⏱️ ${formatTime(act.survivalTime)} • ⭐ ${Math.round(act.score)}</span>
      `;
      standingsEl.appendChild(row);
    });

    setTimeout(() => {
      document.getElementById('result-modal').classList.remove('hidden');
    }, 500);
  }

  // ==================== 3D ИЗОМЕТРИЧЕСКИЙ РЕНДЕРИНГ НА CANVAS ====================
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Проекция мировых координат (x, y, z) в экранные (sx, sy, depth)
  function project3D(wx, wy, wz) {
    const dx = wx - state.camX;
    const dy = wy - state.camY;
    const dz = wz - state.camZ;

    const cosA = Math.cos(state.cameraYaw);
    const sinA = Math.sin(state.cameraYaw);

    const rx = dx * cosA - dy * sinA;
    const ry = dx * sinA + dy * cosA;

    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.54;

    const sx = cx + rx;
    const sy = cy + ry * state.cameraPitch - dz * 0.82;
    const depth = ry - dz * 0.45; // для сортировки художника (painter's algorithm)
    return { sx, sy, depth, rx, ry };
  }

  function drawHexPrism(sx, sy, radius, thickness, topColor, sideColor, strokeColor, alpha = 1) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = state.cameraYaw + (Math.PI / 6) + i * (Math.PI / 3);
      pts.push({
        x: sx + Math.cos(ang) * radius,
        y: sy + Math.sin(ang) * radius * state.cameraPitch
      });
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Боковая грань (3D толщина соты)
    if (thickness > 1) {
      ctx.fillStyle = sideColor;
      ctx.beginPath();
      // Находим самую левую и самую правую вершины, чтобы замкнуть нижний силуэт призмы
      for (let i = 0; i < 6; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % 6];
        // Рисуем передние грани, у которых нормаль смотрит вниз экрана
        if (p1.y + p2.y > sy * 2 - 4) {
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p2.x, p2.y + thickness);
          ctx.lineTo(p1.x, p1.y + thickness);
          ctx.closePath();
        }
      }
      ctx.fill();
    }

    // Верхняя крышка соты
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    // Внутренний глянцевый контур как в Fall Guys
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ix = sx + (pts[i].x - sx) * 0.72;
      const iy = sy + (pts[i].y - sy) * 0.72;
      if (i === 0) ctx.moveTo(ix, iy);
      else ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  function drawFallGuyCharacter(actor, proj) {
    const { sx, sy } = proj;
    ctx.save();

    // Тень под персонажем на ближайшем ярусе
    for (const layer of state.layers) {
      if (actor.z >= layer.zHeight - 5) {
        const ax = worldToAxial(actor.x, actor.y);
        const t = layer.map.get(`${ax.q},${ax.r}`);
        if (t && (t.status === 'solid' || t.status === 'cracking')) {
          const shProj = project3D(actor.x, actor.y, layer.zHeight);
          const heightDiff = Math.max(0, actor.z - layer.zHeight);
          const shScale = Math.max(0.3, 1 - heightDiff / 220);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
          ctx.beginPath();
          ctx.ellipse(shProj.sx, shProj.sy, 14 * shScale, 8 * shScale, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }

    // Если активен «Призрачный шаг» — полупрозрачность и бирюзовое свечение
    if (actor.buffs.ghost > 0) {
      ctx.globalAlpha = 0.65;
    }

    // Аура «Батут-спасение» (щит)
    if (actor.buffs.shield > 0) {
      ctx.strokeStyle = '#ffd740';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy - 16, 23, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bob = actor.onGround ? Math.abs(Math.sin(actor.walkCycle)) * 4 : 0;
    const legSwing = actor.onGround ? Math.sin(actor.walkCycle) * 5 : 4;

    ctx.translate(sx, sy - bob);
    if (actor.isDiving) {
      const screenAng = actor.facing + state.cameraYaw;
      ctx.rotate(Math.cos(screenAng) * 0.45);
    }

    // Ножки
    ctx.fillStyle = actor.skin.c2;
    ctx.beginPath();
    ctx.roundRect(-9, -7 + legSwing * 0.5, 6, 9, 3);
    ctx.roundRect(3, -7 - legSwing * 0.5, 6, 9, 3);
    ctx.fill();

    // Тело-боб (Fall Guys Bean)
    const grad = ctx.createLinearGradient(-12, -34, 12, -4);
    grad.addColorStop(0, actor.skin.c1);
    grad.addColorStop(1, actor.skin.c2);

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#120924';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-13, -34, 26, 29, 13);
    ctx.fill();
    ctx.stroke();

    // Белое лицевое окошко (Visor)
    const screenDirX = Math.cos(actor.facing + state.cameraYaw) * 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(screenDirX, -22, 8.5, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#120924';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Глазки-бусинки
    ctx.fillStyle = '#120924';
    ctx.beginPath();
    ctx.arc(screenDirX - 3, -22, 1.8, 0, Math.PI * 2);
    ctx.arc(screenDirX + 3, -22, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Шапка / корона сверху
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(actor.skin.hat, 0, -37);

    // Имя и маркер игрока
    ctx.font = actor.isPlayer ? '900 12px sans-serif' : '700 10px sans-serif';
    const labelY = -52;
    if (actor.isPlayer) {
      ctx.fillStyle = '#ffe600';
      ctx.fillText('▼ ВЫ', 0, labelY - 12);
    }
    ctx.fillStyle = 'rgba(12, 8, 30, 0.75)';
    const tw = ctx.measureText(actor.name).width + 10;
    ctx.beginPath();
    ctx.roundRect(-tw / 2, labelY - 10, tw, 14, 5);
    ctx.fill();

    ctx.fillStyle = actor.isPlayer ? '#00e5ff' : '#ffffff';
    ctx.fillText(actor.name, 0, labelY);

    ctx.restore();
  }

  function renderScene() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Фоновая неоновая сетка слизи внизу
    const slimeProj = project3D(0, 0, -LAYER_GAP - 140);
    const slimeGrad = ctx.createRadialGradient(w * 0.5, slimeProj.sy, 30, w * 0.5, slimeProj.sy, Math.max(w, h) * 0.75);
    slimeGrad.addColorStop(0, 'rgba(255, 42, 133, 0.22)');
    slimeGrad.addColorStop(0.5, 'rgba(124, 77, 255, 0.10)');
    slimeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = slimeGrad;
    ctx.fillRect(0, 0, w, h);

    // Собираем все 3D-объекты в единый список для честной сортировки по глубине и высоте
    const renderQueue = [];

    // 1. Гекса-плитки всех ярусов
    for (const layer of state.layers) {
      const theme = LAYER_THEMES[layer.index % LAYER_THEMES.length];
      for (const tile of layer.list) {
        const z = tile.baseZ + tile.fallOffsetZ;
        const proj = project3D(tile.x, tile.y, z);
        renderQueue.push({
          kind: 'tile',
          tile,
          theme,
          proj,
          sortKey: z * 1000 - proj.depth
        });
      }
    }

    // 2. Ударные волны
    for (const sw of state.shockwaves) {
      const proj = project3D(sw.x, sw.y, sw.z);
      renderQueue.push({
        kind: 'shockwave',
        sw,
        proj,
        sortKey: sw.z * 1000 - proj.depth + 5
      });
    }

    // 3. Бонусы на арене
    for (const pu of state.powerups) {
      const z = pu.z + Math.sin(pu.bobPhase) * 6;
      const proj = project3D(pu.x, pu.y, z);
      renderQueue.push({
        kind: 'powerup',
        pu,
        proj,
        sortKey: z * 1000 - proj.depth + 20
      });
    }

    // 4. Живые участники
    for (const actor of state.actors) {
      if (!actor.alive) continue;
      const proj = project3D(actor.x, actor.y, actor.z);
      renderQueue.push({
        kind: 'actor',
        actor,
        proj,
        sortKey: actor.z * 1000 - proj.depth + 35
      });
    }

    // 5. Частицы
    for (const pt of state.particles) {
      const proj = project3D(pt.x, pt.y, pt.z);
      renderQueue.push({
        kind: 'particle',
        pt,
        proj,
        sortKey: pt.z * 1000 - proj.depth + 40
      });
    }

    // Сортируем от дальних/нижних к ближним/верхним
    renderQueue.sort((a, b) => a.sortKey - b.sortKey);

    // Отрисовка очереди
    for (const item of renderQueue) {
      if (item.kind === 'tile') {
        const { tile, theme, proj } = item;
        let topCol = theme.top;
        let sideCol = theme.side;
        let strokeCol = 'rgba(255,255,255,0.55)';
        let alpha = 1;
        let drawX = proj.sx;
        let drawY = proj.sy;

        // Оформление спец-плиток
        if (tile.specialType === 'spring') {
          topCol = '#00e676';
          sideCol = '#009624';
        } else if (tile.specialType === 'gold') {
          topCol = '#ffd740';
          sideCol = '#c68400';
        } else if (tile.specialType === 'bomb') {
          topCol = '#ff5252';
          sideCol = '#b71c1c';
        }

        if (tile.status === 'cracking') {
          const blink = Math.sin(performance.now() * 0.045) > 0;
          topCol = blink ? theme.crack : theme.danger;
          drawX += (Math.random() - 0.5) * 3.5;
          drawY += (Math.random() - 0.5) * 2.5;
        } else if (tile.status === 'falling') {
          topCol = theme.danger;
          alpha = Math.max(0.15, tile.scale);
        } else if (tile.status === 'regenerating') {
          // Голографический контур восстанавливающейся соты!
          if (tile.timer > 0.7) {
            drawHexPrism(drawX, drawY, HEX_RADIUS * 0.85, 0, 'rgba(0, 229, 255, 0.07)', 'transparent', 'rgba(0, 229, 255, 0.25)', 0.65);
            continue;
          } else {
            alpha = 0.45 + tile.scale * 0.55;
            strokeCol = '#00e5ff';
          }
        }

        const r = (HEX_RADIUS - 2) * (tile.status === 'solid' || tile.status === 'cracking' ? 1 : tile.scale);
        drawHexPrism(drawX, drawY, r, 11, topCol, sideCol, strokeCol, alpha);

        // Иконка спец-плитки в центре соты
        if (tile.status === 'solid' && tile.specialType !== 'normal') {
          ctx.save();
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const icon = tile.specialType === 'spring' ? '⏫' : tile.specialType === 'gold' ? '⭐' : '💣';
          ctx.fillText(icon, drawX, drawY);
          ctx.restore();
        }
      } else if (item.kind === 'shockwave') {
        const { sw, proj } = item;
        ctx.save();
        ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(proj.sx, proj.sy, sw.radius, sw.radius * state.cameraPitch, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (item.kind === 'powerup') {
        const { pu, proj } = item;
        ctx.save();
        ctx.fillStyle = pu.type.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy - 8, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pu.type.icon, proj.sx, proj.sy - 7);
        ctx.restore();
      } else if (item.kind === 'actor') {
        drawFallGuyCharacter(item.actor, item.proj);
      } else if (item.kind === 'particle') {
        const { pt, proj } = item;
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ==================== ОБНОВЛЕНИЕ HUD И МОДАЛЬНЫХ ОКОН ====================
  function formatTime(sec) {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    const s = Math.floor(rem);
    const tenths = Math.floor((rem - s) * 10);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
  }

  function updateHUD() {
    const aliveCount = state.actors.filter(a => a.alive).length;
    const totalCount = state.actors.length || (1 + state.config.botsCount);

    document.getElementById('hud-mode-label').textContent = state.config.name;
    document.getElementById('hud-alive').textContent = `${aliveCount} / ${totalCount}`;

    const p = state.player;
    const curLayer = p ? p.currentLayer + 1 : 1;
    document.getElementById('hud-layer').textContent = `${curLayer} / ${state.config.layersCount}`;
    document.getElementById('hud-timer').textContent = formatTime(state.elapsed);
    document.getElementById('hud-score').textContent = String(p ? Math.round(p.score) : 0);
    document.getElementById('hud-crowns').textContent = String(saveData.crowns);

    // Откат рывка
    const cdDiveEl = document.getElementById('cd-dive');
    if (p && p.diveCooldown > 0) {
      cdDiveEl.style.height = `${(p.diveCooldown / 2.0) * 100}%`;
    } else {
      cdDiveEl.style.height = '0%';
    }

    // Отрисовка активных баффов игрока слева
    const buffsContainer = document.getElementById('active-buffs');
    if (p && p.alive) {
      let html = '';
      for (const puType of POWERUP_TYPES) {
        if (!puType.instant && p.buffs[puType.id] > 0) {
          const pct = Math.min(100, (p.buffs[puType.id] / puType.duration) * 100);
          html += `
            <div class="buff-pill" style="border-color:${puType.color}">
              <span class="buff-icon">${puType.icon}</span>
              <div class="buff-meta">
                <span class="buff-name">${puType.name} (${p.buffs[puType.id].toFixed(1)}с)</span>
                <div class="buff-bar-wrap">
                  <div class="buff-bar-fill" style="width:${pct}%; background:${puType.color}"></div>
                </div>
              </div>
            </div>
          `;
        }
      }
      buffsContainer.innerHTML = html;
    } else {
      buffsContainer.innerHTML = '';
    }
  }

  function getRankTitle(crowns) {
    if (crowns >= 15) return '👑 Легенда Гексагона';
    if (crowns >= 8) return '💎 Алмазный Прыгун';
    if (crowns >= 4) return '🔥 Мастер Арены';
    if (crowns >= 1) return '⭐ Обладатель Короны';
    return '🐣 Новичок Шоу';
  }

  function openLeaderboard() {
    const tbody = document.getElementById('lb-tbody');
    const combined = [
      ...saveData.rivalStandings.map(r => ({ ...r, isMe: false })),
      {
        name: saveData.playerName || 'Чемпион_01',
        crowns: saveData.crowns,
        bestTime: saveData.bestSurvivalSec,
        score: saveData.totalScore,
        isMe: true
      }
    ].sort((a, b) => b.crowns - a.crowns || b.score - a.score);

    tbody.innerHTML = '';
    combined.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      if (entry.isMe) tr.className = 'me-row';
      tr.innerHTML = `
        <td>#${idx + 1}</td>
        <td>${entry.name} ${entry.isMe ? '(Вы)' : ''}</td>
        <td>${getRankTitle(entry.crowns)}</td>
        <td>👑 ${entry.crowns}</td>
        <td>${formatTime(entry.bestTime)}</td>
        <td>⭐ ${entry.score}</td>
      `;
      tbody.appendChild(tr);
    });

    const recGrid = document.getElementById('records-grid');
    recGrid.innerHTML = '';
    Object.keys(DIFFICULTIES).forEach(key => {
      const d = DIFFICULTIES[key];
      const r = saveData.recordsByDiff[key] || { wins: 0, bestTime: 0, bestScore: 0 };
      const card = document.createElement('div');
      card.className = 'record-card';
      card.innerHTML = `
        <strong style="color:#00e5ff; font-size:15px">${d.name}</strong>
        <div style="margin-top:6px; font-size:13px; line-height:1.6">
          <div>👑 Побед в режиме: <strong>${r.wins}</strong></div>
          <div>⏱️ Лучшее время: <strong>${formatTime(r.bestTime)}</strong></div>
          <div>⭐ Рекорд очков: <strong>${r.bestScore}</strong></div>
        </div>
      `;
      recGrid.appendChild(card);
    });

    document.getElementById('lb-modal').classList.remove('hidden');
  }

  function openStartModal() {
    document.getElementById('start-modal').classList.remove('hidden');
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('lb-modal').classList.add('hidden');
  }

  function toggleSound() {
    sfx.muted = !sfx.muted;
    document.getElementById('btn-sound').textContent = sfx.muted ? '🔇' : '🔊';
  }

  // ==================== ПРИВЯЗКА UI СОБЫТИЙ ====================
  // Выбор сложности
  document.querySelectorAll('.diff-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.diffKey = card.dataset.diff;
      saveData.difficulty = state.diffKey;
      saveGameData();
    });
  });

  // Выбор скина
  document.querySelectorAll('.skin-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.skin-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveData.skinIndex = Number(btn.dataset.skin) || 0;
      saveGameData();
    });
  });

  // Ввод никнейма
  const nameInput = document.getElementById('player-name-input');
  nameInput.value = saveData.playerName || 'Чемпион_01';
  nameInput.addEventListener('input', () => {
    saveData.playerName = nameInput.value.trim() || 'Чемпион_01';
    saveGameData();
  });

  // Кнопки запуска и навигации
  document.getElementById('btn-start-match').addEventListener('click', () => {
    saveData.playerName = nameInput.value.trim() || 'Чемпион_01';
    saveGameData();
    startMatch();
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    startMatch();
  });

  document.getElementById('btn-result-settings').addEventListener('click', openStartModal);
  document.getElementById('btn-menu').addEventListener('click', openStartModal);
  document.getElementById('btn-sound').addEventListener('click', toggleSound);

  document.getElementById('btn-leaderboard').addEventListener('click', openLeaderboard);
  document.getElementById('btn-open-lb-from-start').addEventListener('click', openLeaderboard);
  document.getElementById('btn-result-lb').addEventListener('click', openLeaderboard);
  document.getElementById('btn-close-lb').addEventListener('click', () => {
    document.getElementById('lb-modal').classList.add('hidden');
  });

  // Переключение вкладок лидерборда
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isGlobal = tab.dataset.tab === 'global';
      document.getElementById('lb-content-global').classList.toggle('hidden', !isGlobal);
      document.getElementById('lb-content-records').classList.toggle('hidden', isGlobal);
    });
  });

  // Кнопки режима наблюдения
  document.getElementById('btn-spec-fast').addEventListener('click', (e) => {
    state.spectateSpeed = state.spectateSpeed === 1 ? 2.5 : 1;
    e.currentTarget.textContent = state.spectateSpeed > 1 ? '⏩ Скорость x2.5 (Вкл)' : '⏩ Ускорить x2';
  });

  document.getElementById('btn-spec-skip').addEventListener('click', () => {
    const aliveList = state.actors.filter(a => a.alive);
    finishMatch(aliveList[0] || state.player);
  });

  // ==================== ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ ====================
  // Генерируем фоновую арену сразу для красивого превью за стартовым меню
  buildArena(state.config);
  updateHUD();

  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state.phase === 'menu') {
      // Медленное вращение камеры вокруг арены в главном меню
      state.cameraYaw += dt * 0.18;
      state.targetCameraYaw = state.cameraYaw;
    } else {
      updateWorld(dt);
    }

    renderScene();
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
