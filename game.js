/**
 * ГЕКСА-ГОНКА 3D (Hex-A-Fall Showdown v2.0)
 * Обновление по фидбеку:
 * 1. Близкая следящая камера с зумом и свободным вращением (мышь drag / Q, E / кнопки / колёсико), размеренный темп игры.
 * 2. Плавное разрушение сот: один раз меняют цвет -> плавно падают вниз и растворяются через прозрачность без резкого мерцания.
 * 3. Полноценные персонажи-фасолинки (Fall Guys Beans) с ручками, ножками, визором, узорами костюмов, шляпами и гардеробом.
 * 4. Строго пропорциональное восстановление (FIFO очередь): первая разрушенная сота восстанавливается первой с тем же интервалом.
 * 5. Плавный старт с отсчётом 3..2..1..СТАРТ! и торжественная финальная плашка Победителя перед таблицей итогов.
 * 6. Генератор смешных рандомных никнеймов над головами всех ботов.
 * 7. Полноценные процедурные анимации фасолинок: дыхание (idle), бег с махами ручек/ножек, прыжок, нырок «рыбкой», приземление (squash & stretch) и победный танец.
 */

(() => {
  'use strict';

  // ==================== 1. КОНФИГУРАЦИЯ СЛОЖНОСТИ (РАЗМЕРЕННЫЙ ТЕМП) ====================
  const DIFFICULTIES = {
    easy: {
      id: 'easy',
      name: 'Чилл-Разминка',
      botsCount: 7,
      layersCount: 2,
      gridRadius: 5,
      stepHoldTime: 1.40,   // сота меняет цвет и держит 1.4 сек перед падением
      fallDuration: 0.95,   // плавное падение и растворение через прозрачность
      regenDelay: 7.0,      // базовое время до старта восстановления первой соты в очереди
      botIQ: 0.48,
      powerupInterval: 5.0,
      specialTileChance: 0.08,
      scoreMult: 1.0
    },
    normal: {
      id: 'normal',
      name: 'Классика шоу',
      botsCount: 9,
      layersCount: 3,
      gridRadius: 5,
      stepHoldTime: 1.05,   // 1.05 сек — комфортно видеть смену цвета и планировать прыжки
      fallDuration: 0.90,
      regenDelay: 8.5,
      botIQ: 0.72,
      powerupInterval: 4.5,
      specialTileChance: 0.12,
      scoreMult: 1.5
    },
    hard: {
      id: 'hard',
      name: 'Кибер-Финал',
      botsCount: 11,
      layersCount: 3,
      gridRadius: 6,
      stepHoldTime: 0.75,
      fallDuration: 0.85,
      regenDelay: 10.0,
      botIQ: 0.90,
      powerupInterval: 4.5,
      specialTileChance: 0.16,
      scoreMult: 2.2
    },
    chaos: {
      id: 'chaos',
      name: 'Мега-Хаос',
      botsCount: 14,
      layersCount: 4,
      gridRadius: 6,
      stepHoldTime: 0.85,
      fallDuration: 0.85,
      regenDelay: 7.5,
      botIQ: 0.80,
      powerupInterval: 2.8,
      specialTileChance: 0.28,
      scoreMult: 2.5
    }
  };

  // Цветовые темы ярусов:
  // top/side — исходный цвет соты; steppedTop/steppedSide — единый цвет после наступания (без мигания!)
  const LAYER_THEMES = [
    {
      name: 'Лазурный Верх',
      top: '#00d8ff',
      side: '#0086a8',
      steppedTop: '#ff9800',  // тёплый янтарно-оранжевый при наступании
      steppedSide: '#b25900'
    },
    {
      name: 'Солнечный Экватор',
      top: '#ffd600',
      side: '#b28900',
      steppedTop: '#ff4081',  // кораллово-розовый при наступании
      steppedSide: '#a00037'
    },
    {
      name: 'Неоновый Аметист',
      top: '#b388ff',
      side: '#651fff',
      steppedTop: '#ff6d00',  // мандариновый при наступании
      steppedSide: '#a63f00'
    },
    {
      name: 'Изумрудное Дно',
      top: '#00e676',
      side: '#008c44',
      steppedTop: '#ff5252',  // мягкий рубиновый при наступании
      steppedSide: '#9b0000'
    }
  ];

  // Полноценные костюмы фасолинок (с узорами и аксессуарами для будущих скинов)
  const SKINS = [
    { id: 0, title: 'Королевский Розовый', c1: '#ff3864', c2: '#ffe600', visor: '#ffffff', pattern: 'pants',   hat: 'crown' },
    { id: 1, title: 'Кибер-Гонщик',        c1: '#00e5ff', c2: '#1e40af', visor: '#e0f7fa', pattern: 'stripes', hat: 'visor_horn' },
    { id: 2, title: 'Дино-Завр',           c1: '#76ff03', c2: '#1b5e20', visor: '#fffde7', pattern: 'spots',   hat: 'dino' },
    { id: 3, title: 'Тигровый Прыгун',     c1: '#ff9100', c2: '#3e2723', visor: '#ffffff', pattern: 'stripes', hat: 'ears' },
    { id: 4, title: 'Космо-Пришелец',      c1: '#d500f9', c2: '#00e676', visor: '#ccff90', pattern: 'belly',   hat: 'antenna' },
    { id: 5, title: 'Золотой Рыцарь',      c1: '#ffd700', c2: '#b71c1c', visor: '#fff8e1', pattern: 'pants',   hat: 'plume' },
    { id: 6, title: 'Повар Пельмешек',     c1: '#ff5252', c2: '#ffffff', visor: '#ffffff', pattern: 'belly',   hat: 'chef' },
    { id: 7, title: 'Акула-Тусовщик',      c1: '#26c6da', c2: '#f8bbd0', visor: '#ffffff', pattern: 'belly',   hat: 'fin' }
  ];

  // Типы бонусов (Power-ups)
  const POWERUP_TYPES = [
    { id: 'speed',   name: 'Турбо-кеды',      icon: '⚡', color: '#00e5ff', duration: 7.0, instant: false },
    { id: 'feather', name: 'Грави-перья',     icon: '🪽', color: '#b388ff', duration: 8.0, instant: false },
    { id: 'ghost',   name: 'Призрачный шаг',  icon: '👻', color: '#69f0ae', duration: 5.0, instant: false },
    { id: 'shield',  name: 'Батут-спасение',  icon: '🛡️', color: '#ffd740', duration: 15.0, instant: false },
    { id: 'shock',   name: 'Ударная волна',   icon: '💥', color: '#ff5252', duration: 0,   instant: true },
    { id: 'builder', name: 'Гекса-Строитель', icon: '🛠️', color: '#00e676', duration: 0,   instant: true }
  ];

  // ==================== 6. ГЕНЕРАТОР СМЕШНЫХ РАНДОМНЫХ НИКОВ ====================
  const FUNNY_ADJ = [
    'Пухлый', 'Дерзкий', 'Сонный', 'Турбо', 'Хитрый', 'Сладкий', 'Бешеный', 'Космический',
    'Упругий', 'Хрустящий', 'Неоновый', 'Коварный', 'Весёлый', 'Модный', 'Скользкий', 'Боевой'
  ];
  const FUNNY_NOUN = [
    'Пельмешек', 'Чебурек', 'Пингвин', 'Батончик', 'Бобёр', 'Гусь', 'Кабачок', 'Бублик',
    'Котлетка', 'Вареник', 'Суетолог', 'Тапочек', 'Пончик', 'Карасик', 'Енотик', 'Мармелад'
  ];
  const FUNNY_SOLO = [
    'КусьЗаБок', 'МаминСимпатяга', 'ТанцорДиско', 'НеТолкайсяЭй', 'ПрыгПодскок',
    'ГдеПолПацаны', 'КорольСлизи', 'СырнаяСосиска', 'УпалНаРовном', 'БоссХолодильника',
    'КотВТапках', 'ЛапкиТрясутся', 'ЛечуЗаКороной', 'ПельменьБезМасла'
  ];

  function generateFunnyBotNames(count) {
    const used = new Set();
    const result = [];
    while (result.length < count) {
      let name = '';
      if (Math.random() < 0.42) {
        name = FUNNY_SOLO[Math.floor(Math.random() * FUNNY_SOLO.length)];
      } else {
        const a = FUNNY_ADJ[Math.floor(Math.random() * FUNNY_ADJ.length)];
        const n = FUNNY_NOUN[Math.floor(Math.random() * FUNNY_NOUN.length)];
        name = `${a}_${n}`;
      }
      if (Math.random() < 0.35 && name.length <= 14) {
        name += '_' + (10 + Math.floor(Math.random() * 89));
      }
      if (!used.has(name)) {
        used.add(name);
        result.push(name);
      }
    }
    return result;
  }

  // ==================== ПРОЦЕДУРНЫЙ ЗВУКОВОЙ ДВИЖОК ====================
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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(310 + Math.random() * 50, now);
        osc.frequency.exponentialRampToValueAtTime(170, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.085);
      } else if (type === 'break') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(165, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.15);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'regen') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.12);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'spring') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.exponentialRampToValueAtTime(790, now + 0.32);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.33);
      } else if (type === 'dive') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(390, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.22);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'powerup') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.29);
      } else if (type === 'shock') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'elim') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, idx) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle';
          o.connect(g);
          g.connect(this.ctx.destination);
          o.frequency.setValueAtTime(n, now + idx * 0.11);
          g.gain.setValueAtTime(0.15, now + idx * 0.11);
          g.gain.linearRampToValueAtTime(0.001, now + idx * 0.11 + 0.32);
          o.start(now + idx * 0.11);
          o.stop(now + idx * 0.11 + 0.34);
        });
      } else if (type === 'count') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else if (type === 'go') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.setValueAtTime(987, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      }
    }
  }

  const sfx = new SoundFX();

  // ==================== ГЕОМЕТРИЯ ГЕКСАГОНОВ ====================
  const HEX_RADIUS = 42; // крупнее для более близкого и читаемого вида!
  const SQRT3 = Math.sqrt(3);
  const LAYER_GAP = 225;

  function axialToWorld(q, r) {
    const x = HEX_RADIUS * SQRT3 * (q + r * 0.5);
    const y = HEX_RADIUS * 1.5 * r;
    return { x, y };
  }

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
  const STORAGE_KEY = 'hex_fall_guys_save_v2';

  function loadSaveData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      playerName: 'СуперФасолька',
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
        { name: 'Пухлый_Пельмешек', crowns: 14, bestTime: 96.4, score: 18400 },
        { name: 'Дерзкий_Чебурек', crowns: 10, bestTime: 84.2, score: 14200 },
        { name: 'КусьЗаБок', crowns: 7, bestTime: 76.0, score: 10900 },
        { name: 'Турбо_Гусь_88', crowns: 5, bestTime: 69.5, score: 8300 },
        { name: 'КорольСлизи', crowns: 3, bestTime: 62.1, score: 5600 },
        { name: 'Сладкий_Пончик', crowns: 2, bestTime: 54.8, score: 3900 },
        { name: 'Упругий_Кабачок', crowns: 1, bestTime: 46.0, score: 2100 }
      ]
    };
  }

  function saveGameData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (e) {}
  }

  let saveData = loadSaveData();

  // ==================== СОСТОЯНИЕ ИГРЫ И БЛИЗКОЙ КАМЕРЫ ====================
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // Пресеты зума камеры (по умолчанию Близко: 1.48x!)
  const ZOOM_PRESETS = [
    { label: 'Близко',  zoom: 1.52 },
    { label: 'Крупно',  zoom: 1.80 },
    { label: 'Средне',  zoom: 1.25 },
    { label: 'Обзорно', zoom: 1.00 }
  ];

  let state = {
    phase: 'menu', // 'menu' | 'countdown' | 'playing' | 'celebrating' | 'gameover'
    diffKey: saveData.difficulty || 'normal',
    config: DIFFICULTIES[saveData.difficulty || 'normal'],
    elapsed: 0,
    countdownTimer: 3.4,
    celebrationTimer: 0,
    matchWinner: null,

    // Камера: близкое слежение за персонажем + вращение мышью или клавишами
    cameraYaw: 0.45,
    targetCameraYaw: 0.45,
    cameraPitch: 0.60,
    targetCameraPitch: 0.60,
    zoomPresetIdx: 0,
    cameraZoom: ZOOM_PRESETS[0].zoom,
    targetCameraZoom: ZOOM_PRESETS[0].zoom,
    camX: 0,
    camY: 0,
    camZ: 0,

    spectateSpeed: 1,
    spectateIdx: 0,
    spectateTarget: null,

    layers: [],
    regenQueue: [], // 4. FIFO-очередь пропорционального восстановления сот!
    actors: [],
    player: null,
    powerups: [],
    particles: [],
    shockwaves: [],
    eliminationOrder: [],
    powerupSpawnTimer: 3.0,
    eventTimer: 18.0
  };

  // ==================== 2 & 4. КЛАСС ГЕКСА-ПЛИТКИ (БЕЗ МЕРЦАНИЯ + ОЧЕРЕДЬ РЕГЕНА) ====================
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

      this.specialType = specialType; // 'normal' | 'spring' | 'gold' | 'bomb'

      // Состояния:
      // 'solid'    — целая сота исходного цвета
      // 'stepped'  — наступили: ОДИН РАЗ сменила цвет на тёплый, ждёт stepHoldTime без мигания
      // 'falling'  — плавно падает вниз (fallOffsetZ) и растворяется через прозрачность (alpha -> 0)
      // 'waiting'  — скрыта, ждёт своей пропорциональной очереди в state.regenQueue
      // 'restoring'— плавно проявляется обратно из прозрачности
      this.status = 'solid';
      this.timer = 0;
      this.fallDuration = 0.9;
      this.fallOffsetZ = 0;
      this.alpha = 1;
      this.scale = 1;
      this.lastTouchedBy = null;
    }

    triggerStep(actor, config) {
      if (this.status !== 'solid') return;

      // Если активен «Призрачный шаг», сота не активируется
      if (actor && actor.buffs.ghost > 0) return;

      // Батутная сота подбрасывает вверх
      if (this.specialType === 'spring' && actor && actor.vz <= 5) {
        actor.vz = 350;
        actor.onGround = false;
        actor.squash = -0.32; // вытягивание в прыжке
        sfx.play('spring');
        spawnParticles(this.x, this.y, this.baseZ, '#00e676', 10);
      }

      // 2. Один раз меняет цвет и спокойно ждёт до падения
      this.status = 'stepped';
      const mult = this.specialType === 'gold' ? 2.2 : 1.0;
      this.timer = config.stepHoldTime * mult;
      this.fallDuration = config.fallDuration;
      this.lastTouchedBy = actor;

      if (actor) {
        actor.tilesBroken++;
        actor.score += this.specialType === 'gold' ? 25 : 10;
        if (actor.isPlayer) sfx.play('step');
      }
    }

    startFalling(config, layerMap) {
      if (this.status === 'falling' || this.status === 'waiting') return;
      this.status = 'falling';
      this.fallDuration = config.fallDuration;
      this.timer = this.fallDuration;
      this.fallOffsetZ = 0;
      this.alpha = 1;

      if (this.lastTouchedBy && this.lastTouchedBy.isPlayer) {
        sfx.play('break');
      }

      // 4. Записываем соту в пропорциональную очередь восстановления (FIFO)
      // Первая разрушенная сота получит самый ранний targetRegenTime, а следующие — пропорционально времени их разрушения!
      enqueueTileForProportionalRegen(this, config);

      // Если это взрывная сота — активирует соседние соты (они тоже сменят цвет один раз и упадут чуть позже)
      if (this.specialType === 'bomb') {
        sfx.play('shock');
        spawnShockwave(this.x, this.y, this.baseZ, HEX_RADIUS * 2.5, '#ff5252');
        const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
        dirs.forEach(([dq, dr]) => {
          const nb = layerMap.get(`${this.q + dq},${this.r + dr}`);
          if (nb && nb.status === 'solid') {
            nb.status = 'stepped';
            nb.timer = 0.35;
            nb.fallDuration = config.fallDuration;
          }
        });
      }
    }

    instantRepair() {
      if (this.status !== 'solid') {
        this.status = 'restoring';
        this.timer = 0.45;
        this.fallOffsetZ = 20;
        this.alpha = 0.2;
        this.scale = 0.85;
        // Удаляем из очереди ожидания
        state.regenQueue = state.regenQueue.filter(item => item.tile !== this);
      }
    }

    update(dt, config, layerMap) {
      if (this.status === 'stepped') {
        this.timer -= dt;
        // Лёгкое проседание на 2 пикселя под весом, без мерцания
        this.fallOffsetZ = -2.5;
        if (this.timer <= 0) {
          this.startFalling(config, layerMap);
        }
      } else if (this.status === 'falling') {
        this.timer -= dt;
        const progress = 1 - Math.max(0, this.timer / this.fallDuration);
        // 2. Плавно падает вниз с ускорением и растворяется через прозрачность
        this.fallOffsetZ = -2.5 - (progress * progress) * 145;
        this.alpha = Math.max(0, 1 - progress);
        this.scale = 1 - progress * 0.18;

        if (this.timer <= 0) {
          this.status = 'waiting';
          this.alpha = 0;
          this.fallOffsetZ = 0;
        }
      } else if (this.status === 'restoring') {
        this.timer -= dt;
        const p = 1 - Math.max(0, this.timer / 0.45);
        this.alpha = p;
        this.scale = 0.78 + 0.22 * p;
        this.fallOffsetZ = (1 - p) * -28;
        if (this.timer <= 0) {
          this.status = 'solid';
          this.alpha = 1;
          this.scale = 1;
          this.fallOffsetZ = 0;
          this.timer = 0;
        }
      }
    }
  }

  // 4. Пропорциональная очередь восстановления (FIFO с сохранением интервалов и гарантированным минимальным шагом)
  function enqueueTileForProportionalRegen(tile, config) {
    // Базовое время восстановления относительно момента разрушения: state.elapsed + config.regenDelay
    // Плюс гарантируем строгий порядок очереди (каждая следующая разрушенная сота восстанавливается не раньше предыдущей + 0.14с)
    const desiredTime = state.elapsed + config.regenDelay;
    const lastEntry = state.regenQueue[state.regenQueue.length - 1];
    const minNextTime = lastEntry ? lastEntry.restoreAt + 0.14 : 0;
    const restoreAt = Math.max(desiredTime, minNextTime);

    state.regenQueue.push({
      tile,
      brokenAt: state.elapsed,
      restoreAt
    });
  }

  function processRegenQueue() {
    while (state.regenQueue.length > 0 && state.elapsed >= state.regenQueue[0].restoreAt) {
      const entry = state.regenQueue.shift();
      const t = entry.tile;
      if (t && (t.status === 'waiting' || t.status === 'falling')) {
        t.status = 'restoring';
        t.timer = 0.45;
        t.alpha = 0.05;
        t.scale = 0.78;
        t.fallOffsetZ = -28;
      }
    }
  }

  // ==================== 3 & 7. КЛАСС ПЕРСОНАЖА-ФАСОЛИНКИ С АНИМАЦИЯМИ ====================
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

      this.radius = 16;
      this.facing = Math.PI * 0.5;
      this.visualFacing = this.facing;
      this.onGround = true;
      this.currentLayer = 0;
      this.alive = true;
      this.survivalTime = 0;
      this.score = 0;
      this.tilesBroken = 0;

      // Прыжок и нырок (Dive)
      this.jumpCount = 0;
      this.diveCooldown = 0;
      this.isDiving = false;
      this.diveTimer = 0;

      // 7. Параметры процедурных анимаций фасолинки
      this.animState = 'idle'; // 'idle' | 'run' | 'jump' | 'fall' | 'dive' | 'celebrate'
      this.animTime = Math.random() * 10;
      this.walkCycle = 0;
      this.squash = 0;         // >0 приплюснут (приземление), <0 вытянут (прыжок)
      this.tiltForward = 0;    // наклон корпуса вперёд при беге / нырке

      // Активные бонусы
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
      if (!this.alive || state.phase !== 'playing') return false;
      const maxJumps = this.getMaxJumps();
      if (this.onGround || this.jumpCount < maxJumps) {
        const boost = this.buffs.feather > 0 ? 1.22 : 1.0;
        this.vz = 248 * boost; // размеренный, высокий и плавный прыжок
        this.onGround = false;
        this.jumpCount++;
        this.squash = -0.26;   // фасолинка вытягивается вверх при отталкивании!
        if (this.isPlayer) sfx.play('jump');
        spawnParticles(this.x, this.y, this.z, '#ffffff', 6);
        return true;
      }
      return false;
    }

    dive() {
      if (!this.alive || state.phase !== 'playing' || this.diveCooldown > 0) return false;
      this.diveCooldown = 2.2;
      this.isDiving = true;
      this.diveTimer = 0.42;
      this.squash = -0.18;

      const speed = 235;
      this.vx = Math.cos(this.facing) * speed;
      this.vy = Math.sin(this.facing) * speed;
      if (!this.onGround) {
        this.vz = Math.max(this.vz, 110);
      } else {
        this.vz = 125;
        this.onGround = false;
      }

      if (this.isPlayer) sfx.play('dive');
      spawnParticles(this.x, this.y, this.z + 10, '#ff9100', 8);

      // Толчок соперников впереди
      state.actors.forEach(other => {
        if (other !== this && other.alive && Math.abs(other.z - this.z) < 45) {
          const dx = other.x - this.x;
          const dy = other.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 60 && dist > 0.01) {
            const nx = dx / dist;
            const ny = dy / dist;
            other.vx += nx * 240;
            other.vy += ny * 240;
            other.vz = 140;
            other.onGround = false;
            other.squash = 0.25;
            this.score += 35;
          }
        }
      });

      return true;
    }

    updateAnimation(dt) {
      this.animTime += dt;
      // Плавный возврат squash & stretch к 0
      this.squash += (0 - this.squash) * Math.min(1, dt * 11);

      // Плавный поворот визуального корпуса к направлению движения
      let diff = this.facing - this.visualFacing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.visualFacing += diff * Math.min(1, dt * 12);

      const horizSpeed = Math.hypot(this.vx, this.vy);

      if (state.phase === 'celebrating' && state.matchWinner === this) {
        this.animState = 'celebrate';
        this.walkCycle += dt * 10;
      } else if (this.isDiving) {
        this.animState = 'dive';
        this.tiltForward += (0.85 - this.tiltForward) * Math.min(1, dt * 14);
      } else if (!this.onGround) {
        this.animState = this.vz > 20 ? 'jump' : 'fall';
        this.walkCycle += dt * 6;
        this.tiltForward += (0.15 - this.tiltForward) * Math.min(1, dt * 8);
      } else if (horizSpeed > 12) {
        this.animState = 'run';
        this.walkCycle += dt * (horizSpeed * 0.082);
        this.tiltForward += (0.22 - this.tiltForward) * Math.min(1, dt * 10);
      } else {
        this.animState = 'idle';
        this.tiltForward += (0 - this.tiltForward) * Math.min(1, dt * 10);
      }
    }
  }

  // ==================== ГЕНЕРАЦИЯ АРЕНЫ И ЗАПУСК С ОТСЧЁТОМ ====================
  function buildArena(config) {
    state.layers = [];
    state.regenQueue = [];
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
            else if (roll < 0.74) special = 'gold';
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
    state.countdownTimer = 3.5; // 5. Размеренный отсчёт 3.. 2.. 1.. СТАРТ!
    state.phase = 'countdown';
    state.matchWinner = null;
    state.spectateSpeed = 1;
    state.spectateTarget = null;
    state.powerups = [];
    state.particles = [];
    state.shockwaves = [];
    state.eliminationOrder = [];
    state.powerupSpawnTimer = 3.5;
    state.eventTimer = 18.0;

    document.getElementById('event-banner').classList.add('hidden');
    document.getElementById('spectator-bar').classList.add('hidden');
    document.getElementById('winner-banner-overlay').classList.add('hidden');
    document.getElementById('start-modal').classList.add('hidden');
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('lb-modal').classList.add('hidden');
    document.getElementById('killfeed').innerHTML = '';

    buildArena(config);

    const topLayer = state.layers[0];
    const totalActors = 1 + config.botsCount;
    state.actors = [];

    const spawnRing = topLayer.list.filter(
      t => hexDistance(0, 0, t.q, t.r) >= 2 && hexDistance(0, 0, t.q, t.r) <= config.gridRadius - 1
    );

    const playerSkin = SKINS[saveData.skinIndex % SKINS.length];
    const pTile = spawnRing[0] || topLayer.list[0];
    const player = new Actor(
      'player',
      saveData.playerName || 'СуперФасолька',
      true,
      playerSkin,
      pTile.x,
      pTile.y,
      topLayer.zHeight
    );
    // Поворачиваем игрока лицом к центру арены
    player.facing = Math.atan2(-player.y, -player.x);
    player.visualFacing = player.facing;
    state.player = player;
    state.actors.push(player);

    // 6. Генерируем уникальные смешные ники для ботов
    const botNames = generateFunnyBotNames(config.botsCount);

    for (let i = 0; i < config.botsCount; i++) {
      const angle = ((i + 1) / totalActors) * Math.PI * 2;
      const ringDist = HEX_RADIUS * (config.gridRadius * 0.78);
      const bx = Math.cos(angle) * ringDist;
      const by = Math.sin(angle) * ringDist;
      const axial = worldToAxial(bx, by);
      const bTile = topLayer.map.get(`${axial.q},${axial.r}`) || spawnRing[(i * 2) % spawnRing.length];

      const botSkin = SKINS[(i + 1) % SKINS.length];
      const bot = new Actor(
        `bot_${i}`,
        botNames[i],
        false,
        botSkin,
        bTile.x,
        bTile.y,
        topLayer.zHeight
      );
      bot.facing = Math.atan2(-bot.y, -bot.x);
      bot.visualFacing = bot.facing;
      state.actors.push(bot);
    }

    // Ставим камеру сразу близко за спиной игрока
    state.camX = player.x;
    state.camY = player.y;
    state.camZ = player.z;
    state.targetCameraZoom = ZOOM_PRESETS[state.zoomPresetIdx].zoom;
    state.cameraZoom = state.targetCameraZoom * 0.85; // плавный наезд камеры во время отсчёта!

    // Показываем стартовый отсчёт
    const cdOverlay = document.getElementById('countdown-overlay');
    const cdBadge = document.getElementById('countdown-badge');
    const cdText = document.getElementById('countdown-text');
    cdOverlay.classList.remove('hidden');
    cdBadge.textContent = `РАУНД: ${config.name.toUpperCase()} (${totalActors} УЧАСТНИКОВ)`;
    cdText.textContent = '3';
    sfx.play('count');

    updateHUD();
  }

  // ==================== СПАВН БОНУСОВ И ЧАСТИЦ ====================
  function spawnPowerup(forcedLayerIndex = null) {
    const aliveActors = state.actors.filter(a => a.alive);
    if (aliveActors.length === 0) return;

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
      life: 15.0,
      bobPhase: Math.random() * Math.PI * 2
    });
  }

  function applyPowerup(actor, pu) {
    const t = pu.type;
    actor.score += 50;
    if (actor.isPlayer) {
      sfx.play('powerup');
      addFeedItem(`✨ Вы взяли: ${t.icon} ${t.name}!`, t.color);
    }

    spawnParticles(pu.x, pu.y, pu.z, t.color, 12);

    if (t.id === 'speed') {
      actor.buffs.speed = t.duration;
    } else if (t.id === 'feather') {
      actor.buffs.feather = t.duration;
    } else if (t.id === 'ghost') {
      actor.buffs.ghost = t.duration;
    } else if (t.id === 'shield') {
      actor.buffs.shield = t.duration;
    } else if (t.id === 'shock') {
      sfx.play('shock');
      spawnShockwave(actor.x, actor.y, actor.z, 145, '#ff5252');
      state.actors.forEach(other => {
        if (other !== actor && other.alive && Math.abs(other.z - actor.z) < 60) {
          const dx = other.x - actor.x;
          const dy = other.y - actor.y;
          const d = Math.hypot(dx, dy);
          if (d < 145 && d > 0.01) {
            const force = (1 - d / 145) * 310 + 110;
            other.vx += (dx / d) * force;
            other.vy += (dy / d) * force;
            other.vz = 175;
            other.onGround = false;
            other.squash = 0.28;
            actor.score += 40;
          }
        }
      });
    } else if (t.id === 'builder') {
      sfx.play('regen');
      spawnShockwave(actor.x, actor.y, actor.z, 135, '#00e676');
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
      const spd = 30 + Math.random() * 85;
      state.particles.push({
        x, y, z,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vz: 50 + Math.random() * 110,
        color,
        size: 3 + Math.random() * 3.5,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7
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

  // ==================== 1. УПРАВЛЕНИЕ И ВРАЩЕНИЕ БЛИЗКОЙ КАМЕРОЙ ====================
  const keys = {};
  const joystick = { active: false, dx: 0, dy: 0, pointerId: null };
  const camDrag = { active: false, lastX: 0, lastY: 0, pointerId: null };

  function cycleZoomPreset() {
    state.zoomPresetIdx = (state.zoomPresetIdx + 1) % ZOOM_PRESETS.length;
    const preset = ZOOM_PRESETS[state.zoomPresetIdx];
    state.targetCameraZoom = preset.zoom;
    document.getElementById('hud-zoom-val').textContent = preset.label;
  }

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (state.phase === 'playing') {
      if (e.code === 'Space') {
        e.preventDefault();
        state.player?.jump();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {
        e.preventDefault();
        state.player?.dive();
      }
    }

    if (e.code === 'KeyZ') {
      cycleZoomPreset();
    } else if (e.code === 'KeyM') {
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

  // Вращение камеры перетаскиванием мыши / пальца по холсту
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) {
      // Правая кнопка мыши — быстрый нырок/рывок
      if (state.phase === 'playing') state.player?.dive();
      return;
    }
    camDrag.active = true;
    camDrag.pointerId = e.pointerId;
    camDrag.lastX = e.clientX;
    camDrag.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!camDrag.active || e.pointerId !== camDrag.pointerId) return;
    const dx = e.clientX - camDrag.lastX;
    const dy = e.clientY - camDrag.lastY;
    camDrag.lastX = e.clientX;
    camDrag.lastY = e.clientY;

    state.targetCameraYaw -= dx * 0.0075;
    state.targetCameraPitch = Math.max(0.45, Math.min(0.78, state.targetCameraPitch + dy * 0.003));
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId === camDrag.pointerId) {
      camDrag.active = false;
      camDrag.pointerId = null;
    }
  });

  // Колёсико мыши для плавного приближения/отдаления камеры
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.10 : 0.10;
    state.targetCameraZoom = Math.max(0.90, Math.min(2.10, state.targetCameraZoom + delta));
    const zoomLabel = state.targetCameraZoom >= 1.65 ? 'Крупно' : state.targetCameraZoom >= 1.35 ? 'Близко' : state.targetCameraZoom >= 1.12 ? 'Средне' : 'Обзорно';
    document.getElementById('hud-zoom-val').textContent = zoomLabel;
  }, { passive: false });

  // Кнопки камеры в верхней панели
  document.getElementById('btn-cam-left').addEventListener('click', () => {
    state.targetCameraYaw -= Math.PI / 5;
  });
  document.getElementById('btn-cam-right').addEventListener('click', () => {
    state.targetCameraYaw += Math.PI / 5;
  });
  document.getElementById('btn-cam-zoom').addEventListener('click', cycleZoomPreset);

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
    e.stopPropagation();
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

  document.getElementById('btn-touch-jump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.player?.jump();
  });
  document.getElementById('btn-touch-dive').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.player?.dive();
  });
  document.getElementById('chip-jump').addEventListener('click', () => state.player?.jump());
  document.getElementById('chip-dive').addEventListener('click', () => state.player?.dive());
  document.getElementById('chip-cam').addEventListener('click', () => {
    state.targetCameraYaw += Math.PI / 4;
  });

  // ==================== ИИ БОТОВ (РАЗМЕРЕННЫЙ И УМНЫЙ ВЫБОР СОТ) ====================
  function updateBotAI(bot, dt, config) {
    bot.aiRetargetTimer -= dt;

    const layer = state.layers[bot.currentLayer] || state.layers[state.layers.length - 1];
    const curAx = worldToAxial(bot.x, bot.y);
    const curTile = layer.map.get(`${curAx.q},${curAx.r}`);

    // Если сота под ботом уже сменила цвет и скоро упадёт — ищем соседнюю целую соту
    const urgent = !curTile || curTile.status === 'falling' || curTile.status === 'waiting' ||
      (curTile.status === 'stepped' && curTile.timer < config.stepHoldTime * 0.55);

    if (bot.aiRetargetTimer <= 0 || urgent || !bot.aiTargetTile ||
        bot.aiTargetTile.status === 'falling' || bot.aiTargetTile.status === 'waiting') {
      bot.aiRetargetTimer = 0.25 + (1 - config.botIQ) * 0.28;

      let bestTile = null;
      let bestScore = -9999;

      for (let dq = -2; dq <= 2; dq++) {
        for (let dr = Math.max(-2, -dq - 2); dr <= Math.min(2, -dq + 2); dr++) {
          const hDist = hexDistance(0, 0, dq, dr);
          if (hDist === 0) continue;
          const candidate = layer.map.get(`${curAx.q + dq},${curAx.r + dr}`);
          if (!candidate) continue;

          if (candidate.status !== 'solid' && candidate.status !== 'restoring') {
            continue;
          }

          let solidNeighbors = 0;
          const nDirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
          for (const [nq, nr] of nDirs) {
            const nb = layer.map.get(`${candidate.q + nq},${candidate.r + nr}`);
            if (nb && nb.status === 'solid') solidNeighbors++;
          }

          let score = solidNeighbors * 12;
          if (hDist === 1) score += 20;
          if (candidate.specialType === 'gold') score += 16;
          if (candidate.specialType === 'bomb') score -= 14;

          const centerDist = hexDistance(0, 0, candidate.q, candidate.r);
          score -= centerDist * 2.2;
          score += (Math.random() - 0.5) * (1.2 - config.botIQ) * 40;

          if (score > bestScore) {
            bestScore = score;
            bestTile = candidate;
          }
        }
      }
      bot.aiTargetTile = bestTile;
    }

    if (bot.aiTargetTile) {
      const dx = bot.aiTargetTile.x - bot.x;
      const dy = bot.aiTargetTile.y - bot.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 6) {
        const targetAngle = Math.atan2(dy, dx);
        bot.facing = targetAngle;

        // 1. Более плавная и размеренная скорость бега ботов (115 вместо 165)
        const baseSpeed = 114 * (bot.buffs.speed > 0 ? 1.35 : 1.0);
        const desiredVx = Math.cos(targetAngle) * baseSpeed;
        const desiredVy = Math.sin(targetAngle) * baseSpeed;

        bot.vx += (desiredVx - bot.vx) * Math.min(1, dt * 8);
        bot.vy += (desiredVy - bot.vy) * Math.min(1, dt * 8);

        if (bot.onGround && (dist > HEX_RADIUS * 1.85 || !curTile || curTile.status === 'falling' || curTile.status === 'waiting')) {
          if (Math.random() < 0.35 + config.botIQ * 0.55) {
            bot.jump();
          }
        }
      }
    }
  }

  // ==================== ФИЗИКА И ОБНОВЛЕНИЕ МИРА ====================
  function updateWorld(dt) {
    // 1. Плавное вращение камеры клавишами Q / E
    if (keys['KeyQ']) state.targetCameraYaw -= dt * 1.85;
    if (keys['KeyE']) state.targetCameraYaw += dt * 1.85;

    state.cameraYaw += (state.targetCameraYaw - state.cameraYaw) * Math.min(1, dt * 9);
    state.cameraPitch += (state.targetCameraPitch - state.cameraPitch) * Math.min(1, dt * 9);
    state.cameraZoom += (state.targetCameraZoom - state.cameraZoom) * Math.min(1, dt * 7);

    // Обновляем анимации фасолинок во всех фазах (даже на старте и на победной плашке!)
    for (const actor of state.actors) {
      if (actor.alive) actor.updateAnimation(dt);
    }

    // 5. ФАЗА СТАРТОВОГО ОТСЧЁТА (3.. 2.. 1.. СТАРТ!)
    if (state.phase === 'countdown') {
      const prevSec = Math.ceil(state.countdownTimer - 0.5);
      state.countdownTimer -= dt;
      const curSec = Math.ceil(state.countdownTimer - 0.5);

      const cdText = document.getElementById('countdown-text');
      const cdSub = document.getElementById('countdown-sub');

      if (curSec !== prevSec) {
        if (curSec >= 1) {
          cdText.textContent = String(curSec);
          sfx.play('count');
        } else if (curSec === 0) {
          cdText.textContent = 'СТАРТ!';
          cdSub.textContent = 'Бегите и перепрыгивайте проваливающиеся соты!';
          sfx.play('go');
        }
      }

      // Камера плавно фокусируется на игроке во время отсчёта
      if (state.player) {
        state.camX += (state.player.x - state.camX) * Math.min(1, dt * 6);
        state.camY += (state.player.y - state.camY) * Math.min(1, dt * 6);
        state.camZ += (state.player.z - state.camZ) * Math.min(1, dt * 6);
      }

      if (state.countdownTimer <= 0) {
        state.phase = 'playing';
        document.getElementById('countdown-overlay').classList.add('hidden');
      }
      return;
    }

    // 5. ФАЗА ТОРЖЕСТВЕННОЙ ПЛАШКИ ПОБЕДИТЕЛЯ ПЕРЕД ТАБЛИЦЕЙ
    if (state.phase === 'celebrating') {
      state.celebrationTimer -= dt;
      if (state.matchWinner) {
        state.camX += (state.matchWinner.x - state.camX) * Math.min(1, dt * 5);
        state.camY += (state.matchWinner.y - state.camY) * Math.min(1, dt * 5);
        state.camZ += (state.matchWinner.z - state.camZ) * Math.min(1, dt * 5);
        state.targetCameraYaw += dt * 0.6; // камера красиво облетает победителя
      }
      // Обновляем конфетти-частицы
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const pt = state.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        pt.vz -= 280 * dt;
        if (pt.life <= 0) state.particles.splice(i, 1);
      }
      if (state.celebrationTimer <= 0) {
        showFinalResultsModal();
      }
      return;
    }

    if (state.phase !== 'playing') return;

    const simDt = dt * (state.player && !state.player.alive ? state.spectateSpeed : 1);
    state.elapsed += simDt;

    // 4. Проверяем пропорциональную очередь восстановления сот (первая упавшая — первая восстановится)
    processRegenQueue();

    // Спавн бонусов и событий
    state.powerupSpawnTimer -= simDt;
    if (state.powerupSpawnTimer <= 0) {
      state.powerupSpawnTimer = state.config.powerupInterval;
      if (state.powerups.length < 6) {
        spawnPowerup();
      }
    }

    state.eventTimer -= simDt;
    if (state.eventTimer <= 0) {
      state.eventTimer = 20.0;
      triggerArenaEvent();
    }

    // Обновление всех гекса-плиток
    for (const layer of state.layers) {
      for (const tile of layer.list) {
        tile.update(simDt, state.config, layer.map);
      }
    }

    // 1. Управление игроком (размеренная комфортная скорость 124 ед/с)
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

        const cosA = Math.cos(-state.cameraYaw);
        const sinA = Math.sin(-state.cameraYaw);
        const worldDirX = nx * cosA - ny * sinA;
        const worldDirY = nx * sinA + ny * cosA;

        p.facing = Math.atan2(worldDirY, worldDirX);
        const maxSpeed = 124 * (p.buffs.speed > 0 ? 1.35 : 1.0);
        const targetVx = worldDirX * maxSpeed * Math.min(1, len);
        const targetVy = worldDirY * maxSpeed * Math.min(1, len);

        const accel = p.onGround ? 10 : 5.5;
        p.vx += (targetVx - p.vx) * Math.min(1, simDt * accel);
        p.vy += (targetVy - p.vy) * Math.min(1, simDt * accel);
      } else if (!p.isDiving) {
        const friction = p.onGround ? 9 : 2.2;
        p.vx *= Math.max(0, 1 - simDt * friction);
        p.vy *= Math.max(0, 1 - simDt * friction);
      }
    }

    // Физика всех участников (размеренная гравитация 540 вместо 760)
    const abyssZ = -LAYER_GAP - 160;

    for (const actor of state.actors) {
      if (!actor.alive) continue;

      actor.survivalTime = state.elapsed;
      actor.score += simDt * 12 * state.config.scoreMult;

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
      const wasOnGround = actor.onGround;
      actor.x += actor.vx * simDt;
      actor.y += actor.vy * simDt;

      const gravity = actor.buffs.feather > 0 && actor.vz < 0 ? 340 : 540;
      actor.vz -= gravity * simDt;
      actor.z += actor.vz * simDt;

      actor.onGround = false;

      for (const layer of state.layers) {
        const surfaceZ = layer.zHeight;
        if (prevZ >= surfaceZ - 9 && actor.z <= surfaceZ + 6 && actor.vz <= 0) {
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
            if (t && (t.status === 'solid' || t.status === 'stepped' || t.status === 'restoring')) {
              landedTile = t;
              break;
            }
          }

          if (landedTile) {
            if (!wasOnGround && actor.vz < -80) {
              // 7. Эффект пружинистого приземления фасолинки (Squash)
              actor.squash = Math.min(0.32, Math.abs(actor.vz) / 850);
            }
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

      // Падение в слизь
      if (actor.z < abyssZ) {
        if (actor.buffs.shield > 0) {
          actor.buffs.shield = 0;
          const bottomLayer = state.layers[state.layers.length - 1];
          actor.z = bottomLayer.zHeight + 80;
          actor.vz = 340;
          actor.x *= 0.3;
          actor.y *= 0.3;
          const cAx = worldToAxial(actor.x, actor.y);
          const cTile = bottomLayer.map.get(`${cAx.q},${cAx.r}`) || bottomLayer.map.get('0,0');
          if (cTile) cTile.instantRepair();

          sfx.play('spring');
          spawnShockwave(actor.x, actor.y, bottomLayer.zHeight, 120, '#ffd740');
          if (actor.isPlayer) {
            addFeedItem('🛡️ Батут-спасение вернул вас на арену!', '#ffd740');
          }
        } else {
          actor.alive = false;
          state.eliminationOrder.push(actor);
          sfx.play('elim');
          spawnParticles(actor.x, actor.y, abyssZ + 20, '#ff2a85', 20);
          addFeedItem(`💦 ${actor.name} плюхнулся в слизь!`, actor.isPlayer ? '#00e5ff' : '#ff2a85');

          if (actor.isPlayer) {
            onPlayerEliminated();
          }
        }
      }
    }

    // Столкновения плечами между фасолинками
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

            const push = 75;
            a.vx -= nx * push * simDt * 8;
            a.vy -= ny * push * simDt * 8;
            b.vx += nx * push * simDt * 8;
            b.vy += ny * push * simDt * 8;
          }
        }
      }
    }

    // Обновление бонусов, частиц и волн
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const pu = state.powerups[i];
      pu.life -= simDt;
      pu.bobPhase += simDt * 3.5;
      if (pu.life <= 0) state.powerups.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= simDt;
      pt.x += pt.vx * simDt;
      pt.y += pt.vy * simDt;
      pt.z += pt.vz * simDt;
      pt.vz -= 320 * simDt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.life -= simDt;
      sw.radius = sw.maxRadius * (1 - sw.life / sw.maxLife);
      if (sw.life <= 0) state.shockwaves.splice(i, 1);
    }

    // 1. Близкое слежение камеры за персонажем игрока (или наблюдаемым ботом)
    let focusActor = state.player;
    if (!focusActor || !focusActor.alive) {
      if (!state.spectateTarget || !state.spectateTarget.alive) {
        state.spectateTarget = aliveList[state.spectateIdx % Math.max(1, aliveList.length)] || state.player;
      }
      focusActor = state.spectateTarget;
      if (focusActor) {
        document.getElementById('spec-target-name').textContent =
          `Смотрим за: ${focusActor.name} (Ярус ${focusActor.currentLayer + 1})`;
      }
    }

    if (focusActor) {
      state.camX += (focusActor.x - state.camX) * Math.min(1, dt * 8.0);
      state.camY += (focusActor.y - state.camY) * Math.min(1, dt * 8.0);
      state.camZ += (focusActor.z - state.camZ) * Math.min(1, dt * 6.0);
    }

    // Проверка окончания раунда
    if (aliveList.length <= 1) {
      triggerWinnerCelebration(aliveList[0] || state.eliminationOrder[state.eliminationOrder.length - 1]);
    }

    updateHUD();
  }

  function triggerArenaEvent() {
    const roll = Math.random();
    const banner = document.getElementById('event-banner');
    banner.classList.remove('hidden');

    if (roll < 0.45) {
      banner.textContent = '🎁 СОБЫТИЕ: ДОЖДЬ БОНУСОВ НА ЯРУСАХ!';
      for (let i = 0; i < 3; i++) spawnPowerup();
    } else if (roll < 0.78) {
      banner.textContent = '🛠️ СОБЫТИЕ: УСКОРЕННОЕ ВОССТАНОВЛЕНИЕ СОТ!';
      // Пропускаем вперёд время восстановления первых 8 сот в очереди
      for (let i = 0; i < Math.min(8, state.regenQueue.length); i++) {
        state.regenQueue[i].restoreAt = state.elapsed;
      }
      sfx.play('regen');
    } else {
      banner.textContent = '🪽 СОБЫТИЕ: ПЛАВНАЯ ГРАВИТАЦИЯ ВСЕМ (5 СЕК)!';
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

  // 5. Показ торжественной плашки победителя в конце игры
  function triggerWinnerCelebration(winner) {
    if (state.phase === 'celebrating' || state.phase === 'gameover') return;
    state.phase = 'celebrating';
    state.celebrationTimer = 2.8;
    state.matchWinner = winner;

    document.getElementById('spectator-bar').classList.add('hidden');

    const overlay = document.getElementById('winner-banner-overlay');
    const ribbon = document.getElementById('winner-plashka-ribbon');
    const nameEl = document.getElementById('winner-plashka-name');
    const subEl = document.getElementById('winner-plashka-sub');

    const isPlayerWin = winner && winner.isPlayer;
    ribbon.textContent = isPlayerWin ? '🎉 ВЫ ПОБЕДИЛИ В ШОУ! 🎉' : '🏁 ФИНАЛ РАУНДА ОКОНЧЕН!';
    nameEl.textContent = winner ? winner.name : 'Ничья';
    subEl.textContent = isPlayerWin
      ? 'Вы перепрыгали всех соперников и забрали Золотую Корону!'
      : 'становится последним выжившим и забирает Корону!';

    overlay.classList.remove('hidden');
    sfx.play('win');

    // Салют из конфетти вокруг победителя
    if (winner) {
      state.targetCameraZoom = 1.75;
      for (let i = 0; i < 35; i++) {
        const cols = ['#ffe600', '#00e5ff', '#ff2a85', '#00e676', '#ffffff'];
        spawnParticles(winner.x, winner.y, winner.z + 25, cols[i % cols.length], 2);
      }
    }
  }

  function showFinalResultsModal() {
    if (state.phase === 'gameover') return;
    state.phase = 'gameover';
    document.getElementById('winner-banner-overlay').classList.add('hidden');

    const winner = state.matchWinner;
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

    document.getElementById('result-ribbon').textContent = isVictory ? 'ЧЕМПИОН ШОУ!' : 'ИТОГИ ФИНАЛА';
    document.getElementById('result-title').textContent = isVictory
      ? 'ПОБЕДА! КОРОНА ВАША! 👑'
      : `ВЫ ЗАНЯЛИ #${playerPlace} МЕСТО!`;
    document.getElementById('result-subtitle').textContent = isVictory
      ? 'Невероятная ловкость на шестиугольных сотах!'
      : `Победитель шоу: ${winner ? winner.name : 'Бот'} 👑`;

    document.getElementById('spot-winner-name').textContent = winner ? `${winner.name} ${winner.isPlayer ? '(Вы)' : ''}` : 'Чемпион';
    document.getElementById('spot-winner-meta').textContent = winner
      ? `Выжил ${formatTime(winner.survivalTime)} и набрал ⭐ ${Math.round(winner.score)} очков!`
      : '';

    // Рисуем портрет фасолинки-победителя в плашке итогов
    const winCanvas = document.getElementById('winner- bean-canvas');
    if (winCanvas && winner) {
      const wCtx = winCanvas.getContext('2d');
      wCtx.clearRect(0, 0, winCanvas.width, winCanvas.height);
      drawBeanAvatar(wCtx, 45, 76, 1.15, winner.skin, performance.now() * 0.005, 'celebrate');
    }

    document.getElementById('res-place').textContent = `#${playerPlace}`;
    document.getElementById('res-time').textContent = formatTime(p.survivalTime);
    document.getElementById('res-tiles').textContent = String(p.tilesBroken);
    document.getElementById('res-score').textContent = `+${finalScore}`;

    const standingsEl = document.getElementById('match-standings');
    standingsEl.innerHTML = '';
    standings.slice(0, 10).forEach((act, idx) => {
      const row = document.createElement('div');
      row.className = 'standing-row' + (act.isPlayer ? ' is-player' : '');
      const medal = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
      row.innerHTML = `
        <span>${medal} <strong>${act.name}</strong> ${act.isPlayer ? '(Вы)' : ''}</span>
        <span>⏱️ ${formatTime(act.survivalTime)} • ⭐ ${Math.round(act.score)}</span>
      `;
      standingsEl.appendChild(row);
    });

    document.getElementById('result-modal').classList.remove('hidden');
  }

  // ==================== 3 & 7. РЕНДЕРИНГ 3D СОТ И ПЕРСОНАЖЕЙ-ФАСОЛИНОК ====================
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Проекция мировых координат с учётом близкого зума камеры (state.cameraZoom)
  function project3D(wx, wy, wz) {
    const dx = wx - state.camX;
    const dy = wy - state.camY;
    const dz = wz - state.camZ;

    const cosA = Math.cos(state.cameraYaw);
    const sinA = Math.sin(state.cameraYaw);

    const rx = dx * cosA - dy * sinA;
    const ry = dx * sinA + dy * cosA;

    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.55;
    const zf = state.cameraZoom;

    const sx = cx + rx * zf;
    const sy = cy + (ry * state.cameraPitch - dz * 0.80) * zf;
    const depth = ry - dz * 0.45;
    return { sx, sy, depth, scale: zf };
  }

  function drawHexPrism(sx, sy, radius, thickness, topColor, sideColor, strokeColor, alpha = 1) {
    if (alpha <= 0.01 || radius <= 1) return;
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

    // 3D боковая грань соты
    if (thickness > 1) {
      ctx.fillStyle = sideColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % 6];
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

    // Внутренний мягкий блик
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ix = sx + (pts[i].x - sx) * 0.74;
      const iy = sy + (pts[i].y - sy) * 0.74;
      if (i === 0) ctx.moveTo(ix, iy);
      else ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // 3 & 7. Отрисовка полноценного персонажа-фасолинки (Fall Guys Bean) с частями тела, узорами, шляпами и анимациями!
  function drawBeanBody(targetCtx, skin, walkCycle, animState, squash, tiltForward, lookDirX, lookDirY) {
    const isRun = animState === 'run';
    const isJump = animState === 'jump' || animState === 'fall';
    const isDive = animState === 'dive';
    const isCelebrate = animState === 'celebrate';

    // Подпрыгивание корпуса при беге / танце / дыхании
    let bodyBob = 0;
    if (isRun) bodyBob = Math.abs(Math.sin(walkCycle * 2)) * 4.5;
    else if (isCelebrate) bodyBob = Math.abs(Math.sin(walkCycle * 1.5)) * 9;
    else if (animState === 'idle') bodyBob = Math.sin(walkCycle * 2) * 1.5;

    // Squash & Stretch (растяжение по вертикали / сжатие по горизонтали)
    const scaleX = 1 + squash * 0.55;
    const scaleY = 1 - squash * 0.55;

    const legSwing = isRun ? Math.sin(walkCycle * 2) * 8 : isJump ? 5 : isCelebrate ? Math.sin(walkCycle * 3) * 6 : 0;
    const armSwing = isRun ? Math.cos(walkCycle * 2) * 9 : isJump ? -11 : isCelebrate ? -13 + Math.sin(walkCycle * 3) * 5 : 0;

    targetCtx.save();
    targetCtx.translate(0, -bodyBob);
    if (isDive) {
      targetCtx.rotate(lookDirX >= 0 ? 0.65 : -0.65);
    } else {
      targetCtx.rotate(lookDirX * tiltForward * 0.45);
    }
    targetCtx.scale(scaleX, scaleY);

    // 1. Задняя ручка (если повёрнут боком)
    targetCtx.fillStyle = skin.c1;
    targetCtx.strokeStyle = '#140a2a';
    targetCtx.lineWidth = 2.2;

    // Ножки-ботиночки (левая и правая)
    targetCtx.fillStyle = skin.c2;
    targetCtx.beginPath();
    targetCtx.roundRect(-10, -9 + legSwing * 0.55, 7.5, 11, 4);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.beginPath();
    targetCtx.roundRect(2.5, -9 - legSwing * 0.55, 7.5, 11, 4);
    targetCtx.fill();
    targetCtx.stroke();

    // Левая ручка (машет в противофазе ноге)
    targetCtx.save();
    targetCtx.translate(-14, -22);
    targetCtx.rotate((armSwing * 0.045) - (isJump || isCelebrate ? 0.7 : 0.15));
    targetCtx.fillStyle = skin.c1;
    targetCtx.beginPath();
    targetCtx.roundRect(-4.5, -2, 6.5, 13, 3.5);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.restore();

    // 2. Основной корпус-фасолинка (Bean Torso) с клиппингом для узоров скина
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.roundRect(-14.5, -38, 29, 32, 14.5);
    targetCtx.fillStyle = skin.c1;
    targetCtx.fill();

    // Узоры костюма внутри силуэта фасолинки
    targetCtx.clip();

    if (skin.pattern === 'pants') {
      // Нижние штанишки + ремень с пряжкой
      targetCtx.fillStyle = skin.c2;
      targetCtx.fillRect(-16, -15, 32, 12);
      targetCtx.fillStyle = '#1a0f35';
      targetCtx.fillRect(-16, -16.5, 32, 2.5);
      targetCtx.fillStyle = '#ffe600';
      targetCtx.fillRect(-3.5, -17.5, 7, 4.5);
    } else if (skin.pattern === 'belly') {
      // Милое светлое пузико
      targetCtx.fillStyle = skin.c2;
      targetCtx.beginPath();
      targetCtx.ellipse(lookDirX * 2.5, -14, 9.5, 8, 0, 0, Math.PI * 2);
      targetCtx.fill();
    } else if (skin.pattern === 'stripes') {
      // Гоночные / тигровые полоски
      targetCtx.fillStyle = skin.c2;
      targetCtx.fillRect(-16, -16, 32, 3.5);
      targetCtx.fillRect(-16, -10.5, 32, 3.5);
    } else if (skin.pattern === 'spots') {
      // Пятнышки динозаврика
      targetCtx.fillStyle = skin.c2;
      targetCtx.beginPath();
      targetCtx.arc(-8, -16, 3.5, 0, Math.PI * 2);
      targetCtx.arc(8, -14, 4, 0, Math.PI * 2);
      targetCtx.arc(-6, -28, 3, 0, Math.PI * 2);
      targetCtx.fill();
    }

    // Мягкий объёмный блик на макушке и тень снизу
    const beanGrad = targetCtx.createLinearGradient(0, -38, 0, -6);
    beanGrad.addColorStop(0, 'rgba(255,255,255,0.28)');
    beanGrad.addColorStop(0.45, 'rgba(255,255,255,0)');
    beanGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
    targetCtx.fillStyle = beanGrad;
    targetCtx.fillRect(-16, -38, 32, 34);
    targetCtx.restore();

    // Чёткий мультяшный контур фасолинки
    targetCtx.beginPath();
    targetCtx.roundRect(-14.5, -38, 29, 32, 14.5);
    targetCtx.strokeStyle = '#140a2a';
    targetCtx.lineWidth = 2.6;
    targetCtx.stroke();

    // 3. Лицевая маска (Faceplate / Visor) и выразительные глазки
    const faceOffsetX = lookDirX * 4.5;
    const faceOffsetY = lookDirY * 1.5;

    targetCtx.fillStyle = skin.visor || '#ffffff';
    targetCtx.beginPath();
    targetCtx.ellipse(faceOffsetX, -24.5 + faceOffsetY, 9.5, 6.8, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.lineWidth = 2.0;
    targetCtx.strokeStyle = '#140a2a';
    targetCtx.stroke();

    // Глазки-фасолинки (при прыжке или радости превращаются в весёлые дуги ^ ^)
    targetCtx.fillStyle = '#140a2a';
    if (isCelebrate) {
      targetCtx.lineWidth = 2.2;
      targetCtx.beginPath();
      targetCtx.arc(faceOffsetX - 3.6, -24 + faceOffsetY, 2.5, Math.PI, 0);
      targetCtx.stroke();
      targetCtx.beginPath();
      targetCtx.arc(faceOffsetX + 3.6, -24 + faceOffsetY, 2.5, Math.PI, 0);
      targetCtx.stroke();
    } else {
      targetCtx.beginPath();
      targetCtx.ellipse(faceOffsetX - 3.5, -24.5 + faceOffsetY, 2.0, 2.9, 0, 0, Math.PI * 2);
      targetCtx.ellipse(faceOffsetX + 3.5, -24.5 + faceOffsetY, 2.0, 2.9, 0, 0, Math.PI * 2);
      targetCtx.fill();

      // Белые блики в глазках
      targetCtx.fillStyle = '#ffffff';
      targetCtx.beginPath();
      targetCtx.arc(faceOffsetX - 4.1, -25.6 + faceOffsetY, 0.9, 0, Math.PI * 2);
      targetCtx.arc(faceOffsetX + 2.9, -25.6 + faceOffsetY, 0.9, 0, Math.PI * 2);
      targetCtx.fill();
    }

    // 4. Правая ручка
    targetCtx.save();
    targetCtx.translate(14, -22);
    targetCtx.rotate((-armSwing * 0.045) + (isJump || isCelebrate ? 0.7 : 0.15));
    targetCtx.fillStyle = skin.c1;
    targetCtx.beginPath();
    targetCtx.roundRect(-2, -2, 6.5, 13, 3.5);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.restore();

    // 5. Головной убор / аксессуар скина (чтобы скины легко расширялись)
    drawBeanHat(targetCtx, skin.hat, skin.c2);

    targetCtx.restore();
  }

  function drawBeanHat(targetCtx, hatType, accentColor) {
    targetCtx.save();
    targetCtx.strokeStyle = '#140a2a';
    targetCtx.lineWidth = 2;

    if (hatType === 'crown') {
      // Золотая корона с рубином
      targetCtx.fillStyle = '#ffd700';
      targetCtx.beginPath();
      targetCtx.moveTo(-8, -37);
      targetCtx.lineTo(-9, -46);
      targetCtx.lineTo(-4, -41);
      targetCtx.lineTo(0, -48);
      targetCtx.lineTo(4, -41);
      targetCtx.lineTo(9, -46);
      targetCtx.lineTo(8, -37);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.stroke();
    } else if (hatType === 'dino') {
      // Гребень динозаврика
      targetCtx.fillStyle = accentColor;
      for (let i = -1; i <= 1; i++) {
        targetCtx.beginPath();
        targetCtx.moveTo(i * 5 - 3, -37);
        targetCtx.lineTo(i * 5, -45);
        targetCtx.lineTo(i * 5 + 3, -37);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
      }
    } else if (hatType === 'ears') {
      // Ушки тигра/котика
      targetCtx.fillStyle = accentColor;
      targetCtx.beginPath();
      targetCtx.arc(-8, -38, 4.5, 0, Math.PI * 2);
      targetCtx.arc(8, -38, 4.5, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    } else if (hatType === 'antenna') {
      // Антенна пришельца
      targetCtx.beginPath();
      targetCtx.moveTo(0, -38);
      targetCtx.lineTo(0, -46);
      targetCtx.stroke();
      targetCtx.fillStyle = '#00e676';
      targetCtx.beginPath();
      targetCtx.arc(0, -47, 3.8, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    } else if (hatType === 'chef') {
      // Поварской колпак
      targetCtx.fillStyle = '#ffffff';
      targetCtx.beginPath();
      targetCtx.roundRect(-8, -47, 16, 10, 5);
      targetCtx.fill();
      targetCtx.stroke();
    } else if (hatType === 'plume') {
      // Рыцарский султан
      targetCtx.fillStyle = '#ff1744';
      targetCtx.beginPath();
      targetCtx.ellipse(0, -44, 6, 4.5, -0.2, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    } else if (hatType === 'fin') {
      // Акулий плавник
      targetCtx.fillStyle = '#26c6da';
      targetCtx.beginPath();
      targetCtx.moveTo(-4, -37);
      targetCtx.lineTo(2, -48);
      targetCtx.lineTo(6, -37);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.stroke();
    } else if (hatType === 'visor_horn') {
      // Кибер-нимб / рожки
      targetCtx.fillStyle = '#00e5ff';
      targetCtx.beginPath();
      targetCtx.moveTo(-7, -38);
      targetCtx.lineTo(-10, -45);
      targetCtx.lineTo(-3, -39);
      targetCtx.moveTo(7, -38);
      targetCtx.lineTo(10, -45);
      targetCtx.lineTo(3, -39);
      targetCtx.fill();
      targetCtx.stroke();
    }
    targetCtx.restore();
  }

  // Вспомогательная функция отрисовки аватара фасолинки в меню Гардероба и Итогов
  function drawBeanAvatar(targetCtx, cx, cy, scale, skin, time, animState = 'idle') {
    targetCtx.save();
    targetCtx.translate(cx, cy);
    targetCtx.scale(scale, scale);
    drawBeanBody(targetCtx, skin, time * 2.2, animState, 0, 0, 0.25, 0.1);
    targetCtx.restore();
  }

  function drawFallGuyCharacterOnScene(actor, proj) {
    const { sx, sy, scale } = proj;
    ctx.save();

    // Тень под персонажем на ближайшем ярусе
    for (const layer of state.layers) {
      if (actor.z >= layer.zHeight - 5) {
        const ax = worldToAxial(actor.x, actor.y);
        const t = layer.map.get(`${ax.q},${ax.r}`);
        if (t && (t.status === 'solid' || t.status === 'stepped' || t.status === 'restoring')) {
          const shProj = project3D(actor.x, actor.y, layer.zHeight);
          const heightDiff = Math.max(0, actor.z - layer.zHeight);
          const shScale = Math.max(0.3, 1 - heightDiff / 220) * scale;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
          ctx.beginPath();
          ctx.ellipse(shProj.sx, shProj.sy, 14 * shScale, 8.5 * shScale, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }

    if (actor.buffs.ghost > 0) {
      ctx.globalAlpha = 0.65;
    }

    ctx.translate(sx, sy);
    ctx.scale(scale, scale);

    // Аура «Батут-спасение»
    if (actor.buffs.shield > 0) {
      ctx.strokeStyle = '#ffd740';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -18, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    const screenAngle = actor.visualFacing + state.cameraYaw;
    const lookDirX = Math.cos(screenAngle);
    const lookDirY = Math.sin(screenAngle);

    drawBeanBody(
      ctx,
      actor.skin,
      actor.walkCycle || actor.animTime,
      actor.animState,
      actor.squash,
      actor.tiltForward,
      lookDirX,
      lookDirY
    );

    // 6. Никнейм над головой персонажа
    ctx.font = actor.isPlayer ? '900 11px sans-serif' : '700 9.5px sans-serif';
    ctx.textAlign = 'center';
    const labelY = -56;

    if (actor.isPlayer) {
      ctx.fillStyle = '#ffe600';
      ctx.fillText('▼ ВЫ', 0, labelY - 11);
    }

    const tw = ctx.measureText(actor.name).width + 10;
    ctx.fillStyle = actor.isPlayer ? 'rgba(0, 45, 75, 0.85)' : 'rgba(14, 9, 34, 0.78)';
    ctx.beginPath();
    ctx.roundRect(-tw / 2, labelY - 9.5, tw, 13.5, 5);
    ctx.fill();

    if (actor.isPlayer) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.fillStyle = actor.isPlayer ? '#00e5ff' : '#ffffff';
    ctx.fillText(actor.name, 0, labelY);

    ctx.restore();
  }

  function renderScene() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Неоновое озеро слизи внизу
    const slimeProj = project3D(0, 0, -LAYER_GAP - 140);
    const slimeGrad = ctx.createRadialGradient(w * 0.5, slimeProj.sy, 30, w * 0.5, slimeProj.sy, Math.max(w, h) * 0.75);
    slimeGrad.addColorStop(0, 'rgba(255, 42, 133, 0.24)');
    slimeGrad.addColorStop(0.5, 'rgba(124, 77, 255, 0.11)');
    slimeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = slimeGrad;
    ctx.fillRect(0, 0, w, h);

    const renderQueue = [];

    // 1. Гекса-плитки всех ярусов
    for (const layer of state.layers) {
      const theme = LAYER_THEMES[layer.index % LAYER_THEMES.length];
      for (const tile of layer.list) {
        if (tile.status === 'waiting') continue; // полностью исчезнувшие соты ждут очереди регена

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

    // 3. Бонусы
    for (const pu of state.powerups) {
      const z = pu.z + Math.sin(pu.bobPhase) * 5;
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

    renderQueue.sort((a, b) => a.sortKey - b.sortKey);

    for (const item of renderQueue) {
      if (item.kind === 'tile') {
        const { tile, theme, proj } = item;
        let topCol = theme.top;
        let sideCol = theme.side;
        let strokeCol = 'rgba(255,255,255,0.58)';

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

        // 2. Один раз меняют цвет при наступании и плавно падают с прозрачностью (без мигания!)
        if (tile.status === 'stepped' || tile.status === 'falling') {
          topCol = theme.steppedTop;
          sideCol = theme.steppedSide;
          strokeCol = 'rgba(255, 235, 180, 0.85)';
        } else if (tile.status === 'restoring') {
          strokeCol = '#00e5ff';
        }

        const r = (HEX_RADIUS - 2) * tile.scale * proj.scale;
        const thickness = 11 * proj.scale;
        drawHexPrism(proj.sx, proj.sy, r, thickness, topCol, sideCol, strokeCol, tile.alpha);

        if ((tile.status === 'solid' || tile.status === 'stepped') && tile.specialType !== 'normal') {
          ctx.save();
          ctx.globalAlpha = tile.alpha;
          ctx.font = `${Math.round(13 * proj.scale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const icon = tile.specialType === 'spring' ? '⏫' : tile.specialType === 'gold' ? '⭐' : '💣';
          ctx.fillText(icon, proj.sx, proj.sy);
          ctx.restore();
        }
      } else if (item.kind === 'shockwave') {
        const { sw, proj } = item;
        ctx.save();
        ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 4 * proj.scale;
        ctx.beginPath();
        ctx.ellipse(proj.sx, proj.sy, sw.radius * proj.scale, sw.radius * state.cameraPitch * proj.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (item.kind === 'powerup') {
        const { pu, proj } = item;
        ctx.save();
        ctx.translate(proj.sx, proj.sy - 8 * proj.scale);
        ctx.scale(proj.scale, proj.scale);
        ctx.fillStyle = pu.type.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pu.type.icon, 0, 1);
        ctx.restore();
      } else if (item.kind === 'actor') {
        drawFallGuyCharacterOnScene(item.actor, item.proj);
      } else if (item.kind === 'particle') {
        const { pt, proj } = item;
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, pt.size * proj.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ==================== ОБНОВЛЕНИЕ HUD И ГАРДЕРОБА ====================
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
    document.getElementById('hud-crowns').textContent = String(saveData.crowns);

    const cdDiveEl = document.getElementById('cd-dive');
    if (p && p.diveCooldown > 0) {
      cdDiveEl.style.height = `${(p.diveCooldown / 2.2) * 100}%`;
    } else {
      cdDiveEl.style.height = '0%';
    }

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
    if (crowns >= 8) return '💎 Алмазная Фасолька';
    if (crowns >= 4) return '🔥 Мастер Арены';
    if (crowns >= 1) return '⭐ Обладатель Короны';
    return '🐣 Новичок Шоу';
  }

  function openLeaderboard() {
    const tbody = document.getElementById('lb-tbody');
    const combined = [
      ...saveData.rivalStandings.map(r => ({ ...r, isMe: false })),
      {
        name: saveData.playerName || 'СуперФасолька',
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
    state.phase = 'menu';
    document.getElementById('countdown-overlay').classList.add('hidden');
    document.getElementById('winner-banner-overlay').classList.add('hidden');
    document.getElementById('spectator-bar').classList.add('hidden');
    document.getElementById('start-modal').classList.remove('hidden');
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('lb-modal').classList.add('hidden');
  }

  function toggleSound() {
    sfx.muted = !sfx.muted;
    document.getElementById('btn-sound').textContent = sfx.muted ? '🔇' : '🔊';
  }

  // ==================== ПРИВЯЗКА UI СОБЫТИЙ ====================
  document.querySelectorAll('.diff-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.diffKey = card.dataset.diff;
      saveData.difficulty = state.diffKey;
      saveGameData();
    });
  });

  document.querySelectorAll('.skin-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.skin-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveData.skinIndex = Number(btn.dataset.skin) || 0;
      const skinObj = SKINS[saveData.skinIndex % SKINS.length];
      document.getElementById('skin-preview-title').textContent = skinObj.title;
      saveGameData();
    });
  });

  const nameInput = document.getElementById('player-name-input');
  nameInput.value = saveData.playerName || 'СуперФасолька';
  nameInput.addEventListener('input', () => {
    saveData.playerName = nameInput.value.trim() || 'СуперФасолька';
    saveGameData();
  });

  document.getElementById('btn-random-nick').addEventListener('click', () => {
    const randomName = generateFunnyBotNames(1)[0];
    nameInput.value = randomName;
    saveData.playerName = randomName;
    saveGameData();
  });

  document.getElementById('btn-start-match').addEventListener('click', () => {
    saveData.playerName = nameInput.value.trim() || 'СуперФасолька';
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
  document.getElementById('btn-spec-next').addEventListener('click', () => {
    state.spectateIdx++;
    state.spectateTarget = null;
  });

  document.getElementById('btn-spec-fast').addEventListener('click', (e) => {
    state.spectateSpeed = state.spectateSpeed === 1 ? 2.2 : 1;
    e.currentTarget.textContent = state.spectateSpeed > 1 ? '⏩ Скорость x2.2 (Вкл)' : '⏩ Ускорить x2';
  });

  document.getElementById('btn-spec-skip').addEventListener('click', () => {
    const aliveList = state.actors.filter(a => a.alive);
    triggerWinnerCelebration(aliveList[0] || state.player);
  });

  // ==================== ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ + ПРЕВЬЮ ФАСОЛИНКИ В ГАРДЕРОБЕ ====================
  const previewCanvas = document.getElementById('skin-preview-canvas');
  const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

  buildArena(state.config);
  updateHUD();

  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state.phase === 'menu') {
      state.cameraYaw += dt * 0.14;
      state.targetCameraYaw = state.cameraYaw;

      // Отрисовка живой анимированной фасолинки в Гардеробе стартового окна
      if (previewCtx) {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        const curSkin = SKINS[saveData.skinIndex % SKINS.length];
        drawBeanAvatar(previewCtx, 65, 112, 1.55, curSkin, now * 0.002, 'run');
      }
    } else {
      updateWorld(dt);
    }

    renderScene();
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
