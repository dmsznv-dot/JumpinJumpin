/**
 * HEX-A-GONE 3D SHOW (v3.0 — True 3D WebGL / Three.js + CC0 GLB Models)
 *
 * Реализация по итогам /grill-me:
 * 1. Честное 3D на Three.js (PerspectiveCamera + аппаратный Z-buffer + мягкие тени) — никто никогда не просвечивает сквозь гексы.
 * 2. Непрерывная проверка коллизий с цилиндром гекса (+15% coyote ledge) — фасолинки стоят строго на верхней грани 3D-плиток и не проваливаются сквозь текстуры.
 * 3. Полноценная 3D-локация телешоу Fall Guys (Hex-A-GoneIntroLegacy.gif):
 *    - Стартовый пролёт 3D-камеры вдоль башни ярусов перед отсчётом 3..2..1..СТАРТ!
 *    - Огромное волнующееся море розовой слизи (Slime Sea) внизу, неоновые колонны по периметру, прожекторы, флаги и облака из CC0 .glb ассетов Kenney.
 * 4. Объёмные 3D-фасолинки с лицевым визором, глазками, 3D-шляпами/коронами, шарнирными ручками и ботиночками + скелетно-процедурные 3D-анимации.
 * 5. Соты при наступании один раз меняют цвет, проседают, затем плавно падают вниз и исчезают через прозрачность (без мерцания).
 * 6. Ускоренное на ~35% пропорциональное восстановление (FIFO очередь: 4.5с / 5.5с / 6.5с): первая упавшая сота первой всплывает снизу.
 */

import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// ==================== 1. КОНФИГУРАЦИЯ СЛОЖНОСТИ И УСКОРЕННЫЙ РЕГЕН ====================
const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Чилл-Разминка',
    botsCount: 7,
    layersCount: 2,
    gridRadius: 5,
    stepHoldTime: 1.35,   // сота меняет цвет и держит 1.35с
    fallDuration: 0.85,   // плавное падение и растворение
    regenDelay: 4.5,      // ускоренный пропорциональный реген (4.5 сек!)
    botIQ: 0.50,
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
    stepHoldTime: 1.00,
    fallDuration: 0.80,
    regenDelay: 5.5,      // 5.5 сек на Классике
    botIQ: 0.72,
    powerupInterval: 4.5,
    specialTileChance: 0.12,
    scoreMult: 1.5
  },
  hard: {
    id: 'hard',
    name: 'Кибер-Финал',
    botsCount: 11,
    layersCount: 4,
    gridRadius: 5,
    stepHoldTime: 0.72,
    fallDuration: 0.75,
    regenDelay: 6.5,      // 6.5 сек на Хардкоре
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
    stepHoldTime: 0.82,
    fallDuration: 0.78,
    regenDelay: 4.8,      // быстрый реген в Мега-Хаосе
    botIQ: 0.82,
    powerupInterval: 2.8,
    specialTileChance: 0.26,
    scoreMult: 2.5
  }
};

// Цвета ярусов как в оригинальном Hex-A-Gone (Синий -> Жёлтый -> Фиолетовый -> Розовый/Зелёный)
const LAYER_THEMES = [
  { name: 'Голубой Верх',       top: 0x00d8ff, rim: 0x0077a8, steppedTop: 0xff9100, steppedRim: 0xb25000 },
  { name: 'Солнечный Ярус',     top: 0xffd600, rim: 0xc68400, steppedTop: 0xff3d71, steppedRim: 0xa00037 },
  { name: 'Фиолетовый Шторм',   top: 0xb388ff, rim: 0x6200ea, steppedTop: 0xff6d00, steppedRim: 0x9b3000 },
  { name: 'Изумрудное Дно',     top: 0x00e676, rim: 0x008c44, steppedTop: 0xff2a85, steppedRim: 0x880e4f }
];

// ==================== КАТАЛОГ ЦВЕТОВЫХ ПАЛИТР И КОСТЮМОВ (ЛОББИ И МАГАЗИН FALL GUYS) ====================
const COLOR_PALETTES = [
  { id: 'c_pink_yellow', title: 'Розовый Фламинго',  c1: 0xff2a85, c2: 0xffe600, css1: '#ff2a85', css2: '#ffe600', rarity: 'ОБЫЧНЫЙ',    unlockType: 'free',   cost: 0 },
  { id: 'c_cyan_blue',   title: 'Неоновая Лазурь',   c1: 0x00e5ff, c2: 0x1e40af, css1: '#00e5ff', css2: '#1e40af', rarity: 'ОБЫЧНЫЙ',    unlockType: 'free',   cost: 0 },
  { id: 'c_lime_choco',  title: 'Мятный Пончик',     c1: 0x00e676, c2: 0x3e2723, css1: '#00e676', css2: '#3e2723', rarity: 'ОБЫЧНЫЙ',    unlockType: 'free',   cost: 0 },
  { id: 'c_orange_cyan', title: 'Светофор Тусовки',  c1: 0xff9100, c2: 0x00e5ff, css1: '#ff9100', css2: '#00e5ff', rarity: 'РЕДКИЙ',     unlockType: 'ad',     cost: 0 },
  { id: 'c_purple_lime', title: 'Кибер-Виноград',    c1: 0xd500f9, c2: 0x76ff03, css1: '#d500f9', css2: '#76ff03', rarity: 'РЕДКИЙ',     unlockType: 'ad',     cost: 0 },
  { id: 'c_red_white',   title: 'Клубничный Крем',   c1: 0xff1744, c2: 0xffffff, css1: '#ff1744', css2: '#ffffff', rarity: 'РЕДКИЙ',     unlockType: 'kudos',  cost: 400 },
  { id: 'c_aqua_pink',   title: 'Сахарная Вата',     c1: 0x26c6da, c2: 0xf8bbd0, css1: '#26c6da', css2: '#f8bbd0', rarity: 'ЭПИЧЕСКИЙ',  unlockType: 'kudos',  cost: 800 },
  { id: 'c_gold_ruby',   title: 'Королевское Золото',c1: 0xffd700, c2: 0xb71c1c, css1: '#ffd700', css2: '#b71c1c', rarity: 'ЛЕГЕНДА',    unlockType: 'crowns', cost: 1 }
];

const COSTUME_ITEMS = [
  { id: 'hat_none',    title: 'Классическая Фасоль', icon: '🙂', hat: 'none',    rarity: 'ОБЫЧНЫЙ',   unlockType: 'free',   cost: 0 },
  { id: 'hat_ears',    title: 'Ушки Тигрёнка',       icon: '🐯', hat: 'ears',    rarity: 'ОБЫЧНЫЙ',   unlockType: 'ad',     cost: 0 },
  { id: 'hat_chef',    title: 'Повар Пельмешек',     icon: '🍓', hat: 'chef',    rarity: 'РЕДКИЙ',    unlockType: 'ad',     cost: 0 },
  { id: 'hat_dino',    title: 'Дино-Гребень',        icon: '🦖', hat: 'dino',    rarity: 'РЕДКИЙ',    unlockType: 'ad',     cost: 0 },
  { id: 'hat_horns',   title: 'Кибер-Рожки',         icon: '⚡', hat: 'horns',   rarity: 'РЕДКИЙ',    unlockType: 'kudos',  cost: 600 },
  { id: 'hat_fin',     title: 'Акула Тусовщик',      icon: '🦈', hat: 'fin',     rarity: 'ЭПИЧЕСКИЙ', unlockType: 'crowns', cost: 1 },
  { id: 'hat_antenna', title: 'Космо-Пришелец',      icon: '👽', hat: 'antenna', rarity: 'ЭПИЧЕСКИЙ', unlockType: 'crowns', cost: 2 },
  { id: 'hat_crown',   title: 'Золотая Корона',      icon: '👑', hat: 'crown',   rarity: 'ЛЕГЕНДА',   unlockType: 'crowns', cost: 3 }
];

const SEASON_TIERS = [
  { level: 1, xpReq: 0,    title: 'Старт Сезона',       icon: '🎨', rewardText: 'Базовые цвета' },
  { level: 2, xpReq: 300,  title: 'Бонус Лавров',       icon: '🟣', rewardText: '+300 Лавров' },
  { level: 3, xpReq: 700,  title: 'Светофор Тусовки',   icon: '🟧', rewardText: 'Цвет фасольки' },
  { level: 4, xpReq: 1200, title: 'Дино-Гребень',       icon: '🦖', rewardText: 'Костюм Дино' },
  { level: 5, xpReq: 1800, title: 'Кубок Чемпиона',     icon: '👑', rewardText: '+1 Корона' },
  { level: 6, xpReq: 2500, title: 'Акула Тусовщик',     icon: '🦈', rewardText: 'Эпик Костюм' },
  { level: 7, xpReq: 3500, title: 'Золотая Корона',     icon: '🏆', rewardText: 'Легенда Шоу' }
];

// Совместимый массив SKINS для генерации разнообразных ботов на арене
const SKINS = [
  { id: 0, title: 'Королевский Розовый', icon: '👑', c1: 0xff2a85, c2: 0xffe600, hat: 'crown' },
  { id: 1, title: 'Кибер-Гонщик',        icon: '⚡', c1: 0x00e5ff, c2: 0x1e40af, hat: 'horns' },
  { id: 2, title: 'Дино-Завр',           icon: '🦖', c1: 0x00e676, c2: 0x3e2723, hat: 'dino' },
  { id: 3, title: 'Тигровый Прыгун',     icon: '🐯', c1: 0xff9100, c2: 0x00e5ff, hat: 'ears' },
  { id: 4, title: 'Космо-Пришелец',      icon: '👽', c1: 0xd500f9, c2: 0x76ff03, hat: 'antenna' },
  { id: 5, title: 'Золотой Рыцарь',      icon: '🏆', c1: 0xffd700, c2: 0xb71c1c, hat: 'crown' },
  { id: 6, title: 'Повар Пельмешек',     icon: '🍓', c1: 0xff1744, c2: 0xffffff, hat: 'chef' },
  { id: 7, title: 'Акула-Тусовщик',      icon: '🦈', c1: 0x26c6da, c2: 0xf8bbd0, hat: 'fin' }
];

function getPlayerComposedSkin() {
  const col = COLOR_PALETTES.find(c => c.id === saveData.selectedColorId) || COLOR_PALETTES[0];
  const cos = COSTUME_ITEMS.find(h => h.id === saveData.selectedCostumeId) || COSTUME_ITEMS[0];
  return {
    title: `${col.title} • ${cos.title}`,
    icon: cos.icon,
    c1: col.c1,
    c2: col.c2,
    hat: cos.hat
  };
}

// Типы бонусов
const POWERUP_TYPES = [
  { id: 'speed',   name: 'Турбо-кеды',      icon: '⚡', color: '#00e5ff', hex: 0x00e5ff, duration: 7.0, instant: false },
  { id: 'feather', name: 'Грави-перья',     icon: '🪽', color: '#b388ff', hex: 0xb388ff, duration: 8.0, instant: false },
  { id: 'ghost',   name: 'Призрачный шаг',  icon: '👻', color: '#69f0ae', hex: 0x69f0ae, duration: 5.0, instant: false },
  { id: 'shield',  name: 'Батут-спасение',  icon: '🛡️', color: '#ffd740', hex: 0xffd740, duration: 15.0, instant: false },
  { id: 'shock',   name: 'Ударная волна',   icon: '💥', color: '#ff5252', hex: 0xff5252, duration: 0,   instant: true },
  { id: 'builder', name: 'Гекса-Строитель', icon: '🛠️', color: '#00e676', hex: 0x00e676, duration: 0,   instant: true }
];

// Генератор смешных ников
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
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
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
      osc.frequency.setValueAtTime(320 + Math.random() * 50, now);
      osc.frequency.exponentialRampToValueAtTime(175, now + 0.08);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (type === 'break') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'regen') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(590, now + 0.12);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'jump') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === 'spring') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.32);
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
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.35);
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
      osc.frequency.setValueAtTime(490, now);
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

// ==================== 3D МИРОВЫЕ КОНСТАНТЫ (В МЕТРАХ THREE.JS) ====================
// В Three.js Y — это высота вверх, а X и Z — горизонтальная плоскость гекса-яруса!
const HEX_RADIUS = 2.25;      // радиус одной шестиугольной 3D-плитки
const HEX_GAP_SCALE = 0.94;   // небольшой зазор между сотами для чёткой читаемости
const HEX_THICKNESS = 0.55;   // толщина 3D-призмы соты
const LAYER_HEIGHT_GAP = 10.5;// расстояние по высоте (Y) между ярусами
const SQRT3 = Math.sqrt(3);

function axialToWorldXZ(q, r) {
  const x = HEX_RADIUS * SQRT3 * (q + r * 0.5);
  const z = HEX_RADIUS * 1.5 * r;
  return { x, z };
}

function worldXZToAxial(x, z) {
  const q = (SQRT3 / 3 * x - 1 / 3 * z) / HEX_RADIUS;
  const r = (2 / 3 * z) / HEX_RADIUS;
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

  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;

  return { q: rx, r: rz };
}

function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

// ==================== СОХРАНЕНИЯ И ЛИДЕРБОРД ====================
const STORAGE_KEY = 'hex_fall_guys_save_v4';

function loadSaveData() {
  let data = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('hex_fall_guys_save_v3');
    if (raw) data = JSON.parse(raw);
  } catch (e) {}

  const defaults = {
    playerName: 'СуперФасолька',
    skinIndex: 0,
    selectedColorId: 'c_lime_choco',
    selectedCostumeId: 'hat_none',
    unlockedColors: ['c_pink_yellow', 'c_cyan_blue', 'c_lime_choco'],
    unlockedCostumes: ['hat_none'],
    difficulty: 'normal',
    crowns: 0,
    kudos: 350,
    seasonXP: 120,
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

  if (!data) return defaults;
  return {
    ...defaults,
    ...data,
    unlockedColors: Array.isArray(data.unlockedColors) ? data.unlockedColors : defaults.unlockedColors,
    unlockedCostumes: Array.isArray(data.unlockedCostumes) ? data.unlockedCostumes : defaults.unlockedCostumes
  };
}

function saveGameData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (e) {}
}

let saveData = loadSaveData();

// ==================== ИНИЦИАЛИЗАЦИЯ ЧЕСТНОЙ 3D СЦЕНЫ (THREE.JS) ====================
const canvas = document.getElementById('game-canvas');
const labelsLayer = document.getElementById('labels-layer');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true, // прозрачный фон в Лобби, чтобы были видны анимированные круги Fall Guys!
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = null; // в Лобби прозрачный, в матче включаем 0x180e3a

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 320);

// Освещение телешоу Fall Guys
const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x4a148c, 1.15);
hemiLight.position.set(0, 60, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
dirLight.position.set(28, 58, 32);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 5;
dirLight.shadow.camera.far = 140;
const dCam = 36;
dirLight.shadow.camera.left = -dCam;
dirLight.shadow.camera.right = dCam;
dirLight.shadow.camera.top = dCam;
dirLight.shadow.camera.bottom = -dCam;
dirLight.shadow.bias = -0.0008;
scene.add(dirLight);

// Розовая подсветка снизу от озера слизи
const slimeGlowLight = new THREE.PointLight(0xff2a85, 2.5, 90);
slimeGlowLight.position.set(0, -14, 0);
scene.add(slimeGlowLight);

// Группы 3D-объектов сцены
const stadiumGroup = new THREE.Group();
const arenaGroup = new THREE.Group();
const actorsGroup = new THREE.Group();
const fxGroup = new THREE.Group();
const lobbyGroup = new THREE.Group(); // 3D-пьедестал и фасолинка крупным планом в главном меню!
scene.add(stadiumGroup);
scene.add(arenaGroup);
scene.add(actorsGroup);
scene.add(fxGroup);
scene.add(lobbyGroup);

// ==================== ПОДГРУЗКА CC0 3D-АССЕТОВ (.GLB KENNEY) ====================
const gltfLoader = new GLTFLoader();
const loadedGLB = {
  coin: null,
  flag: null,
  cloud: null
};

function loadCC0Assets() {
  gltfLoader.load('./assets/models/coin.glb', (gltf) => {
    loadedGLB.coin = gltf.scene;
  }, undefined, () => {});

  gltfLoader.load('./assets/models/flag.glb', (gltf) => {
    loadedGLB.flag = gltf.scene;
    decorateStadiumWithFlags();
  }, undefined, () => {});

  gltfLoader.load('./assets/models/cloud.glb', (gltf) => {
    loadedGLB.cloud = gltf.scene;
    decorateStadiumWithClouds();
  }, undefined, () => {});
}

// ==================== 3D ОКРУЖЕНИЕ СТАДИОНА HEX-A-GONE ====================
let slimeSeaMesh = null;
let stadiumPillars = [];
let stadiumClouds = [];

function buildStadiumEnvironment() {
  stadiumGroup.clear();
  stadiumPillars = [];

  // 1. Волнующееся море ярко-розовой слизи внизу (Slime Sea)
  const slimeGeo = new THREE.CylinderGeometry(135, 135, 4, 48, 1, false);
  const slimeMat = new THREE.MeshStandardMaterial({
    color: 0xff2a85,
    emissive: 0xc80055,
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.1
  });
  slimeSeaMesh = new THREE.Mesh(slimeGeo, slimeMat);
  slimeSeaMesh.position.set(0, -16, 0);
  slimeSeaMesh.receiveShadow = true;
  stadiumGroup.add(slimeSeaMesh);

  // Светящиеся концентрические кольца на поверхности слизи
  for (let i = 1; i <= 4; i++) {
    const ringGeo = new THREE.RingGeometry(i * 15, i * 15 + 0.6, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff80b5,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -13.9;
    stadiumGroup.add(ring);
  }

  // 2. Огромные неоновые колонны телешоу вокруг арены (как в Hex-A-GoneIntroLegacy.gif)
  const numPillars = 12;
  const pillarRadius = 44;
  const pillarColors = [0x00e5ff, 0xff2a85, 0xffe600, 0xb388ff];

  const pillarGeo = new THREE.CylinderGeometry(2.2, 2.8, 95, 16);
  const ringBandGeo = new THREE.TorusGeometry(2.55, 0.32, 10, 24);
  ringBandGeo.rotateX(Math.PI / 2);

  for (let i = 0; i < numPillars; i++) {
    const ang = (i / numPillars) * Math.PI * 2;
    const px = Math.cos(ang) * pillarRadius;
    const pz = Math.sin(ang) * pillarRadius;

    const pGroup = new THREE.Group();
    pGroup.position.set(px, 22, pz);

    const pMat = new THREE.MeshStandardMaterial({
      color: 0x261758,
      roughness: 0.5,
      metalness: 0.25
    });
    const pillar = new THREE.Mesh(pillarGeo, pMat);
    pGroup.add(pillar);

    // Неоновые светящиеся кольца вдоль каждой колонны
    const neonCol = pillarColors[i % pillarColors.length];
    const neonMat = new THREE.MeshBasicMaterial({ color: neonCol });
    for (let h = -30; h <= 35; h += 13) {
      const band = new THREE.Mesh(ringBandGeo, neonMat);
      band.position.y = h;
      pGroup.add(band);
    }

    // Купол-прожектор на вершине колонны
    const topDome = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: neonCol })
    );
    topDome.position.y = 48;
    pGroup.add(topDome);

    stadiumGroup.add(pGroup);
    stadiumPillars.push(pGroup);
  }
}

function decorateStadiumWithFlags() {
  if (!loadedGLB.flag) return;
  stadiumPillars.forEach((pGroup) => {
    const flagClone = loadedGLB.flag.clone();
    flagClone.scale.set(4.5, 4.5, 4.5);
    flagClone.position.set(0, 49.5, 0);
    pGroup.add(flagClone);
  });
}

function decorateStadiumWithClouds() {
  if (!loadedGLB.cloud) return;
  stadiumClouds = [];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const dist = 56 + (i % 3) * 14;
    const cloud = loadedGLB.cloud.clone();
    const s = 4.5 + (i % 4) * 1.5;
    cloud.scale.set(s, s, s);
    cloud.position.set(Math.cos(ang) * dist, 10 + (i % 4) * 11, Math.sin(ang) * dist);
    cloud.rotation.y = -ang + Math.PI / 2;
    stadiumGroup.add(cloud);
    stadiumClouds.push({ mesh: cloud, baseAngle: ang, dist, speed: 0.03 + (i % 3) * 0.015 });
  }
}

// ==================== 3D ПЬЕДЕСТАЛ И ФАСОЛИНКА КРУПНЫМ ПЛАНОМ В ГЛАВНОМ МЕНЮ ====================
let lobbyBeanRig = null;
let lobbyPodiumGroup = null;
let lobbyActiveTab = 'play';
let lobbyBeanYaw = 0;
let lobbyTargetBeanYaw = 0;

function buildLobbyPedestalScene() {
  lobbyGroup.clear();
  lobbyPodiumGroup = new THREE.Group();
  lobbyGroup.add(lobbyPodiumGroup);

  // Мягкая розовая подушка пьедестала (как на скриншотах Fall Guys!)
  const cushionGeo = new THREE.CylinderGeometry(1.18, 1.15, 0.38, 36);
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0xff2ae5,
    roughness: 0.25,
    metalness: 0.08
  });
  const cushion = new THREE.Mesh(cushionGeo, cushionMat);
  cushion.position.y = -0.19;
  cushion.receiveShadow = true;
  lobbyPodiumGroup.add(cushion);

  // Верхний глянцевый бортик подушки
  const torusRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.14, 0.075, 16, 42),
    new THREE.MeshStandardMaterial({ color: 0xff66f0, roughness: 0.2 })
  );
  torusRim.rotation.x = Math.PI / 2;
  torusRim.position.y = -0.02;
  lobbyPodiumGroup.add(torusRim);

  // Фиолетовая колонна под подушкой
  const baseCol = new THREE.Mesh(
    new THREE.CylinderGeometry(1.06, 1.12, 2.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x7b1fa2, roughness: 0.4 })
  );
  baseCol.position.y = -1.45;
  lobbyPodiumGroup.add(baseCol);

  // Золотое кольцо вокруг колонны пьедестала
  const goldBand = new THREE.Mesh(
    new THREE.TorusGeometry(1.10, 0.06, 12, 36),
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.25 })
  );
  goldBand.rotation.x = Math.PI / 2;
  goldBand.position.y = -0.42;
  lobbyPodiumGroup.add(goldBand);

  rebuildLobbyBeanModel();
}

function rebuildLobbyBeanModel() {
  if (!lobbyPodiumGroup) return;
  if (lobbyBeanRig) {
    lobbyPodiumGroup.remove(lobbyBeanRig.root);
  }
  const skin = getPlayerComposedSkin();
  lobbyBeanRig = createBean3DMesh(skin);
  lobbyBeanRig.root.position.set(0, 0, 0);
  lobbyPodiumGroup.add(lobbyBeanRig.root);
}

function updateLobby3D(dt, nowSec) {
  if (!lobbyPodiumGroup || !lobbyBeanRig) return;

  // Плавное вращение фасолинки на пьедестале
  lobbyBeanYaw += (lobbyTargetBeanYaw - lobbyBeanYaw) * Math.min(1, dt * 10);
  lobbyBeanRig.bodyPivot.rotation.y = lobbyBeanYaw;

  // Живая анимация дыхания и приветственного помахивания на пьедестале
  const breath = Math.sin(nowSec * 3.0);
  lobbyBeanRig.bodyPivot.position.y = breath * 0.035;
  lobbyBeanRig.bodyPivot.rotation.z = Math.sin(nowSec * 1.5) * 0.035;
  lobbyBeanRig.leftArm.rotation.x = Math.sin(nowSec * 2.5) * 0.18;
  lobbyBeanRig.rightArm.rotation.x = -Math.sin(nowSec * 2.5) * 0.18;

  // В зависимости от открытой вкладки Лобби пьедестал плавно смещается:
  // - В 'play' — строго по центру
  // - В 'custom' — слева (x = -1.35), чтобы справа помещалась панель цветов и костюмов (как на скрине 4)
  // - В 'season' — справа (x = 1.25), чтобы слева была карточка сезона (как на скрине 2)
  // - В 'shop' и 'settings' — скрываем 3D-пьедестал, чтобы не перекрывал витрину магазина
  let targetX = 0;
  let targetY = 0;
  let visible = true;

  if (lobbyActiveTab === 'custom') {
    targetX = -1.35;
    targetY = -0.05;
  } else if (lobbyActiveTab === 'season') {
    targetX = 1.25;
    targetY = 0.05;
  } else if (lobbyActiveTab === 'shop' || lobbyActiveTab === 'settings') {
    visible = false;
  }

  lobbyGroup.visible = visible;
  lobbyPodiumGroup.position.x += (targetX - lobbyPodiumGroup.position.x) * Math.min(1, dt * 8);
  lobbyPodiumGroup.position.y += (targetY - lobbyPodiumGroup.position.y) * Math.min(1, dt * 8);

  // Камера крупным планом смотрит прямо на пьедестал
  camera.position.set(0, 1.25, 4.45);
  camera.lookAt(0, 0.95, 0);
}

// ==================== ОБЩИЕ 3D-ГЕОМЕТРИИ ДЛЯ ГЕКСА-ПЛИТОК ====================
// Создаём шестиугольную призму с верхним цветным слоем и нижней окантовкой (как настоящие плитки Fall Guys)
const sharedHexTopGeo = new THREE.CylinderGeometry(
  HEX_RADIUS * HEX_GAP_SCALE,
  HEX_RADIUS * HEX_GAP_SCALE * 0.96,
  HEX_THICKNESS * 0.65,
  6
);
const sharedHexRimGeo = new THREE.CylinderGeometry(
  HEX_RADIUS * HEX_GAP_SCALE * 0.96,
  HEX_RADIUS * HEX_GAP_SCALE * 0.86,
  HEX_THICKNESS * 0.45,
  6
);
const sharedHexInnerRingGeo = new THREE.RingGeometry(
  HEX_RADIUS * 0.48,
  HEX_RADIUS * 0.64,
  6
);
sharedHexInnerRingGeo.rotateX(-Math.PI / 2);
sharedHexInnerRingGeo.rotateY(Math.PI / 6);

// ==================== СОСТОЯНИЕ ИГРЫ И 3D-КАМЕРЫ ====================
const CAM_PRESETS = [
  { label: 'За спиной', dist: 14.5, height: 8.2 },
  { label: 'Крупно',    dist: 10.5, height: 5.8 },
  { label: 'Средне',    dist: 19.0, height: 11.5 },
  { label: 'Обзорно',   dist: 25.0, height: 15.5 }
];

let state = {
  phase: 'menu', // 'menu' | 'intro_flyover' | 'countdown' | 'playing' | 'celebrating' | 'gameover'
  diffKey: saveData.difficulty || 'normal',
  config: DIFFICULTIES[saveData.difficulty || 'normal'],
  elapsed: 0,
  introTimer: 0,
  countdownTimer: 3.2,
  celebrationTimer: 0,
  matchWinner: null,

  // Параметры 3D-камеры от третьего лица
  camYaw: 0,
  targetCamYaw: 0,
  camPitchOffset: 0,
  presetIdx: 0,
  camDist: CAM_PRESETS[0].dist,
  camHeight: CAM_PRESETS[0].height,
  camFocusPos: new THREE.Vector3(0, 10, 0),
  lastManualOrbitTime: -10,

  spectateSpeed: 1,
  spectateIdx: 0,
  spectateTarget: null,

  layers: [],
  regenQueue: [], // FIFO очередь пропорционального восстановления сот
  actors: [],
  player: null,
  powerups: [],
  particles: [],
  shockwaves: [],
  eliminationOrder: [],
  powerupSpawnTimer: 3.5,
  eventTimer: 18.0
};

// ==================== КЛАСС 3D ГЕКСА-ПЛИТКИ ====================
class HexTile3D {
  constructor(layerIndex, q, r, yHeight, specialType = 'normal') {
    this.layerIndex = layerIndex;
    this.q = q;
    this.r = r;
    this.key = `${q},${r}`;

    const pos = axialToWorldXZ(q, r);
    this.x = pos.x;
    this.z = pos.z;
    this.baseY = yHeight; // уровень верхней грани плитки, по которой бегают фасолинки

    this.specialType = specialType; // 'normal' | 'spring' | 'gold' | 'bomb'
    this.theme = LAYER_THEMES[layerIndex % LAYER_THEMES.length];

    // Статусы: 'solid' | 'stepped' | 'falling' | 'waiting' | 'restoring'
    this.status = 'solid';
    this.timer = 0;
    this.fallDuration = 0.8;
    this.offsetY = 0;
    this.alpha = 1;
    this.lastTouchedBy = null;

    // 3D меш соты
    this.group = new THREE.Group();
    this.group.position.set(this.x, this.baseY, this.z);

    let initTopCol = this.theme.top;
    let initRimCol = this.theme.rim;
    if (specialType === 'spring') {
      initTopCol = 0x00e676;
      initRimCol = 0x009624;
    } else if (specialType === 'gold') {
      initTopCol = 0xffd740;
      initRimCol = 0xc68400;
    } else if (specialType === 'bomb') {
      initTopCol = 0xff5252;
      initRimCol = 0xb71c1c;
    }
    this.baseTopCol = initTopCol;
    this.baseRimCol = initRimCol;

    this.topMat = new THREE.MeshStandardMaterial({
      color: initTopCol,
      roughness: 0.28,
      metalness: 0.08,
      transparent: false,
      opacity: 1
    });
    this.rimMat = new THREE.MeshStandardMaterial({
      color: initRimCol,
      roughness: 0.45,
      metalness: 0.15,
      transparent: false,
      opacity: 1
    });

    // Смещаем цилиндры внутри группы так, чтобы верхняя крышка лежала ровно на y = 0 (т.е. worldY = this.baseY)
    const topMesh = new THREE.Mesh(sharedHexTopGeo, this.topMat);
    topMesh.position.y = -HEX_THICKNESS * 0.325;
    topMesh.receiveShadow = true;
    topMesh.castShadow = true;
    this.group.add(topMesh);

    const rimMesh = new THREE.Mesh(sharedHexRimGeo, this.rimMat);
    rimMesh.position.y = -HEX_THICKNESS * 0.775;
    this.group.add(rimMesh);

    // Внутренний светлый шестиугольный контур на крышке (как в Fall Guys)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35
    });
    this.innerRing = new THREE.Mesh(sharedHexInnerRingGeo, ringMat);
    this.innerRing.position.y = 0.015;
    this.group.add(this.innerRing);

    arenaGroup.add(this.group);
  }

  setTransparency(alpha) {
    const needTrans = alpha < 0.99;
    if (this.topMat.transparent !== needTrans) {
      this.topMat.transparent = needTrans;
      this.rimMat.transparent = needTrans;
      this.topMat.needsUpdate = true;
      this.rimMat.needsUpdate = true;
    }
    this.topMat.opacity = alpha;
    this.rimMat.opacity = alpha;
    this.innerRing.material.opacity = alpha * 0.35;
  }

  triggerStep(actor, config) {
    if (this.status !== 'solid') return;
    if (actor && actor.buffs.ghost > 0) return;

    if (this.specialType === 'spring' && actor && actor.vy <= 1.0) {
      actor.vy = 21.5;
      actor.onGround = false;
      actor.squash = -0.32;
      sfx.play('spring');
      spawnParticles3D(this.x, this.baseY + 0.5, this.z, 0x00e676, 12);
    }

    // Один раз меняем цвет на яркий сигнальный оттенок и слегка проседаем вниз (без мигания!)
    this.status = 'stepped';
    const mult = this.specialType === 'gold' ? 2.2 : 1.0;
    this.timer = config.stepHoldTime * mult;
    this.fallDuration = config.fallDuration;
    this.lastTouchedBy = actor;

    this.topMat.color.setHex(this.theme.steppedTop);
    this.topMat.emissive.setHex(this.theme.steppedTop);
    this.topMat.emissiveIntensity = 0.25;
    this.rimMat.color.setHex(this.theme.steppedRim);

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

    if (this.lastTouchedBy && this.lastTouchedBy.isPlayer) {
      sfx.play('break');
    }

    // Ставим в пропорциональную очередь восстановления (FIFO)
    enqueueTileForProportionalRegen(this, config);

    // Взрывная сота активирует соседей
    if (this.specialType === 'bomb') {
      sfx.play('shock');
      spawnShockwave3D(this.x, this.baseY + 0.1, this.z, HEX_RADIUS * 2.6, 0xff5252);
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
      dirs.forEach(([dq, dr]) => {
        const nb = layerMap.get(`${this.q + dq},${this.r + dr}`);
        if (nb && nb.status === 'solid') {
          nb.triggerStep(this.lastTouchedBy, config);
          nb.timer = 0.28;
        }
      });
    }
  }

  instantRepair() {
    if (this.status !== 'solid') {
      this.status = 'restoring';
      this.timer = 0.42;
      this.group.visible = true;
      this.topMat.color.setHex(this.baseTopCol);
      this.topMat.emissive.setHex(0x000000);
      this.topMat.emissiveIntensity = 0;
      this.rimMat.color.setHex(this.baseRimCol);
      state.regenQueue = state.regenQueue.filter(item => item.tile !== this);
    }
  }

  update(dt, config, layerMap) {
    if (this.status === 'stepped') {
      this.timer -= dt;
      this.offsetY += (-0.18 - this.offsetY) * Math.min(1, dt * 14);
      this.group.position.y = this.baseY + this.offsetY;
      if (this.timer <= 0) {
        this.startFalling(config, layerMap);
      }
    } else if (this.status === 'falling') {
      this.timer -= dt;
      const p = 1 - Math.max(0, this.timer / this.fallDuration);
      this.offsetY = -0.18 - (p * p) * 7.5;
      this.alpha = Math.max(0, 1 - p);
      const sc = 1 - p * 0.22;

      this.group.position.y = this.baseY + this.offsetY;
      this.group.scale.set(sc, 1, sc);
      this.setTransparency(this.alpha);

      if (this.timer <= 0) {
        this.status = 'waiting';
        this.group.visible = false;
      }
    } else if (this.status === 'restoring') {
      this.timer -= dt;
      const p = 1 - Math.max(0, this.timer / 0.42);
      this.offsetY = (1 - p) * -2.5;
      const sc = 0.75 + 0.25 * p;

      this.group.visible = true;
      this.group.position.y = this.baseY + this.offsetY;
      this.group.scale.set(sc, 1, sc);
      this.setTransparency(p);

      if (this.timer <= 0) {
        this.status = 'solid';
        this.offsetY = 0;
        this.alpha = 1;
        this.group.position.y = this.baseY;
        this.group.scale.set(1, 1, 1);
        this.setTransparency(1);
      }
    }
  }
}

// Пропорциональная FIFO-очередь восстановления сот (первая разрушенная — первой восстановится)
function enqueueTileForProportionalRegen(tile, config) {
  const desiredTime = state.elapsed + config.regenDelay;
  const lastEntry = state.regenQueue[state.regenQueue.length - 1];
  const minNextTime = lastEntry ? lastEntry.restoreAt + 0.12 : 0;
  const restoreAt = Math.max(desiredTime, minNextTime);

  state.regenQueue.push({ tile, restoreAt });
}

function processRegenQueue() {
  while (state.regenQueue.length > 0 && state.elapsed >= state.regenQueue[0].restoreAt) {
    const entry = state.regenQueue.shift();
    const t = entry.tile;
    if (t && (t.status === 'waiting' || t.status === 'falling')) {
      t.status = 'restoring';
      t.timer = 0.42;
      t.group.visible = true;
      t.topMat.color.setHex(t.baseTopCol);
      t.topMat.emissive.setHex(0x000000);
      t.topMat.emissiveIntensity = 0;
      t.rimMat.color.setHex(t.baseRimCol);
    }
  }
}

// ==================== СОЗДАНИЕ 3D-МОДЕЛИ ФАСОЛИНКИ (FALL GUYS BEAN) ====================
function createBean3DMesh(skin) {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const mainMat = new THREE.MeshStandardMaterial({
    color: skin.c1,
    roughness: 0.32,
    metalness: 0.06
  });
  const subMat = new THREE.MeshStandardMaterial({
    color: skin.c2,
    roughness: 0.38,
    metalness: 0.08
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x140a28,
    roughness: 0.2
  });

  // 1. Туловище-капсула (Bean Torso)
  const torsoGeo = new THREE.CapsuleGeometry(0.62, 0.56, 16, 24);
  const torsoMesh = new THREE.Mesh(torsoGeo, mainMat);
  torsoMesh.position.y = 1.12;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  // Нижний пояс / штанишки
  const pantsGeo = new THREE.CylinderGeometry(0.635, 0.58, 0.42, 24);
  const pantsMesh = new THREE.Mesh(pantsGeo, subMat);
  pantsMesh.position.y = 0.78;
  bodyPivot.add(pantsMesh);

  // 2. Белое лицевое окошко (Faceplate Visor) спереди (+Z направление взгляда)
  const faceplateGeo = new THREE.SphereGeometry(0.44, 20, 16);
  faceplateGeo.scale(1.05, 0.76, 0.45);
  const faceplateMesh = new THREE.Mesh(faceplateGeo, whiteMat);
  faceplateMesh.position.set(0, 1.28, 0.45);
  bodyPivot.add(faceplateMesh);

  // Выразительные глазки-бусинки
  const eyeGeo = new THREE.CapsuleGeometry(0.065, 0.07, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, darkMat);
  leftEye.position.set(-0.16, 1.30, 0.63);
  bodyPivot.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, darkMat);
  rightEye.position.set(0.16, 1.30, 0.63);
  bodyPivot.add(rightEye);

  // 3. Шарнирные ножки с ботиночками
  const legGeo = new THREE.CapsuleGeometry(0.17, 0.24, 8, 12);
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.27, 0.42, 0);
  const leftFoot = new THREE.Mesh(legGeo, subMat);
  leftFoot.position.y = -0.15;
  leftFoot.castShadow = true;
  leftLeg.add(leftFoot);
  bodyPivot.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.27, 0.42, 0);
  const rightFoot = new THREE.Mesh(legGeo, subMat);
  rightFoot.position.y = -0.15;
  rightFoot.castShadow = true;
  rightLeg.add(rightFoot);
  bodyPivot.add(rightLeg);

  // 4. Шарнирные ручки
  const armGeo = new THREE.CapsuleGeometry(0.145, 0.34, 8, 12);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.68, 1.18, 0);
  const leftHand = new THREE.Mesh(armGeo, mainMat);
  leftHand.position.y = -0.18;
  leftHand.castShadow = true;
  leftArm.add(leftHand);
  leftArm.rotation.z = 0.22;
  bodyPivot.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.68, 1.18, 0);
  const rightHand = new THREE.Mesh(armGeo, mainMat);
  rightHand.position.y = -0.18;
  rightHand.castShadow = true;
  rightArm.add(rightHand);
  rightArm.rotation.z = -0.22;
  bodyPivot.add(rightArm);

  // 5. 3D Аксессуар / Корона / Шляпа на макушке
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 1.98, 0);
  bodyPivot.add(hatGroup);

  if (skin.hat === 'crown') {
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.65, roughness: 0.2 });
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.26, 7), crownMat);
    hatGroup.add(crownBase);
  } else if (skin.hat === 'dino') {
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), subMat);
      spike.position.set(0, -0.05, i * 0.24);
      hatGroup.add(spike);
    }
  } else if (skin.hat === 'ears') {
    const earGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const e1 = new THREE.Mesh(earGeo, subMat);
    e1.position.set(-0.34, -0.06, 0);
    const e2 = new THREE.Mesh(earGeo, subMat);
    e2.position.set(0.34, -0.06, 0);
    hatGroup.add(e1, e2);
  } else if (skin.hat === 'antenna') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), subMat);
    stem.position.y = 0.12;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00e676 }));
    bulb.position.y = 0.32;
    hatGroup.add(stem, bulb);
  } else if (skin.hat === 'chef') {
    const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.38, 16), whiteMat);
    toque.position.y = 0.12;
    hatGroup.add(toque);
  } else if (skin.hat === 'fin') {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 4), mainMat);
    fin.position.y = 0.15;
    hatGroup.add(fin);
  } else if (skin.hat === 'horns') {
    const hGeo = new THREE.ConeGeometry(0.11, 0.34, 8);
    const h1 = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    h1.position.set(-0.28, 0.08, 0);
    h1.rotation.z = 0.35;
    const h2 = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    h2.position.set(0.28, 0.08, 0);
    h2.rotation.z = -0.35;
    hatGroup.add(h1, h2);
  }

  // Тень-блоб под ногами (проектируется ровно на поверхность соты под персонажем для 100% читаемости прыжка!)
  const shadowGeo = new THREE.CircleGeometry(0.65, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  const blobShadow = new THREE.Mesh(shadowGeo, shadowMat);
  blobShadow.position.y = 0.03;
  root.add(blobShadow);

  // Кольцо щита «Батут-спасение»
  const shieldRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.06, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd740 })
  );
  shieldRing.rotation.x = Math.PI / 2;
  shieldRing.position.y = 1.0;
  shieldRing.visible = false;
  root.add(shieldRing);

  return {
    root,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    blobShadow,
    shieldRing,
    mainMat
  };
}

// ==================== КЛАСС УЧАСТНИКА 3D (ИГРОК И БОТЫ) ====================
class Actor3D {
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

    this.radius = 0.72; // радиус капсулы персонажа в метрах
    this.facing = Math.atan2(-startX, -startZ); // угол поворота в плоскости XZ (0 смотрит вдоль +Z)
    this.visualFacing = this.facing;

    this.onGround = true;
    this.currentLayer = 0;
    this.alive = true;
    this.survivalTime = 0;
    this.score = 0;
    this.tilesBroken = 0;

    this.jumpCount = 0;
    this.diveCooldown = 0;
    this.isDiving = false;
    this.diveTimer = 0;

    // 3D анимация
    this.animState = 'idle';
    this.walkCycle = Math.random() * 10;
    this.squash = 0;

    this.buffs = {
      speed: 0,
      feather: 0,
      ghost: 0,
      shield: 0
    };

    this.aiTargetTile = null;
    this.aiRetargetTimer = 0;

    // Создаём 3D-модель фасолинки
    this.rig = createBean3DMesh(skin);
    this.rig.root.position.set(this.x, this.y, this.z);
    actorsGroup.add(this.rig.root);

    // Создаём плавающий 3D-никнейм в DOM
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'bean-label' + (isPlayer ? ' is-player' : '');
    this.labelEl.innerHTML = isPlayer
      ? `<span class="you-arrow">▼ ВЫ</span>${name}`
      : name;
    labelsLayer.appendChild(this.labelEl);
  }

  destroy() {
    actorsGroup.remove(this.rig.root);
    if (this.labelEl && this.labelEl.parentNode) {
      this.labelEl.remove();
    }
  }

  getMaxJumps() {
    return this.buffs.feather > 0 ? 2 : 1;
  }

  jump() {
    if (!this.alive || state.phase !== 'playing') return false;
    if (this.onGround || this.jumpCount < this.getMaxJumps()) {
      const boost = this.buffs.feather > 0 ? 1.22 : 1.0;
      this.vy = 14.2 * boost;
      this.onGround = false;
      this.jumpCount++;
      this.squash = -0.28;
      if (this.isPlayer) sfx.play('jump');
      spawnParticles3D(this.x, this.y + 0.3, this.z, 0xffffff, 6);
      return true;
    }
    return false;
  }

  dive() {
    if (!this.alive || state.phase !== 'playing' || this.diveCooldown > 0) return false;
    this.diveCooldown = 2.1;
    this.isDiving = true;
    this.diveTimer = 0.42;
    this.squash = -0.20;

    const diveSpeed = 13.8;
    this.vx = Math.sin(this.facing) * diveSpeed;
    this.vz = Math.cos(this.facing) * diveSpeed;
    this.vy = this.onGround ? 7.5 : Math.max(this.vy, 6.2);
    this.onGround = false;

    if (this.isPlayer) sfx.play('dive');
    spawnParticles3D(this.x, this.y + 0.8, this.z, 0xff9100, 8);

    // Расталкиваем соперников впереди
    state.actors.forEach(other => {
      if (other !== this && other.alive && Math.abs(other.y - this.y) < 2.5) {
        const dx = other.x - this.x;
        const dz = other.z - this.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.2 && dist > 0.01) {
          other.vx += (dx / dist) * 14.0;
          other.vz += (dz / dist) * 14.0;
          other.vy = 8.5;
          other.onGround = false;
          other.squash = 0.28;
          this.score += 35;
        }
      }
    });

    return true;
  }

  update3DAnimation(dt) {
    this.squash += (0 - this.squash) * Math.min(1, dt * 11);

    let angleDiff = this.facing - this.visualFacing;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.visualFacing += angleDiff * Math.min(1, dt * 13);

    const horizSpeed = Math.hypot(this.vx, this.vz);
    const { root, bodyPivot, leftLeg, rightLeg, leftArm, rightArm, shieldRing, mainMat } = this.rig;

    root.position.set(this.x, this.y, this.z);
    bodyPivot.rotation.y = this.visualFacing;

    // Прозрачность при «Призрачном шаге»
    const ghostActive = this.buffs.ghost > 0;
    if (mainMat.transparent !== ghostActive) {
      mainMat.transparent = ghostActive;
      mainMat.opacity = ghostActive ? 0.6 : 1.0;
      mainMat.needsUpdate = true;
    }
    shieldRing.visible = this.buffs.shield > 0;
    if (shieldRing.visible) shieldRing.rotation.z += dt * 3;

    // Squash & Stretch масштабирование
    const sx = 1 + this.squash * 0.52;
    const sy = 1 - this.squash * 0.52;
    bodyPivot.scale.set(sx, sy, sx);

    if (state.phase === 'celebrating' && state.matchWinner === this) {
      this.walkCycle += dt * 12;
      bodyPivot.position.y = Math.abs(Math.sin(this.walkCycle)) * 0.45;
      bodyPivot.rotation.x = 0;
      leftArm.rotation.x = -2.4 + Math.sin(this.walkCycle * 1.5) * 0.4;
      rightArm.rotation.x = -2.4 - Math.sin(this.walkCycle * 1.5) * 0.4;
      leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.5;
      rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.5;
    } else if (this.isDiving) {
      // Полёт «рыбкой» животом вперёд!
      bodyPivot.position.y = 0.35;
      bodyPivot.rotation.x = 1.25;
      leftArm.rotation.x = -2.2;
      rightArm.rotation.x = -2.2;
      leftLeg.rotation.x = 0.5;
      rightLeg.rotation.x = 0.5;
    } else if (!this.onGround) {
      this.walkCycle += dt * 8;
      bodyPivot.position.y = 0;
      bodyPivot.rotation.x = 0.15;
      leftArm.rotation.x = -1.8 + Math.sin(this.walkCycle) * 0.3;
      rightArm.rotation.x = -1.8 - Math.sin(this.walkCycle) * 0.3;
      leftLeg.rotation.x = 0.45;
      rightLeg.rotation.x = -0.35;
    } else if (horizSpeed > 0.6) {
      // Забавный бег фасолинки вразвалочку
      this.walkCycle += dt * (horizSpeed * 1.85);
      bodyPivot.position.y = Math.abs(Math.sin(this.walkCycle * 2)) * 0.16;
      bodyPivot.rotation.x = 0.22; // наклон вперёд при беге
      bodyPivot.rotation.z = Math.sin(this.walkCycle) * 0.08; // покачивание из стороны в сторону
      const swing = Math.sin(this.walkCycle * 2) * 0.85;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.9;
      rightArm.rotation.x = swing * 0.9;
    } else {
      // Дыхание на месте (Idle)
      this.walkCycle += dt * 3;
      bodyPivot.position.y = Math.sin(this.walkCycle) * 0.04;
      bodyPivot.rotation.x = 0;
      bodyPivot.rotation.z = 0;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      leftArm.rotation.x = Math.sin(this.walkCycle) * 0.1;
      rightArm.rotation.x = -Math.sin(this.walkCycle) * 0.1;
    }
  }
}

// ==================== НЕПРЕРЫВНАЯ ПРОВЕРКА КОЛЛИЗИИ С 3D-ГЕКСАГОНАМИ ====================
// Проверяет, находится ли точка (wx, wz) в пределах шестиугольной соты (включая +15% запас coyote-ledge для комфорта прыжков)
function findSupportingTileOnLayer(layer, wx, wz, actorRadius) {
  const centerAx = worldXZToAxial(wx, wz);
  const candidates = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]
  ];

  const maxSupportDist = HEX_RADIUS * 0.94 + actorRadius * 0.48;
  let bestTile = null;
  let bestDist = 999;

  for (const [dq, dr] of candidates) {
    const t = layer.map.get(`${centerAx.q + dq},${centerAx.r + dr}`);
    if (!t) continue;
    if (t.status !== 'solid' && t.status !== 'stepped' && t.status !== 'restoring') continue;

    const d = Math.hypot(wx - t.x, wz - t.z);
    if (d <= maxSupportDist && d < bestDist) {
      bestDist = d;
      bestTile = t;
    }
  }
  return bestTile;
}

// ==================== ПОСТРОЕНИЕ 3D-БАШНИ И СТАРТ ШОУ ====================
function buildArena3D(config) {
  arenaGroup.clear();
  state.layers = [];
  state.regenQueue = [];
  const R = config.gridRadius;

  for (let l = 0; l < config.layersCount; l++) {
    const yHeight = (config.layersCount - 1 - l) * LAYER_HEIGHT_GAP;
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
        const tile = new HexTile3D(l, q, r, yHeight, special);
        map.set(tile.key, tile);
        list.push(tile);
      }
    }
    state.layers.push({ index: l, yHeight, map, list });
  }
}

function clearActorsAndFX() {
  state.actors.forEach(a => a.destroy());
  state.actors = [];
  labelsLayer.innerHTML = '';

  state.powerups.forEach(p => fxGroup.remove(p.mesh));
  state.powerups = [];

  state.particles.forEach(pt => fxGroup.remove(pt.mesh));
  state.particles = [];

  state.shockwaves.forEach(sw => fxGroup.remove(sw.mesh));
  state.shockwaves = [];
}

function startMatch() {
  const diffKey = state.diffKey;
  const config = DIFFICULTIES[diffKey];
  state.config = config;
  state.elapsed = 0;

  // Сначала 2.4 сек кинематографический пролёт камеры снизу вверх по 3D-башне (как в Hex-A-GoneIntroLegacy.gif), затем отсчёт 3..2..1!
  state.phase = 'intro_flyover';
  state.introTimer = 2.4;
  state.countdownTimer = 3.2;
  state.matchWinner = null;
  state.spectateSpeed = 1;
  state.spectateTarget = null;
  state.eliminationOrder = [];
  state.powerupSpawnTimer = 3.5;
  state.eventTimer = 18.0;

  document.getElementById('event-banner').classList.add('hidden');
  document.getElementById('spectator-bar').classList.add('hidden');
  document.getElementById('winner-banner-overlay').classList.add('hidden');
  document.getElementById('lobby-ui').classList.add('hidden');
  document.getElementById('lobby-bg').classList.add('hidden');
  document.getElementById('ingame-hud-top').classList.remove('hidden');
  document.getElementById('ingame-hud-bottom').classList.remove('hidden');
  document.getElementById('result-modal').classList.add('hidden');
  document.getElementById('lb-modal').classList.add('hidden');
  document.getElementById('killfeed').innerHTML = '';

  // Включаем 3D-арену и фон телешоу
  lobbyGroup.visible = false;
  stadiumGroup.visible = true;
  arenaGroup.visible = true;
  actorsGroup.visible = true;
  fxGroup.visible = true;
  scene.background = new THREE.Color(0x180e3a);
  scene.fog = new THREE.FogExp2(0x180e3a, 0.0065);

  clearActorsAndFX();
  buildArena3D(config);

  const topLayer = state.layers[0];
  const totalActors = 1 + config.botsCount;
  const spawnRing = topLayer.list.filter(
    t => hexDistance(0, 0, t.q, t.r) >= 2 && hexDistance(0, 0, t.q, t.r) <= config.gridRadius - 1
  );

  const playerSkin = getPlayerComposedSkin();
  const pTile = spawnRing[0] || topLayer.list[0];
  const player = new Actor3D(
    'player',
    saveData.playerName || 'СуперФасолька',
    true,
    playerSkin,
    pTile.x,
    topLayer.yHeight,
    pTile.z
  );
  state.player = player;
  state.actors.push(player);

  // Ставим камеру за спину игроку лицом к центру арены
  state.targetCamYaw = player.facing + Math.PI;
  state.camYaw = state.targetCamYaw;
  state.camFocusPos.set(player.x, player.y + 1.2, player.z);

  const botNames = generateFunnyBotNames(config.botsCount);
  for (let i = 0; i < config.botsCount; i++) {
    const angle = ((i + 1) / totalActors) * Math.PI * 2;
    const ringDist = HEX_RADIUS * (config.gridRadius * 1.15);
    const bx = Math.cos(angle) * ringDist;
    const bz = Math.sin(angle) * ringDist;
    const axial = worldXZToAxial(bx, bz);
    const bTile = topLayer.map.get(`${axial.q},${axial.r}`) || spawnRing[(i * 2) % spawnRing.length];

    const botSkin = SKINS[(i + 1) % SKINS.length];
    const bot = new Actor3D(
      `bot_${i}`,
      botNames[i],
      false,
      botSkin,
      bTile.x,
      topLayer.yHeight,
      bTile.z
    );
    state.actors.push(bot);
  }

  // Показываем баннер пролёта камеры
  const cdOverlay = document.getElementById('countdown-overlay');
  const cdBadge = document.getElementById('countdown-badge');
  const cdText = document.getElementById('countdown-text');
  const cdSub = document.getElementById('countdown-sub');
  cdOverlay.classList.remove('hidden');
  cdBadge.textContent = `БАШНЯ HEX-A-GONE: ${config.layersCount} ЯРУСА • ${totalActors} ИГРОКОВ`;
  cdText.textContent = '👀';
  cdSub.textContent = 'Обзор 3D-арены... Приготовьтесь к старту!';

  updateHUD();
}

// ==================== 3D БОНУСЫ, ЧАСТИЦЫ И УДАРНЫЕ ВОЛНЫ ====================
function spawnPowerup3D() {
  const aliveActors = state.actors.filter(a => a.alive);
  if (aliveActors.length === 0) return;

  const sampleActor = aliveActors[Math.floor(Math.random() * aliveActors.length)];
  const layerIdx = Math.min(state.layers.length - 1, Math.max(0, sampleActor.currentLayer));
  const layer = state.layers[layerIdx];
  if (!layer) return;

  const solidTiles = layer.list.filter(t => t.status === 'solid');
  if (solidTiles.length === 0) return;

  const tile = solidTiles[Math.floor(Math.random() * solidTiles.length)];
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];

  const group = new THREE.Group();
  group.position.set(tile.x, layer.yHeight + 1.2, tile.z);

  if (loadedGLB.coin) {
    const cMesh = loadedGLB.coin.clone();
    cMesh.scale.set(2.4, 2.4, 2.4);
    group.add(cMesh);
  } else {
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.65, 1),
      new THREE.MeshStandardMaterial({ color: type.hex, emissive: type.hex, emissiveIntensity: 0.4 })
    );
    group.add(orb);
  }

  // Светящееся кольцо вокруг бонуса цвета его типа
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.07, 8, 24),
    new THREE.MeshBasicMaterial({ color: type.hex })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  fxGroup.add(group);
  state.powerups.push({
    x: tile.x,
    y: layer.yHeight + 1.2,
    z: tile.z,
    layerIndex: layerIdx,
    type,
    mesh: group,
    life: 15.0,
    phase: Math.random() * Math.PI * 2
  });
}

function applyPowerup(actor, pu) {
  const t = pu.type;
  actor.score += 50;
  if (actor.isPlayer) {
    sfx.play('powerup');
    addFeedItem(`✨ Вы взяли: ${t.icon} ${t.name}!`, t.color);
  }
  spawnParticles3D(pu.x, pu.y, pu.z, t.hex, 12);

  if (t.id === 'speed') actor.buffs.speed = t.duration;
  else if (t.id === 'feather') actor.buffs.feather = t.duration;
  else if (t.id === 'ghost') actor.buffs.ghost = t.duration;
  else if (t.id === 'shield') actor.buffs.shield = t.duration;
  else if (t.id === 'shock') {
    sfx.play('shock');
    spawnShockwave3D(actor.x, actor.y + 0.15, actor.z, 8.5, 0xff5252);
    state.actors.forEach(other => {
      if (other !== actor && other.alive && Math.abs(other.y - actor.y) < 3.5) {
        const dx = other.x - actor.x;
        const dz = other.z - actor.z;
        const d = Math.hypot(dx, dz);
        if (d < 8.5 && d > 0.01) {
          const force = (1 - d / 8.5) * 16.0 + 6.0;
          other.vx += (dx / d) * force;
          other.vz += (dz / d) * force;
          other.vy = 10.5;
          other.onGround = false;
          other.squash = 0.3;
          actor.score += 40;
        }
      }
    });
  } else if (t.id === 'builder') {
    sfx.play('regen');
    spawnShockwave3D(actor.x, actor.y + 0.15, actor.z, 7.5, 0x00e676);
    const layer = state.layers[actor.currentLayer];
    if (layer) {
      const centerAx = worldXZToAxial(actor.x, actor.z);
      layer.list.forEach(tile => {
        if (hexDistance(centerAx.q, centerAx.r, tile.q, tile.r) <= 2) {
          tile.instantRepair();
        }
      });
    }
  }
}

const sharedParticleGeo = new THREE.SphereGeometry(0.16, 6, 6);
function spawnParticles3D(x, y, z, hexColor, count = 8) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: hexColor, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(sharedParticleGeo, mat);
    mesh.position.set(x, y, z);
    fxGroup.add(mesh);

    const ang = Math.random() * Math.PI * 2;
    const spd = 2.0 + Math.random() * 5.5;
    state.particles.push({
      mesh,
      vx: Math.cos(ang) * spd,
      vy: 3.5 + Math.random() * 6.5,
      vz: Math.sin(ang) * spd,
      life: 0.45 + Math.random() * 0.3,
      maxLife: 0.75
    });
  }
}

function spawnShockwave3D(x, y, z, maxRadius, hexColor) {
  const geo = new THREE.RingGeometry(0.8, 1.0, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  fxGroup.add(mesh);

  state.shockwaves.push({
    mesh,
    maxRadius,
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
  while (feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => { if (item.parentNode) item.remove(); }, 4500);
}

// ==================== УПРАВЛЕНИЕ И 3D КАМЕРА ====================
const keys = {};
const joystick = { active: false, dx: 0, dy: 0, pointerId: null };
const camDrag = { active: false, lastX: 0, lastY: 0, pointerId: null };

function cycleCamPreset() {
  state.presetIdx = (state.presetIdx + 1) % CAM_PRESETS.length;
  const p = CAM_PRESETS[state.presetIdx];
  state.camDist = p.dist;
  state.camHeight = p.height;
  document.getElementById('hud-zoom-val').textContent = p.label;
}

window.addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (state.phase === 'menu') {
    const order = ['play', 'custom', 'season', 'shop', 'settings'];
    if (e.code === 'KeyQ') {
      const idx = (order.indexOf(lobbyActiveTab) - 1 + order.length) % order.length;
      switchLobbyTab(order[idx]);
      return;
    } else if (e.code === 'KeyE') {
      const idx = (order.indexOf(lobbyActiveTab) + 1) % order.length;
      switchLobbyTab(order[idx]);
      return;
    }
  }
  if (state.phase === 'playing') {
    if (e.code === 'Space') {
      e.preventDefault();
      state.player?.jump();
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') {
      e.preventDefault();
      state.player?.dive();
    }
  }
  if (e.code === 'KeyZ') cycleCamPreset();
  else if (e.code === 'KeyM') toggleSound();
  else if (e.code === 'Tab') { e.preventDefault(); openLeaderboard(); }
  else if (e.code === 'Escape') openStartModal();
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2) {
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

  if (state.phase === 'menu') {
    lobbyTargetBeanYaw += dx * 0.014;
    return;
  }

  state.targetCamYaw -= dx * 0.0075;
  state.camPitchOffset = Math.max(-3.5, Math.min(6.0, state.camPitchOffset + dy * 0.03));
  state.lastManualOrbitTime = state.elapsed;
});

canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId === camDrag.pointerId) {
    camDrag.active = false;
    camDrag.pointerId = null;
  }
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 1.5 : -1.5;
  state.camDist = Math.max(8.5, Math.min(28.0, state.camDist + delta));
  state.camHeight = state.camDist * 0.58;
}, { passive: false });

document.getElementById('btn-cam-left').addEventListener('click', () => {
  state.targetCamYaw += 0.55;
  state.lastManualOrbitTime = state.elapsed;
});
document.getElementById('btn-cam-right').addEventListener('click', () => {
  state.targetCamYaw -= 0.55;
  state.lastManualOrbitTime = state.elapsed;
});
document.getElementById('btn-cam-zoom').addEventListener('click', cycleCamPreset);

// Виртуальный джойстик
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
  if (joystick.active && e.pointerId === joystick.pointerId) handleJoystickMove(e.clientX, e.clientY);
});
joyBase.addEventListener('pointerup', resetJoystick);
joyBase.addEventListener('pointercancel', resetJoystick);

document.getElementById('btn-touch-jump').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); state.player?.jump();
});
document.getElementById('btn-touch-dive').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); state.player?.dive();
});
document.getElementById('chip-jump').addEventListener('click', () => state.player?.jump());
document.getElementById('chip-dive').addEventListener('click', () => state.player?.dive());
document.getElementById('chip-cam').addEventListener('click', () => {
  state.targetCamYaw += 0.6;
  state.lastManualOrbitTime = state.elapsed;
});

// ==================== ИИ БОТОВ В 3D ====================
function updateBotAI3D(bot, dt, config) {
  bot.aiRetargetTimer -= dt;
  const layer = state.layers[bot.currentLayer] || state.layers[state.layers.length - 1];
  const curAx = worldXZToAxial(bot.x, bot.z);
  const curTile = layer.map.get(`${curAx.q},${curAx.r}`);

  const urgent = !curTile || curTile.status === 'falling' || curTile.status === 'waiting' ||
    (curTile.status === 'stepped' && curTile.timer < config.stepHoldTime * 0.55);

  if (bot.aiRetargetTimer <= 0 || urgent || !bot.aiTargetTile ||
      bot.aiTargetTile.status === 'falling' || bot.aiTargetTile.status === 'waiting') {
    bot.aiRetargetTimer = 0.24 + (1 - config.botIQ) * 0.25;

    let bestTile = null;
    let bestScore = -9999;

    for (let dq = -2; dq <= 2; dq++) {
      for (let dr = Math.max(-2, -dq - 2); dr <= Math.min(2, -dq + 2); dr++) {
        const hDist = hexDistance(0, 0, dq, dr);
        if (hDist === 0) continue;
        const candidate = layer.map.get(`${curAx.q + dq},${curAx.r + dr}`);
        if (!candidate) continue;
        if (candidate.status !== 'solid' && candidate.status !== 'restoring') continue;

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
        score += (Math.random() - 0.5) * (1.2 - config.botIQ) * 38;

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
    const dz = bot.aiTargetTile.z - bot.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.35) {
      bot.facing = Math.atan2(dx, dz);
      const baseSpeed = 6.5 * (bot.buffs.speed > 0 ? 1.35 : 1.0);
      const desiredVx = (dx / dist) * baseSpeed;
      const desiredVz = (dz / dist) * baseSpeed;

      bot.vx += (desiredVx - bot.vx) * Math.min(1, dt * 8);
      bot.vz += (desiredVz - bot.vz) * Math.min(1, dt * 8);

      if (bot.onGround && (dist > HEX_RADIUS * 1.85 || !curTile || curTile.status === 'falling' || curTile.status === 'waiting')) {
        if (Math.random() < 0.38 + config.botIQ * 0.55) {
          bot.jump();
        }
      }
    }
  }
}

// ==================== ОБНОВЛЕНИЕ 3D МИРА, КАМЕРЫ И ФИЗИКИ ====================
function updateWorld3D(dt, nowSec) {
  // Анимация волн слизи и облаков на фоне
  if (slimeSeaMesh) {
    slimeSeaMesh.position.y = -16 + Math.sin(nowSec * 1.8) * 0.25;
  }
  stadiumClouds.forEach(c => {
    const a = c.baseAngle + nowSec * c.speed;
    c.mesh.position.x = Math.cos(a) * c.dist;
    c.mesh.position.z = Math.sin(a) * c.dist;
    c.mesh.rotation.y = -a + Math.PI / 2;
  });

  // Поворот камеры клавишами Q / E
  if (keys['KeyQ']) {
    state.targetCamYaw += dt * 1.9;
    state.lastManualOrbitTime = state.elapsed;
  }
  if (keys['KeyE']) {
    state.targetCamYaw -= dt * 1.9;
    state.lastManualOrbitTime = state.elapsed;
  }

  // Анимации всех живых фасолинок
  for (const actor of state.actors) {
    if (actor.alive) actor.update3DAnimation(dt);
  }

  // 1. ФАЗА СТАРТОВОГО ПРОЛЁТА КАМЕРЫ ПО БАШНЕ (как в Hex-A-GoneIntroLegacy.gif)
  if (state.phase === 'intro_flyover') {
    state.introTimer -= dt;
    const p = 1 - Math.max(0, state.introTimer / 2.4); // от 0 (низ у слизи) до 1 (верхний ярус за спиной игрока)
    const smoothP = p * p * (3 - 2 * p);

    const topY = state.layers[0] ? state.layers[0].yHeight : 20;
    const flyAngle = state.targetCamYaw + (1 - smoothP) * Math.PI * 1.35;
    const flyRadius = 32 * (1 - smoothP) + state.camDist * smoothP;
    const lookY = -6 * (1 - smoothP) + (topY + 1.4) * smoothP;

    const targetX = state.player ? state.player.x * smoothP : 0;
    const targetZ = state.player ? state.player.z * smoothP : 0;

    camera.position.set(
      targetX + Math.sin(flyAngle) * flyRadius,
      lookY + 11 * (1 - smoothP) + state.camHeight * smoothP,
      targetZ + Math.cos(flyAngle) * flyRadius
    );
    camera.lookAt(targetX, lookY, targetZ);

    if (state.introTimer <= 0) {
      state.phase = 'countdown';
      const cdBadge = document.getElementById('countdown-badge');
      const cdText = document.getElementById('countdown-text');
      const cdSub = document.getElementById('countdown-sub');
      cdBadge.textContent = 'ПРИГОТОВЬТЕСЬ К СТАРТУ!';
      cdText.textContent = '3';
      cdSub.textContent = 'WASD / Стрелки — бег • ПРОБЕЛ — прыжок • SHIFT — нырок';
      sfx.play('count');
    }
    update3DNameplates();
    return;
  }

  // 2. ФАЗА ОТСЧЁТА 3.. 2.. 1.. СТАРТ!
  if (state.phase === 'countdown') {
    const prevSec = Math.ceil(state.countdownTimer - 0.4);
    state.countdownTimer -= dt;
    const curSec = Math.ceil(state.countdownTimer - 0.4);

    const cdText = document.getElementById('countdown-text');
    if (curSec !== prevSec) {
      if (curSec >= 1) {
        cdText.textContent = String(curSec);
        sfx.play('count');
      } else if (curSec === 0) {
        cdText.textContent = 'СТАРТ!';
        sfx.play('go');
      }
    }

    updateThirdPersonCamera(dt);
    update3DNameplates();

    if (state.countdownTimer <= 0) {
      state.phase = 'playing';
      document.getElementById('countdown-overlay').classList.add('hidden');
    }
    return;
  }

  // 3. ФАЗА ПЛАШКИ ПОБЕДИТЕЛЯ
  if (state.phase === 'celebrating') {
    state.celebrationTimer -= dt;
    state.targetCamYaw += dt * 0.85;
    updateThirdPersonCamera(dt, state.matchWinner);
    updateFX(dt);
    update3DNameplates();
    if (state.celebrationTimer <= 0) {
      showFinalResultsModal();
    }
    return;
  }

  if (state.phase !== 'playing') {
    update3DNameplates();
    return;
  }

  const simDt = dt * (state.player && !state.player.alive ? state.spectateSpeed : 1);
  state.elapsed += simDt;

  // Пропорциональное восстановление сот из FIFO очереди
  processRegenQueue();

  // Спавн бонусов и событий
  state.powerupSpawnTimer -= simDt;
  if (state.powerupSpawnTimer <= 0) {
    state.powerupSpawnTimer = state.config.powerupInterval;
    if (state.powerups.length < 6) spawnPowerup3D();
  }

  state.eventTimer -= simDt;
  if (state.eventTimer <= 0) {
    state.eventTimer = 20.0;
    triggerArenaEvent();
  }

  // Обновляем все 3D-плитки
  for (const layer of state.layers) {
    for (const tile of layer.list) {
      tile.update(simDt, state.config, layer.map);
    }
  }

  // Управление игроком относительно направления взгляда 3D-камеры
  const p = state.player;
  if (p && p.alive) {
    let inputRight = 0;
    let inputForward = 0;

    if (keys['KeyW'] || keys['ArrowUp']) inputForward += 1;
    if (keys['KeyS'] || keys['ArrowDown']) inputForward -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) inputRight += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) inputRight -= 1;

    if (joystick.active) {
      inputRight += joystick.dx;
      inputForward -= joystick.dy;
    }

    const len = Math.hypot(inputRight, inputForward);
    if (len > 0.05 && !p.isDiving) {
      const nr = inputRight / Math.max(1, len);
      const nf = inputForward / Math.max(1, len);

      // Вектор от камеры к персонажу имеет угол (state.camYaw + Math.PI)
      const camForwardX = -Math.sin(state.camYaw);
      const camForwardZ = -Math.cos(state.camYaw);
      const camRightX = Math.cos(state.camYaw);
      const camRightZ = -Math.sin(state.camYaw);

      const moveDirX = camForwardX * nf + camRightX * nr;
      const moveDirZ = camForwardZ * nf + camRightZ * nr;

      p.facing = Math.atan2(moveDirX, moveDirZ);
      const maxSpeed = 7.2 * (p.buffs.speed > 0 ? 1.35 : 1.0);
      const targetVx = moveDirX * maxSpeed * Math.min(1, len);
      const targetVz = moveDirZ * maxSpeed * Math.min(1, len);

      const accel = p.onGround ? 11 : 6.0;
      p.vx += (targetVx - p.vx) * Math.min(1, simDt * accel);
      p.vz += (targetVz - p.vz) * Math.min(1, simDt * accel);

      // Мягкий подруливающий авто-поворот камеры за спину при беге вбок (если игрок не крутит мышь вручную последние 1.8 сек)
      if (state.elapsed - state.lastManualOrbitTime > 1.8 && Math.abs(nr) > 0.35) {
        state.targetCamYaw -= nr * simDt * 0.75;
      }
    } else if (!p.isDiving) {
      const friction = p.onGround ? 10 : 2.5;
      p.vx *= Math.max(0, 1 - simDt * friction);
      p.vz *= Math.max(0, 1 - simDt * friction);
    }
  }

  // Физика и непрерывная проверка коллизий с 3D-сотами (никто не проваливается сквозь текстуры!)
  const slimeSurfaceY = -14.0;

  for (const actor of state.actors) {
    if (!actor.alive) continue;

    actor.survivalTime = state.elapsed;
    actor.score += simDt * 12 * state.config.scoreMult;

    for (const k of Object.keys(actor.buffs)) {
      if (actor.buffs[k] > 0) actor.buffs[k] = Math.max(0, actor.buffs[k] - simDt);
    }
    if (actor.diveCooldown > 0) actor.diveCooldown = Math.max(0, actor.diveCooldown - simDt);
    if (actor.isDiving) {
      actor.diveTimer -= simDt;
      if (actor.diveTimer <= 0) actor.isDiving = false;
    }

    if (!actor.isPlayer) {
      updateBotAI3D(actor, simDt, state.config);
    }

    const prevY = actor.y;
    const wasOnGround = actor.onGround;

    actor.x += actor.vx * simDt;
    actor.z += actor.vz * simDt;

    const gravity = actor.buffs.feather > 0 && actor.vy < 0 ? 19.0 : 30.0;
    actor.vy -= gravity * simDt;
    actor.y += actor.vy * simDt;

    actor.onGround = false;

    // Непрерывный Sweep-тест по всем ярусам сверху вниз
    let shadowPlaced = false;
    for (const layer of state.layers) {
      const supportTile = findSupportingTileOnLayer(layer, actor.x, actor.z, actor.radius);
      const surfaceY = supportTile ? (layer.yHeight + supportTile.offsetY) : layer.yHeight;

      // Проверяем пересечение верхней плоскости соты (с запасом сверху и снизу, чтобы никогда не проскочить сквозь полигон)
      if (supportTile && actor.vy <= 0 && prevY >= surfaceY - 0.65 && actor.y <= surfaceY + 0.25) {
        if (!wasOnGround && actor.vy < -4.5) {
          actor.squash = Math.min(0.32, Math.abs(actor.vy) / 42);
        }
        actor.y = surfaceY;
        actor.vy = 0;
        actor.onGround = true;
        actor.jumpCount = 0;
        actor.currentLayer = layer.index;
        supportTile.triggerStep(actor, state.config);

        actor.rig.blobShadow.visible = true;
        actor.rig.blobShadow.position.y = 0.03;
        shadowPlaced = true;
        break;
      }

      // Проекция круглой тени на ближайшую соту внизу во время прыжка
      if (!shadowPlaced && supportTile && actor.y > surfaceY) {
        actor.rig.blobShadow.visible = true;
        actor.rig.blobShadow.position.y = (surfaceY - actor.y) + 0.03;
        shadowPlaced = true;
      }
    }

    if (!shadowPlaced) {
      actor.rig.blobShadow.visible = false;
    }

    // Подбор 3D-бонусов
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const pu = state.powerups[i];
      if (Math.abs(actor.y + 1.0 - pu.y) < 2.2 && Math.hypot(actor.x - pu.x, actor.z - pu.z) < 1.85) {
        applyPowerup(actor, pu);
        fxGroup.remove(pu.mesh);
        state.powerups.splice(i, 1);
      }
    }

    // Падение в розовую слизь
    if (actor.y < slimeSurfaceY) {
      if (actor.buffs.shield > 0) {
        actor.buffs.shield = 0;
        const bottomLayer = state.layers[state.layers.length - 1];
        actor.y = bottomLayer.yHeight + 4.5;
        actor.vy = 20.0;
        actor.x *= 0.3;
        actor.z *= 0.3;
        const cAx = worldXZToAxial(actor.x, actor.z);
        const cTile = bottomLayer.map.get(`${cAx.q},${cAx.r}`) || bottomLayer.map.get('0,0');
        if (cTile) cTile.instantRepair();

        sfx.play('spring');
        spawnShockwave3D(actor.x, bottomLayer.yHeight + 0.1, actor.z, 6.5, 0xffd740);
        if (actor.isPlayer) addFeedItem('🛡️ Батут-спасение катапультировал вас из слизи!', '#ffd740');
      } else {
        actor.alive = false;
        actor.rig.root.visible = false;
        actor.labelEl.style.display = 'none';
        state.eliminationOrder.push(actor);
        sfx.play('elim');
        spawnParticles3D(actor.x, slimeSurfaceY + 0.5, actor.z, 0xff2a85, 22);
        addFeedItem(`💦 ${actor.name} плюхнулся в слизь!`, actor.isPlayer ? '#00e5ff' : '#ff2a85');

        if (actor.isPlayer) onPlayerEliminated();
      }
    }
  }

  // Столкновения плечами между 3D-фасолинками
  const aliveList = state.actors.filter(a => a.alive);
  for (let i = 0; i < aliveList.length; i++) {
    for (let j = i + 1; j < aliveList.length; j++) {
      const a = aliveList[i];
      const b = aliveList[j];
      if (Math.abs(a.y - b.y) < 1.8) {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minDist = a.radius + b.radius;
        if (dist < minDist && dist > 0.01) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;

          const push = 4.2;
          a.vx -= nx * push * simDt * 8;
          a.vz -= nz * push * simDt * 8;
          b.vx += nx * push * simDt * 8;
          b.vz += nz * push * simDt * 8;
        }
      }
    }
  }

  updateFX(simDt);
  updateThirdPersonCamera(dt);
  update3DNameplates();

  if (aliveList.length <= 1) {
    triggerWinnerCelebration(aliveList[0] || state.eliminationOrder[state.eliminationOrder.length - 1]);
  }

  updateHUD();
}

function updateFX(dt) {
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const pu = state.powerups[i];
    pu.life -= dt;
    pu.phase += dt * 3.5;
    pu.mesh.position.y = pu.y + Math.sin(pu.phase) * 0.3;
    pu.mesh.rotation.y += dt * 2.2;
    if (pu.life <= 0) {
      fxGroup.remove(pu.mesh);
      state.powerups.splice(i, 1);
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt;
    pt.mesh.position.x += pt.vx * dt;
    pt.mesh.position.y += pt.vy * dt;
    pt.mesh.position.z += pt.vz * dt;
    pt.vy -= 18.0 * dt;
    pt.mesh.material.opacity = Math.max(0, pt.life / pt.maxLife);
    if (pt.life <= 0) {
      fxGroup.remove(pt.mesh);
      state.particles.splice(i, 1);
    }
  }

  for (let i = state.shockwaves.length - 1; i >= 0; i--) {
    const sw = state.shockwaves[i];
    sw.life -= dt;
    const p = 1 - Math.max(0, sw.life / sw.maxLife);
    const r = 0.5 + p * sw.maxRadius;
    sw.mesh.scale.set(r, r, r);
    sw.mesh.material.opacity = Math.max(0, sw.life / sw.maxLife);
    if (sw.life <= 0) {
      fxGroup.remove(sw.mesh);
      state.shockwaves.splice(i, 1);
    }
  }
}

function updateThirdPersonCamera(dt, forcedTarget = null) {
  state.camYaw += (state.targetCamYaw - state.camYaw) * Math.min(1, dt * 10);

  const aliveList = state.actors.filter(a => a.alive);
  let focusActor = forcedTarget || state.player;
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
    const targetPos = new THREE.Vector3(focusActor.x, focusActor.y + 1.35, focusActor.z);
    state.camFocusPos.lerp(targetPos, Math.min(1, dt * 9));
  }

  const dist = state.phase === 'celebrating' ? 9.5 : state.camDist;
  const height = state.phase === 'celebrating' ? 4.2 : state.camHeight + state.camPitchOffset;

  const camX = state.camFocusPos.x + Math.sin(state.camYaw) * dist;
  const camY = state.camFocusPos.y + Math.max(2.5, height);
  const camZ = state.camFocusPos.z + Math.cos(state.camYaw) * dist;

  camera.position.set(camX, camY, camZ);
  camera.lookAt(state.camFocusPos.x, state.camFocusPos.y + 0.3, state.camFocusPos.z);
}

// Проекция 3D координат макушки каждой фасолинки в 2D экранные координаты для чётких смешных ников
const tempProjVec = new THREE.Vector3();
function update3DNameplates() {
  const halfW = window.innerWidth * 0.5;
  const halfH = window.innerHeight * 0.5;

  for (const actor of state.actors) {
    if (!actor.alive) {
      actor.labelEl.style.display = 'none';
      continue;
    }
    tempProjVec.set(actor.x, actor.y + 2.55, actor.z);
    tempProjVec.project(camera);

    // Если за спиной камеры — скрываем
    if (tempProjVec.z > 1) {
      actor.labelEl.style.display = 'none';
      continue;
    }

    const sx = (tempProjVec.x * halfW) + halfW;
    const sy = -(tempProjVec.y * halfH) + halfH;
    actor.labelEl.style.display = 'block';
    actor.labelEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }
}

function triggerArenaEvent() {
  const roll = Math.random();
  const banner = document.getElementById('event-banner');
  banner.classList.remove('hidden');

  if (roll < 0.45) {
    banner.textContent = '🎁 СОБЫТИЕ: ДОЖДЬ БОНУСОВ НА ЯРУСАХ!';
    for (let i = 0; i < 3; i++) spawnPowerup3D();
  } else if (roll < 0.78) {
    banner.textContent = '🛠️ СОБЫТИЕ: ВОЛНА РЕГЕНЕРАЦИИ СОТ!';
    for (let i = 0; i < Math.min(10, state.regenQueue.length); i++) {
      state.regenQueue[i].restoreAt = state.elapsed;
    }
    sfx.play('regen');
  } else {
    banner.textContent = '🪽 СОБЫТИЕ: НИЗКАЯ ГРАВИТАЦИЯ ВСЕМ (5 СЕК)!';
    state.actors.forEach(a => {
      if (a.alive) a.buffs.feather = Math.max(a.buffs.feather, 5.0);
    });
    sfx.play('powerup');
  }

  setTimeout(() => banner.classList.add('hidden'), 4200);
}

function onPlayerEliminated() {
  const aliveCount = state.actors.filter(a => a.alive).length;
  if (aliveCount > 1) {
    document.getElementById('spectator-bar').classList.remove('hidden');
  }
}

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
  ribbon.textContent = isPlayerWin ? '🎉 ВЫ ПОБЕДИЛИ В 3D-ШОУ! 🎉' : '🏁 ФИНАЛ РАУНДА ОКОНЧЕН!';
  nameEl.textContent = winner ? winner.name : 'Ничья';
  subEl.textContent = isPlayerWin
    ? 'Вы перепрыгали всех соперников и забрали Золотую Корону!'
    : 'становится последним выжившим и забирает Корону!';

  overlay.classList.remove('hidden');
  sfx.play('win');

  if (winner) {
    const cols = [0xffe600, 0x00e5ff, 0xff2a85, 0x00e676, 0xffffff];
    for (let i = 0; i < 35; i++) {
      spawnParticles3D(winner.x, winner.y + 1.5, winner.z, cols[i % cols.length], 2);
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
  saveData.kudos = (saveData.kudos || 0) + Math.max(80, Math.round(finalScore * 0.35));
  saveData.seasonXP = (saveData.seasonXP || 0) + Math.max(60, Math.round(finalScore * 0.25));
  saveData.matchesPlayed += 1;
  if (p.survivalTime > saveData.bestSurvivalSec) saveData.bestSurvivalSec = p.survivalTime;

  const rec = saveData.recordsByDiff[state.diffKey];
  if (p.survivalTime > rec.bestTime) rec.bestTime = p.survivalTime;
  if (finalScore > rec.bestScore) rec.bestScore = finalScore;

  saveGameData();
  updateHUD();
  renderAllLobbyPanels();

  document.getElementById('result-ribbon').textContent = isVictory ? 'ЧЕМПИОН ШОУ!' : 'ИТОГИ ФИНАЛА';
  document.getElementById('result-title').textContent = isVictory
    ? 'ПОБЕДА! КОРОНА ВАША! 👑'
    : `ВЫ ЗАНЯЛИ #${playerPlace} МЕСТО!`;
  document.getElementById('result-subtitle').textContent = isVictory
    ? 'Блестящая победа на трёхмерной башне Hex-A-Gone!'
    : `Победитель шоу: ${winner ? winner.name : 'Бот'} 👑`;

  document.getElementById('spot-winner-name').textContent = winner ? `${winner.name} ${winner.isPlayer ? '(Вы)' : ''}` : 'Чемпион';
  document.getElementById('spot-winner-meta').textContent = winner
    ? `Выжил ${formatTime(winner.survivalTime)} и набрал ⭐ ${Math.round(winner.score)} очков!`
    : '';

  document.getElementById('res-place').textContent = `#${playerPlace}`;
  document.getElementById('res-time').textContent = formatTime(p.survivalTime);
  document.getElementById('res-tiles').textContent = String(p.tilesBroken);
  document.getElementById('res-score').textContent = `+${Math.max(80, Math.round(finalScore * 0.35))} 🟣`;

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

// ==================== ОБНОВЛЕНИЕ HUD, ЛОББИ, ГАРДЕРОБА И МАГАЗИНА ====================
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

  // Валюты в шапке Лобби
  document.getElementById('lobby-crowns').textContent = String(saveData.crowns || 0);
  document.getElementById('lobby-kudos').textContent = String(saveData.kudos || 0);
  document.getElementById('lobby-rank-title').textContent = getRankTitle(saveData.crowns);
  document.getElementById('home-mode-name').textContent = state.config.name;

  // Уровень и шкала славы сезона
  const xp = saveData.seasonXP || 0;
  let curLvl = 1;
  let nextXp = 500;
  for (const t of SEASON_TIERS) {
    if (xp >= t.xpReq) {
      curLvl = t.level;
    } else {
      nextXp = t.xpReq;
      break;
    }
  }
  if (curLvl >= 7) nextXp = 3500;
  document.getElementById('lobby-lvl-badge').textContent = String(curLvl);
  document.getElementById('lobby-xp-text').textContent = `${xp} / ${nextXp}`;
  document.getElementById('lobby-xp-fill').style.width = `${Math.min(100, (xp / nextXp) * 100)}%`;

  const cdDiveEl = document.getElementById('cd-dive');
  if (p && p.diveCooldown > 0) {
    cdDiveEl.style.height = `${(p.diveCooldown / 2.1) * 100}%`;
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
  if (crowns >= 4) return '🔥 Мастер 3D-Арены';
  if (crowns >= 1) return '⭐ Обладатель Короны';
  return '🐣 Новичок Шоу';
}

// Симуляция просмотра Rewarded-рекламы Яндекс Игр (3 секунды) для получения базовых скинов или +500 Лавров
function watchRewardedAd(rewardTitle, onComplete) {
  const modal = document.getElementById('ad-modal');
  const titleEl = document.getElementById('ad-modal-title');
  const timerEl = document.getElementById('ad-timer-circle');
  modal.classList.remove('hidden');
  titleEl.textContent = rewardTitle;
  let rem = 3;
  timerEl.textContent = String(rem);
  sfx.play('count');

  const iv = setInterval(() => {
    rem--;
    if (rem > 0) {
      timerEl.textContent = String(rem);
      sfx.play('count');
    } else {
      clearInterval(iv);
      modal.classList.add('hidden');
      sfx.play('win');
      onComplete();
    }
  }, 850);
}

// Проверка доступности цвета или костюма
function isColorUnlocked(col) {
  if (col.unlockType === 'free') return true;
  if (col.unlockType === 'crowns' && saveData.crowns >= col.cost) return true;
  return saveData.unlockedColors.includes(col.id);
}

function isCostumeUnlocked(cos) {
  if (cos.unlockType === 'free') return true;
  if (cos.unlockType === 'crowns' && saveData.crowns >= cos.cost) return true;
  return saveData.unlockedCostumes.includes(cos.id);
}

function getUnlockBadgeText(item, unlocked) {
  if (unlocked) return '✓ Открыто';
  if (item.unlockType === 'ad') return '📺 За рекламу';
  if (item.unlockType === 'crowns') return `👑 Нужна ${item.cost} победа`;
  if (item.unlockType === 'kudos') return `🟣 ${item.cost} Лавров`;
  return 'Закрыто';
}

function handleSelectOrUnlockColor(col) {
  if (isColorUnlocked(col)) {
    saveData.selectedColorId = col.id;
    saveGameData();
    sfx.play('step');
    rebuildLobbyBeanModel();
    renderAllLobbyPanels();
    return;
  }

  if (col.unlockType === 'ad') {
    watchRewardedAd(`ОТКРЫВАЕМ ЦВЕТ: ${col.title}`, () => {
      if (!saveData.unlockedColors.includes(col.id)) saveData.unlockedColors.push(col.id);
      saveData.selectedColorId = col.id;
      saveGameData();
      rebuildLobbyBeanModel();
      renderAllLobbyPanels();
    });
  } else if (col.unlockType === 'kudos') {
    if ((saveData.kudos || 0) >= col.cost) {
      saveData.kudos -= col.cost;
      saveData.unlockedColors.push(col.id);
      saveData.selectedColorId = col.id;
      saveGameData();
      sfx.play('powerup');
      rebuildLobbyBeanModel();
      renderAllLobbyPanels();
    } else {
      sfx.play('elim');
    }
  } else {
    sfx.play('elim');
  }
}

function handleSelectOrUnlockCostume(cos) {
  if (isCostumeUnlocked(cos)) {
    saveData.selectedCostumeId = cos.id;
    saveGameData();
    sfx.play('step');
    rebuildLobbyBeanModel();
    renderAllLobbyPanels();
    return;
  }

  if (cos.unlockType === 'ad') {
    watchRewardedAd(`ОТКРЫВАЕМ КОСТЮМ: ${cos.title}`, () => {
      if (!saveData.unlockedCostumes.includes(cos.id)) saveData.unlockedCostumes.push(cos.id);
      saveData.selectedCostumeId = cos.id;
      saveGameData();
      rebuildLobbyBeanModel();
      renderAllLobbyPanels();
    });
  } else if (cos.unlockType === 'kudos') {
    if ((saveData.kudos || 0) >= cos.cost) {
      saveData.kudos -= cos.cost;
      saveData.unlockedCostumes.push(cos.id);
      saveData.selectedCostumeId = cos.id;
      saveGameData();
      sfx.play('powerup');
      rebuildLobbyBeanModel();
      renderAllLobbyPanels();
    } else {
      sfx.play('elim');
    }
  } else {
    sfx.play('elim');
  }
}

function renderAllLobbyPanels() {
  updateHUD();

  // 1. Сетка цветов в Гардеробе (Диагональные двухцветные квадраты как на скриншоте 4)
  const colGrid = document.getElementById('custom-colors-grid');
  if (colGrid) {
    colGrid.innerHTML = '';
    COLOR_PALETTES.forEach(col => {
      const unlocked = isColorUnlocked(col);
      const isSelected = saveData.selectedColorId === col.id;
      const btn = document.createElement('div');
      btn.className = 'fg-color-tile' + (isSelected ? ' active' : '');
      btn.style.setProperty('--c1', col.css1);
      btn.style.setProperty('--c2', col.css2);
      btn.innerHTML = `
        ${isSelected ? '<div class="tile-check-badge">✓</div>' : ''}
        ${!unlocked ? `<div class="tile-lock-tag">${getUnlockBadgeText(col, false)}</div>` : ''}
      `;
      btn.addEventListener('click', () => {
        document.getElementById('custom-selected-title').textContent = col.title;
        document.getElementById('custom-selected-rarity').textContent = col.rarity;
        handleSelectOrUnlockColor(col);
      });
      colGrid.appendChild(btn);
    });
  }

  // 2. Сетка костюмов/шляп в Гардеробе (за победы и за рекламу)
  const cosGrid = document.getElementById('custom-costumes-grid');
  if (cosGrid) {
    cosGrid.innerHTML = '';
    COSTUME_ITEMS.forEach(cos => {
      const unlocked = isCostumeUnlocked(cos);
      const isSelected = saveData.selectedCostumeId === cos.id;
      const card = document.createElement('div');
      card.className = 'fg-costume-card' + (isSelected ? ' active' : '');
      card.innerHTML = `
        ${isSelected ? '<div class="tile-check-badge">✓</div>' : ''}
        <div class="costume-icon-big">${cos.icon}</div>
        <div class="costume-card-name">${cos.title}</div>
        <div class="tile-lock-tag" style="${unlocked ? 'background:#00c853; color:#fff' : ''}">
          ${getUnlockBadgeText(cos, unlocked)}
        </div>
      `;
      card.addEventListener('click', () => {
        document.getElementById('custom-selected-title').textContent = cos.title;
        document.getElementById('custom-selected-rarity').textContent = cos.rarity;
        handleSelectOrUnlockCostume(cos);
      });
      cosGrid.appendChild(card);
    });
  }

  // 3. Шкала Сезона (Скриншот 2)
  const trackRow = document.getElementById('season-track-row');
  if (trackRow) {
    trackRow.innerHTML = '';
    const xp = saveData.seasonXP || 0;
    SEASON_TIERS.forEach(tier => {
      const reached = xp >= tier.xpReq;
      const box = document.createElement('div');
      box.className = 'season-tier-box' + (reached ? ' unlocked' : '');
      box.innerHTML = `
        <div class="tier-num-hex">${tier.level}</div>
        <div class="tier-reward-icon">${tier.icon}</div>
        <div class="tier-reward-name">${tier.rewardText}</div>
        <div style="font-size:10px; margin-top:3px; color:#ffe600">${reached ? '✓ ПОЛУЧЕНО' : `${tier.xpReq} XP`}</div>
      `;
      box.addEventListener('click', () => {
        document.getElementById('season-featured-title').textContent = tier.title.toUpperCase();
      });
      trackRow.appendChild(box);
    });
  }

  // 4. Витрина Магазина (Скриншот 3: эксклюзив за победы + базовые за рекламу)
  const featRow = document.getElementById('shop-featured-row');
  if (featRow) {
    featRow.innerHTML = '';
    const featuredCostumes = COSTUME_ITEMS.filter(c => c.unlockType === 'crowns');
    featuredCostumes.forEach(cos => {
      const unlocked = isCostumeUnlocked(cos);
      const card = document.createElement('div');
      card.className = 'fg-shop-card';
      card.innerHTML = `
        <div class="shop-card-top">${cos.rarity} • КОСТЮМ</div>
        <div class="shop-card-body">
          <div class="shop-preview-swatch" style="background:linear-gradient(135deg,#ff2a85,#7c4dff)">${cos.icon}</div>
          <strong style="font-size:14px">${cos.title}</strong>
        </div>
        <div class="shop-price-bar">${unlocked ? '✅ В ГАРДЕРОБЕ (НАДЕТЬ)' : `👑 За ${cos.cost} побед(ы)`}</div>
      `;
      card.addEventListener('click', () => handleSelectOrUnlockCostume(cos));
      featRow.appendChild(card);
    });
  }

  const regRow = document.getElementById('shop-regular-row');
  if (regRow) {
    regRow.innerHTML = '';
    const adAndKudosItems = [
      ...COSTUME_ITEMS.filter(c => c.unlockType === 'ad' || c.unlockType === 'kudos').slice(0, 2),
      ...COLOR_PALETTES.filter(c => c.unlockType === 'ad' || c.unlockType === 'kudos').slice(0, 2)
    ];
    adAndKudosItems.forEach(item => {
      const isColor = Boolean(item.css1);
      const unlocked = isColor ? isColorUnlocked(item) : isCostumeUnlocked(item);
      const card = document.createElement('div');
      card.className = 'fg-shop-card';
      const swatchStyle = isColor
        ? `background:linear-gradient(135deg, ${item.css1} 50%, ${item.css2} 50%)`
        : `background:linear-gradient(135deg, #00acc1, #00e676)`;
      card.innerHTML = `
        <div class="shop-card-top ${item.unlockType === 'ad' ? 'rare' : 'common'}">${item.rarity}</div>
        <div class="shop-card-body">
          <div class="shop-preview-swatch" style="${swatchStyle}">${item.icon || '🎨'}</div>
          <strong style="font-size:13px">${item.title}</strong>
        </div>
        <div class="shop-price-bar">${getUnlockBadgeText(item, unlocked)}</div>
      `;
      card.addEventListener('click', () => {
        if (isColor) handleSelectOrUnlockColor(item);
        else handleSelectOrUnlockCostume(item);
      });
      regRow.appendChild(card);
    });
  }
}

function switchLobbyTab(tabId) {
  lobbyActiveTab = tabId;
  document.querySelectorAll('.fg-nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  const panes = ['play', 'custom', 'season', 'shop', 'settings'];
  panes.forEach(p => {
    const el = document.getElementById(`pane-${p}`);
    if (el) el.classList.toggle('hidden', p !== tabId);
  });

  const titles = {
    play: 'ГЛАВНАЯ (ЛОББИ)',
    custom: 'ГАРДЕРОБ ФАСОЛЬКИ',
    season: 'СЕЗОН 1 • НАГРАДЫ',
    shop: 'МАГАЗИН ШОУ',
    settings: 'НАСТРОЙКИ АРЕНЫ'
  };
  document.getElementById('lobby-screen-title').textContent = titles[tabId] || 'ЛОББИ';

  // Меняем цветовую тему анимированного фона с концентрическими кругами (как в Fall Guys)
  const bg = document.getElementById('lobby-bg');
  bg.className = 'lobby-bg ' + (
    tabId === 'play' ? 'theme-yellow' :
    tabId === 'custom' ? 'theme-cyan' :
    tabId === 'season' ? 'theme-blue' :
    tabId === 'shop' ? 'theme-blue' : 'theme-purple'
  );

  sfx.play('step');
  renderAllLobbyPanels();
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
      <td>🟣 ${entry.score}</td>
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
  clearActorsAndFX();

  // Включаем 3D-пьедестал Лобби и прозрачный фон для концентрических кругов
  scene.background = null;
  scene.fog = null;
  stadiumGroup.visible = false;
  arenaGroup.visible = false;
  actorsGroup.visible = false;
  fxGroup.visible = false;
  lobbyGroup.visible = true;
  rebuildLobbyBeanModel();

  document.getElementById('countdown-overlay').classList.add('hidden');
  document.getElementById('winner-banner-overlay').classList.add('hidden');
  document.getElementById('spectator-bar').classList.add('hidden');
  document.getElementById('ingame-hud-top').classList.add('hidden');
  document.getElementById('ingame-hud-bottom').classList.add('hidden');
  document.getElementById('result-modal').classList.add('hidden');
  document.getElementById('lb-modal').classList.add('hidden');

  document.getElementById('lobby-bg').classList.remove('hidden');
  document.getElementById('lobby-ui').classList.remove('hidden');
  switchLobbyTab('play');
}

function toggleSound() {
  sfx.muted = !sfx.muted;
  const icon = sfx.muted ? '🔇' : '🔊';
  document.getElementById('btn-sound').textContent = icon;
  document.getElementById('btn-lobby-sound').textContent = icon;
}

// ==================== ПРИВЯЗКА UI СОБЫТИЙ ====================
document.querySelectorAll('.fg-nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchLobbyTab(btn.dataset.tab));
});

document.getElementById('season-widget-click').addEventListener('click', () => switchLobbyTab('season'));

document.querySelectorAll('.c-subtab').forEach(sub => {
  sub.addEventListener('click', () => {
    document.querySelectorAll('.c-subtab').forEach(s => s.classList.remove('active'));
    sub.classList.add('active');
    const isColors = sub.dataset.subtab === 'colors';
    document.getElementById('custom-colors-grid').classList.toggle('hidden', !isColors);
    document.getElementById('custom-costumes-grid').classList.toggle('hidden', isColors);
  });
});

function setDifficultyKey(diffKey) {
  state.diffKey = diffKey;
  state.config = DIFFICULTIES[diffKey];
  saveData.difficulty = diffKey;
  saveGameData();

  document.querySelectorAll('.diff-card').forEach(c => {
    c.classList.toggle('active', c.dataset.diff === diffKey);
  });
  document.querySelectorAll('.qm-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.diff === diffKey);
  });
  updateHUD();
}

document.querySelectorAll('.diff-card').forEach(card => {
  card.addEventListener('click', () => setDifficultyKey(card.dataset.diff));
});
document.querySelectorAll('.qm-pill').forEach(pill => {
  pill.addEventListener('click', () => setDifficultyKey(pill.dataset.diff));
});

document.getElementById('btn-watch-ad-kudos').addEventListener('click', () => {
  watchRewardedAd('БОНУС ШОУ: +500 ЛАВРОВ 🟣', () => {
    saveData.kudos = (saveData.kudos || 0) + 500;
    saveGameData();
    renderAllLobbyPanels();
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

document.getElementById('btn-play-again').addEventListener('click', startMatch);
document.getElementById('btn-result-settings').addEventListener('click', openStartModal);
document.getElementById('btn-menu').addEventListener('click', openStartModal);
document.getElementById('btn-sound').addEventListener('click', toggleSound);
document.getElementById('btn-lobby-sound').addEventListener('click', toggleSound);

document.getElementById('btn-leaderboard').addEventListener('click', openLeaderboard);
document.getElementById('btn-lobby-lb').addEventListener('click', openLeaderboard);
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== СТАРТ И ГЛАВНЫЙ 3D ЦИКЛ ====================
buildStadiumEnvironment();
loadCC0Assets();
buildLobbyPedestalScene();
openStartModal();

let lastTime = performance.now();
function animate(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const nowSec = now * 0.001;

  if (state.phase === 'menu') {
    updateLobby3D(dt, nowSec);
  } else {
    updateWorld3D(dt, nowSec);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
