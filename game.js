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
import { createCourseState } from './big-fans/course.mjs';
import { createCourseVisuals } from './big-fans/visuals.mjs';
import { initializeRacer, updateRace } from './big-fans/race.mjs';
import { createRollout, advanceRollout, sampleSurface, carryRacer, hitWall, botDecision, RING_WIDTH } from './roll-out/rollout.mjs';
import { createRolloutVisuals } from './roll-out/visuals.mjs';
import { createCourse as createSlimeCourse, advanceCourse as advanceSlimeCourse, surface as slimeSurface, courseY as slimeCourseY, slimeY as risingSlimeY, obstaclesAt as slimeObstacles, obstacleContact as slimeObstacleContact, botDecision as slimeBotDecision, LENGTH as SLIME_LENGTH, LIMIT as SLIME_LIMIT } from './slime-climb/course.mjs';
import { createVisuals as createSlimeVisuals } from './slime-climb/visuals.mjs';
import { createShowdown, advanceShowdown, sampleSurface as showdownSurface, checkSweeperHit as showdownSweeperHit, botDecision as showdownBotDecision, LIMIT as SHOWDOWN_LIMIT } from './jump-showdown/showdown.mjs';
import { createShowdownVisuals } from './jump-showdown/visuals.mjs';
import { TRACKS as MUSIC_TRACKS, chooseTrack } from './music/tracks.mjs';

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

// ==================== КАТАЛОГ ЦВЕТОВЫХ ПАЛИТР, ПАТТЕРНОВ И ПОЛНЫХ КОСТЮМОВ (FALL GUYS) ====================
const COLOR_PALETTES = [
  { id: 'c_pink_yellow', title: 'Розовый Фламинго',   c1: 0xff2a85, c2: 0xffe600, css1: '#ff2a85', css2: '#ffe600', defaultPat: 'pat_belly',     rarity: 'ОБЫЧНЫЙ',    unlockType: 'free',   cost: 0 },
  { id: 'c_cyan_blue',   title: 'Неоновая Лазурь',    c1: 0x00e5ff, c2: 0x1e40af, css1: '#00e5ff', css2: '#1e40af', defaultPat: 'pat_stripes',   rarity: 'ОБЫЧНЫЙ',    unlockType: 'free',   cost: 0 },
  { id: 'c_lime_choco',  title: 'Мятный Пончик',      c1: 0x00e676, c2: 0x3e2723, css1: '#00e676', css2: '#3e2723', defaultPat: 'pat_polka',     rarity: 'ОБЫЧНЫЙ',    unlockType: 'free',   cost: 0 },
  { id: 'c_orange_cyan', title: 'Светофор Тусовки',   c1: 0xff9100, c2: 0x00e5ff, css1: '#ff9100', css2: '#00e5ff', defaultPat: 'pat_flames',    rarity: 'РЕДКИЙ',     unlockType: 'ad',     cost: 0 },
  { id: 'c_purple_lime', title: 'Кибер-Виноград',     c1: 0xd500f9, c2: 0x76ff03, css1: '#d500f9', css2: '#76ff03', defaultPat: 'pat_lightning', rarity: 'РЕДКИЙ',     unlockType: 'ad',     cost: 0 },
  { id: 'c_red_white',   title: 'Клубничный Крем',    c1: 0xff1744, c2: 0xffffff, css1: '#ff1744', css2: '#ffffff', defaultPat: 'pat_stars',     rarity: 'РЕДКИЙ',     unlockType: 'kudos',  cost: 400 },
  { id: 'c_aqua_pink',   title: 'Сахарная Вата',      c1: 0x26c6da, c2: 0xff80ab, css1: '#26c6da', css2: '#ff80ab', defaultPat: 'pat_rings',     rarity: 'ЭПИЧЕСКИЙ',  unlockType: 'kudos',  cost: 800 },
  { id: 'c_gold_ruby',   title: 'Королевское Золото', c1: 0xffd700, c2: 0xb71c1c, css1: '#ffd700', css2: '#b71c1c', defaultPat: 'pat_diamonds',  rarity: 'ЛЕГЕНДА',    unlockType: 'crowns', cost: 1 }
];

// Additional selectable two-colour palettes.
[
 ['c_peach_sky','Персиковое небо',0xffaa90,0x77cef5],
 ['c_lavender_cream','Лаванда и сливки',0xb49aff,0xffe7ad],
 ['c_mint_coral','Мята и коралл',0x71e5ba,0xff786f],
 ['c_berry_milk','Черника с молоком',0x6e64d8,0xffeee4],
 ['c_sunset','Закат',0xff7a64,0xffca58],
 ['c_ocean','Океан',0x258fc2,0x85f1e5],
 ['c_cherry','Вишнёвый лёд',0xd93669,0xffb7c3],
 ['c_pistachio','Фисташка',0xa4d96c,0xffedb2],
 ['c_plum','Слива',0x8b4cab,0xf5a3ce],
 ['c_tangerine','Мандарин',0xffa540,0x4aaabd],
 ['c_cotton','Облачко',0xd6e9ff,0xff9ec4],
 ['c_slate','Ночной космос',0x494e8e,0x91d9ef],
 ['c_limeberry','Лайм и ягода',0xb8e85c,0xa44680],
 ['c_sand','Песок и море',0xe9c47a,0x36b1a7]
].forEach(([id,title,c1,c2]) => COLOR_PALETTES.push({id,title,c1,c2,
 css1:'#'+c1.toString(16).padStart(6,'0'),css2:'#'+c2.toString(16).padStart(6,'0'),
 defaultPat:'pat_belly',rarity:'ОБЫЧНЫЙ',unlockType:'free',cost:0}));

const PATTERN_ITEMS = [
  { id: 'pat_belly',     title: 'Пузико Пингвина',    icon: '🐧', pattern: 'belly',     rarity: 'ОБЫЧНЫЙ',   unlockType: 'free',   cost: 0 },
  { id: 'pat_stripes',   title: 'Тигровые Полосы',    icon: '🐯', pattern: 'stripes',   rarity: 'ОБЫЧНЫЙ',   unlockType: 'free',   cost: 0 },
  { id: 'pat_polka',     title: 'Конфетти Горошек',   icon: '⚪', pattern: 'polka',     rarity: 'ОБЫЧНЫЙ',   unlockType: 'free',   cost: 0 },
  { id: 'pat_flames',    title: 'Пламя Турбо-Гонки',  icon: '🔥', pattern: 'flames',    rarity: 'РЕДКИЙ',    unlockType: 'ad',     cost: 0 },
  { id: 'pat_stars',     title: 'Звёздный Шоумен',    icon: '⭐', pattern: 'stars',     rarity: 'РЕДКИЙ',    unlockType: 'ad',     cost: 0 },
  { id: 'pat_lightning', title: 'Неоновые Молнии',    icon: '⚡', pattern: 'lightning', rarity: 'РЕДКИЙ',    unlockType: 'kudos',  cost: 450 },
  { id: 'pat_rings',     title: 'Волны Гипноза',      icon: '🌀', pattern: 'rings',     rarity: 'ЭПИЧЕСКИЙ', unlockType: 'kudos',  cost: 750 },
  { id: 'pat_diamonds',  title: 'Королевский Арлекин',icon: '♦️', pattern: 'diamonds',  rarity: 'ЛЕГЕНДА',   unlockType: 'crowns', cost: 1 }
];

const COSTUME_ITEMS = [
  { id: 'hat_none',      title: 'Классическая Фасоль', sub: 'Очки Миньона + Кеды',            icon: '🥽', hat: 'none',      rarity: 'ОБЫЧНЫЙ',   unlockType: 'free',   cost: 0 },
  { id: 'hat_dino',      title: 'Ти-Рекс Динозавр',    sub: 'Пасть с зубами + Шипы + Хвост',  icon: '🦖', hat: 'dino',      rarity: 'РЕДКИЙ',    unlockType: 'ad',     cost: 0 },
  { id: 'hat_hotdog',    title: 'Сочный Хот-Дог',      sub: 'Булочка + Горчица + Шорты',      icon: '🌭', hat: 'hotdog',    rarity: 'РЕДКИЙ',    unlockType: 'ad',     cost: 0 },
  { id: 'hat_pirate',    title: 'Капитан Пират',       sub: 'Треуголка + Камзол + Ремень',    icon: '🏴‍☠️', hat: 'pirate',    rarity: 'РЕДКИЙ',    unlockType: 'ad',     cost: 0 },
  { id: 'hat_chicken',   title: 'Боевой Петушок',      sub: 'Гребешок + Клюв + Крылья + Хвост',icon: '🐓', hat: 'chicken',   rarity: 'РЕДКИЙ',    unlockType: 'kudos',  cost: 450 },
  { id: 'hat_astronaut', title: 'Звёздный Астронавт',  sub: 'Купол-шлем + Джетпак + Скафандр',icon: '👩‍🚀', hat: 'astronaut', rarity: 'ЭПИЧЕСКИЙ', unlockType: 'kudos',  cost: 750 },
  { id: 'hat_samurai',   title: 'Кибер-Самурай',       sub: 'Шлем Кабуто + Маска Они + Броня',icon: '👹', hat: 'samurai',   rarity: 'ЭПИЧЕСКИЙ', unlockType: 'crowns', cost: 1 },
  { id: 'hat_wizard',    title: 'Верховный Чародей',   sub: 'Шляпа со звёздами + Борода + Плащ',icon: '🧙‍♂️', hat: 'wizard',  rarity: 'ЭПИЧЕСКИЙ', unlockType: 'crowns', cost: 1 },
  { id: 'hat_pineapple', title: 'Тропический Ананас',  sub: 'Корона листьев + Очки + Юбка',   icon: '🍍', hat: 'pineapple', rarity: 'ЛЕГЕНДА',   unlockType: 'crowns', cost: 2 },
  { id: 'hat_king',      title: 'Император Короны',    sub: 'Золотая Корона + Царская Мантия',icon: '👑', hat: 'king',      rarity: 'ЛЕГЕНДА',   unlockType: 'crowns', cost: 3 }
];

// Original costume pieces shaped for the bean rig, available for test previews.
const EXTRA_COSTUMES = [
 ['fox','Лисёнок','🦊',0xe98242],['rabbit','Кролик','🐰',0xe9b8d0],
 ['cat','Котёнок','🐱',0x798aa8],['bear','Медвежонок','🐻',0xaa744e],
 ['frog','Лягушонок','🐸',0x62c87b],['shark','Акула','🦈',0x648db2],
 ['dragon','Дракончик','🐉',0x9869c4],['bee','Пчёлка','🐝',0xf3ca4d],
 ['robot','Робот','🤖',0x8ba7ba],['diver','Водолаз','🤿',0x37a6a3],
 ['cow','Коровка','🐮',0xe8e4dc],['panda','Панда','🐼',0xdfe2e5],
 ['owl','Совёнок','🦉',0xb38664]
];
EXTRA_COSTUMES.forEach(([hat,title,icon,color]) => COSTUME_ITEMS.push({
 id:'hat_'+hat,title,icon,hat,color,sub:'Объёмный костюм',rarity:'ОБЫЧНЫЙ',unlockType:'free',cost:0
}));

const SEASON_TIERS = [
  { level: 1, xpReq: 0,    title: 'Старт Сезона',       icon: '🥽', rewardText: 'Очки Миньона' },
  { level: 2, xpReq: 300,  title: 'Бонус Лавров',       icon: '🟣', rewardText: '+300 Лавров' },
  { level: 3, xpReq: 700,  title: 'Пламя Турбо-Гонки',  icon: '🔥', rewardText: 'Паттерн Пламя' },
  { level: 4, xpReq: 1200, title: 'Ти-Рекс Динозавр',   icon: '🦖', rewardText: 'Полный Костюм' },
  { level: 5, xpReq: 1800, title: 'Кубок Чемпиона',     icon: '👑', rewardText: '+1 Корона' },
  { level: 6, xpReq: 2500, title: 'Кибер-Самурай',      icon: '👹', rewardText: 'Броня + Маска' },
  { level: 7, xpReq: 3500, title: 'Император Короны',   icon: '🏆', rewardText: 'Мантия + Корона' }
];

// Разнообразные скины ботов (с 1 и 2 глазами-очками миньона, разными паттернами и полными костюмами)
const SKINS = [
  { id: 0, title: 'Ти-Рекс Завр',       icon: '🦖', c1: 0x00e676, c2: 0xffe600, css1: '#00e676', css2: '#ffe600', pattern: 'stripes',   hat: 'dino',      eyeCount: 2 },
  { id: 1, title: 'Сочный Хот-Дог',     icon: '🌭', c1: 0xff2a85, c2: 0xffe600, css1: '#ff2a85', css2: '#ffe600', pattern: 'belly',     hat: 'hotdog',    eyeCount: 1 },
  { id: 2, title: 'Капитан Пират',      icon: '🏴‍☠️', c1: 0x00e5ff, c2: 0x1e40af, css1: '#00e5ff', css2: '#1e40af', pattern: 'stripes',   hat: 'pirate',    eyeCount: 1 },
  { id: 3, title: 'Боевой Петушок',     icon: '🐓', c1: 0xff9100, c2: 0xffffff, css1: '#ff9100', css2: '#ffffff', pattern: 'polka',     hat: 'chicken',   eyeCount: 2 },
  { id: 4, title: 'Звёздный Астронавт', icon: '👩‍🚀', c1: 0xd500f9, c2: 0x76ff03, css1: '#d500f9', css2: '#76ff03', pattern: 'stars',     hat: 'astronaut', eyeCount: 1 },
  { id: 5, title: 'Кибер-Самурай',      icon: '👹', c1: 0xff1744, c2: 0xffd700, css1: '#ff1744', css2: '#ffd700', pattern: 'flames',    hat: 'samurai',   eyeCount: 2 },
  { id: 6, title: 'Верховный Чародей',  icon: '🧙‍♂️', c1: 0x26c6da, c2: 0xff80ab, css1: '#26c6da', css2: '#ff80ab', pattern: 'stars',     hat: 'wizard',    eyeCount: 2 },
  { id: 7, title: 'Тропический Ананас', icon: '🍍', c1: 0xffd700, c2: 0x00e676, css1: '#ffd700', css2: '#00e676', pattern: 'diamonds',  hat: 'pineapple', eyeCount: 1 },
  { id: 8, title: 'Император Короны',   icon: '👑', c1: 0xffd700, c2: 0xb71c1c, css1: '#ffd700', css2: '#b71c1c', pattern: 'diamonds',  hat: 'king',      eyeCount: 2 }
];

function getPlayerComposedSkin() {
  const col = COLOR_PALETTES.find(c => c.id === saveData.selectedColorId) || COLOR_PALETTES[0];
  const pat = PATTERN_ITEMS.find(p => p.id === saveData.selectedPatternId) || PATTERN_ITEMS[0];
  const cos = COSTUME_ITEMS.find(h => h.id === saveData.selectedCostumeId) || COSTUME_ITEMS[0];
  return {
    title: `${col.title} • ${cos.title}`,
    icon: cos.icon,
    c1: col.c1,
    c2: col.c2,
    css1: col.css1,
    css2: col.css2,
    pattern: pat.pattern,
    hat: cos.hat,
    eyeCount: saveData.eyeCount === 1 ? 1 : 2
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

// ==================== ПРОЦЕДУРНЫЙ ЗВУКОВОЙ ДВИЖОК + ФЕСТИВАЛЬНАЯ МУЗЫКА FALL GUYS ====================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = .5;
    this.effectsGain = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && !this.effectsGain) {
      this.effectsGain = this.ctx.createGain(); this.effectsGain.gain.value = this.volume;
      this.effectsGain.connect(this.ctx.destination);
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
    gain.connect(this.effectsGain);

    if (type === 'step') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320 + Math.random() * 50, now);
      osc.frequency.exponentialRampToValueAtTime(175, now + 0.08);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (type === 'bump') {
      // Упругое столкновение двух пухлых фасолинок (Boing + Thump!)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.07);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.19);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.19);
      osc.start(now);
      osc.stop(now + 0.20);
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
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.17);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.17);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'spring') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.28);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.29);
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

// Заряжающий фестивальный синтезатор музыки в стиле Fall Guys ("Everybody Falls" / "Survive the Fall")
class FestivalMusicEngine {
  constructor() {
    this.isPlaying = false;
    this.muted = false;
    this.mode = 'lobby'; // 'lobby' (126 BPM) | 'arena' (136 BPM)
    this.step = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.volume = .5;
    this.track = 0;
  }

  ensureContext() {
    sfx.init();
    const ctx = sfx.ctx;
    if (!ctx) return null;
    if (!this.masterGain) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-16, ctx.currentTime);
      comp.ratio.setValueAtTime(4, ctx.currentTime);
      comp.connect(ctx.destination);

      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.28 * this.volume, ctx.currentTime);
      this.masterGain.connect(comp);

      // Буфер белого шума для хай-хэтов и фестивального хлопка (Clap/Snare)
      const bufSize = ctx.sampleRate * 0.25;
      this.noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  start() {
    const ctx = this.ensureContext();
    if (!ctx || this.isPlaying) return;
    this.isPlaying = true;
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;
    this.timerId = setInterval(() => this.scheduler(), 25);
  }

  selectTrack() { this.track = chooseTrack(this.track); this.step = 0; }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain && sfx.ctx) this.masterGain.gain.setTargetAtTime(this.muted ? 0 : .28*this.volume, sfx.ctx.currentTime, .04);
  }

  setMode(newMode) {
    if (this.mode !== newMode) {
      this.mode = newMode;
      this.step = 0;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    const ctx = this.ensureContext();
    if (ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.28 * this.volume, ctx.currentTime, 0.05);
    }
    if (!this.isPlaying && !this.muted) this.start();
    return this.muted;
  }

  midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  playKick(ctx, t, punch = 1.0) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.45 * punch, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playSnareClap(ctx, t) {
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.14);
    }
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.07);
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playHiHat(ctx, t, open = false) {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(7500, t);
    const g = ctx.createGain();
    const dur = open ? 0.11 : 0.038;
    g.gain.setValueAtTime(open ? 0.11 : 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.masterGain);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  playFunkBass(ctx, t, midi, dur) {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    const freq = this.midiToFreq(midi);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    sub.type = 'square';
    sub.frequency.setValueAtTime(freq * 0.5, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1350, t);
    filter.frequency.exponentialRampToValueAtTime(280, t + dur * 0.85);
    filter.Q.setValueAtTime(3.5, t);

    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    osc.start(t);
    sub.start(t);
    osc.stop(t + dur + 0.01);
    sub.stop(t + dur + 0.01);
  }

  playBrassLead(ctx, t, midi, dur, slideFromMidi = null) {
    // Яркий двухголосный фестивальный Brass-Synth как в главной теме Fall Guys!
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    const targetFreq = this.midiToFreq(midi);
    const startFreq = slideFromMidi ? this.midiToFreq(slideFromMidi) : targetFreq;

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(startFreq, t);
    osc2.frequency.setValueAtTime(startFreq * 1.005, t);
    if (slideFromMidi) {
      osc1.frequency.exponentialRampToValueAtTime(targetFreq, t + 0.045);
      osc2.frequency.exponentialRampToValueAtTime(targetFreq * 1.005, t + 0.045);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.035);
    filter.frequency.exponentialRampToValueAtTime(1600, t + dur);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.015);
    osc2.stop(t + dur + 0.015);
  }

  playMarimbaChord(ctx, t, midis, dur) {
    midis.forEach((m) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.midiToFreq(m), t);
      g.gain.setValueAtTime(0.075, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });
  }

  playFestivalWhistle(ctx, t) {
    // Карнавальный свисток/колокольчик на сильных долях припева
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1567.98, t); // G6
    osc.frequency.setValueAtTime(1760.0, t + 0.06); // A6
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  scheduleStep(ctx, stepIdx, t) {
    const s = stepIdx % 64; // 4 такта по 16 шестнадцатых долей
    const bar = Math.floor(s / 16);
    const inBar = s % 16;

    const bpm = this.mode === 'arena' ? 136 : 126;
    const stepDur = (60 / bpm) / 4;

    if (this.mode === 'arena' && this.track > 0) {
      const theme=MUSIC_TRACKS[this.track-1];
      const bassy=theme.style==='bass', melodic=theme.style==='melodic';
      if(inBar%4===0 || (bassy && inBar===10))this.playKick(ctx,t,bassy?1:.85);
      if(inBar===4||inBar===12)this.playSnareClap(ctx,t);
      if(inBar%2===1)this.playHiHat(ctx,t,inBar===15);
      if(inBar%2===0 && (!melodic || inBar%4===0))this.playFunkBass(ctx,t,theme.bass[bar]+(inBar%8===4?12:0),stepDur*(bassy?2:1.5));
      if(inBar===0||inBar===8)this.playMarimbaChord(ctx,t,theme.chords[bar],stepDur*3);
      if(inBar%2===0) {
        const note=theme.lead[bar][inBar/2];
        if(melodic && inBar%4===2)this.playMarimbaChord(ctx,t,[note],stepDur*2.2);
        else this.playBrassLead(ctx,t,note,stepDur*(melodic?2.1:1.4));
      }
      if(inBar===0 && bar===0)this.playFestivalWhistle(ctx,t);
      return;
    }
    if (this.mode === 'lobby') {
      // ===== ФЕСТИВАЛЬНОЕ ЛОББИ (Bouncy Funk-Pop Groove в Фа-мажоре / Ре-миноре) =====
      if (inBar % 4 === 0) this.playKick(ctx, t, 0.85);
      if (inBar === 4 || inBar === 12) this.playSnareClap(ctx, t);
      if (inBar % 2 === 1) this.playHiHat(ctx, t, inBar === 7 || inBar === 15);

      const lobbyBass = [
        [53, 0, 53, 65, 53, 0, 55, 57, 58, 0, 58, 70, 60, 0, 62, 64],
        [53, 0, 53, 65, 53, 0, 55, 57, 62, 0, 60, 0,  58, 0, 55, 57],
        [50, 0, 50, 62, 52, 0, 53, 55, 58, 0, 58, 70, 60, 0, 62, 64],
        [53, 0, 55, 0,  57, 0, 58, 0,  60, 60, 0, 60, 65, 0, 60, 57]
      ];
      const bNote = lobbyBass[bar][inBar];
      if (bNote > 0) this.playFunkBass(ctx, t, bNote, stepDur * 1.7);

      // Праздничные аккорды маримбы на слабую долю
      if (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14) {
        const chords = [
          [65, 69, 72], // F maj
          [67, 70, 74], // Gm
          [62, 65, 69], // Dm
          [60, 64, 67]  // C maj
        ];
        this.playMarimbaChord(ctx, t, chords[bar], stepDur * 2.1);
      }

      // Залипательная мелодия синтезатора Лобби
      const lobbyLead = [
        [77, 0, 81, 0, 84, 81, 77, 0, 79, 0, 77, 74, 72, 0, 0, 0],
        [77, 0, 81, 0, 84, 86, 84, 0, 81, 0, 79, 77, 79, 0, 0, 0],
        [74, 0, 77, 0, 81, 77, 74, 0, 79, 0, 81, 82, 84, 0, 81, 0],
        [86, 84, 81, 79, 77, 0, 74, 77, 79, 0, 76, 0, 77, 0, 0, 0]
      ];
      const lNote = lobbyLead[bar][inBar];
      if (lNote > 0) {
        this.playBrassLead(ctx, t, lNote, stepDur * 1.9, inBar === 0 ? lNote - 2 : null);
      }
    } else {
      // ===== ЗАРЯЖАЮЩИЙ ГИМН АРЕНЫ ШОУ (136 BPM High-Energy Festival Game Show!) =====
      if (inBar % 4 === 0 || (bar === 3 && inBar === 14)) this.playKick(ctx, t, 1.0);
      if (inBar === 4 || inBar === 12 || (bar === 3 && inBar === 15)) this.playSnareClap(ctx, t);
      this.playHiHat(ctx, t, inBar % 4 === 2);

      if (inBar === 0 && (bar === 0 || bar === 2)) {
        this.playFestivalWhistle(ctx, t);
      }

      // Октавный драйвовый фанк-бас
      const arenaBass = [
        [55, 67, 55, 67, 55, 67, 58, 60, 62, 74, 62, 74, 60, 72, 58, 60],
        [55, 67, 55, 67, 55, 67, 58, 60, 65, 77, 63, 75, 62, 74, 60, 58],
        [51, 63, 51, 63, 53, 65, 53, 65, 55, 67, 55, 67, 58, 70, 60, 72],
        [62, 62, 0,  62, 63, 63, 0,  63, 65, 65, 0,  65, 67, 65, 62, 58]
      ];
      const abNote = arenaBass[bar][inBar];
      if (abNote > 0) this.playFunkBass(ctx, t, abNote, stepDur * 1.45);

      // Мощный фестивальный Brass-хук (в духе Everybody Falls!)
      const arenaLead = [
        [79, 0, 79, 82, 86, 0, 84, 82, 84, 0, 79, 77, 79, 0, 74, 0],
        [79, 0, 79, 82, 86, 0, 89, 86, 84, 0, 82, 79, 81, 0, 0,  0],
        [75, 0, 79, 0,  77, 0, 81, 0,  79, 82, 86, 84, 82, 0, 79, 0],
        [86, 86, 0, 86, 87, 87, 0, 87, 89, 89, 0, 89, 91, 89, 86, 82]
      ];
      const alNote = arenaLead[bar][inBar];
      if (alNote > 0) {
        this.playBrassLead(ctx, t, alNote, stepDur * 1.8, (inBar === 4 || inBar === 12) ? alNote - 2 : null);
      }

      // Праздничная гармоническая подложка
      if (inBar === 0 || inBar === 8) {
        const showChords = [
          [67, 70, 74], // Gm
          [65, 69, 72], // F
          [63, 67, 70], // Eb
          [62, 66, 69]  // D7
        ];
        this.playMarimbaChord(ctx, t, showChords[bar], stepDur * 3.5);
      }
    }
  }

  scheduler() {
    const ctx = sfx.ctx;
    if (!ctx || !this.isPlaying) return;
    const bpm = this.mode === 'arena' ? 136 : 126;
    const stepDur = (60 / bpm) / 4;

    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      if (!this.muted) {
        this.scheduleStep(ctx, this.step, this.nextNoteTime);
      }
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }
}

const music = new FestivalMusicEngine();

// Автозапуск фестивальной музыки при первом клике или нажатии клавиши
function tryAutoStartMusic() {
  if (!music.isPlaying) {
    music.start();
  }
}
window.addEventListener('pointerdown', tryAutoStartMusic, { once: true });
window.addEventListener('keydown', tryAutoStartMusic, { once: true });

// ==================== 3D МИРОВЫЕ КОНСТАНТЫ (В МЕТРАХ THREE.JS) ====================
// В Three.js Y — это высота вверх, а X и Z — горизонтальная плоскость гекса-яруса!
const HEX_RADIUS = 2.25;      // радиус одной шестиугольной 3D-плитки
const HEX_GAP_SCALE = 0.94;   // небольшой зазор между сотами для чёткой читаемости
const HEX_THICKNESS = 0.55;   // толщина 3D-призмы соты
const LAYER_HEIGHT_GAP = 17.5;// увеличенная высота между ярусами, чтобы при прыжках камера никогда не заходила в верхний этаж!
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
const STORAGE_KEY = 'hex_fall_guys_save_v5';

function loadSaveData() {
  let data = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('hex_fall_guys_save_v4') || localStorage.getItem('hex_fall_guys_save_v3');
    if (raw) data = JSON.parse(raw);
  } catch (e) {}

  const defaults = {
    playerName: 'СуперФасолька',
    musicVolume: .5,
    effectsVolume: .5,
    showNameplates: true,
    skinIndex: 0,
    eyeCount: 2, // 2 = два отдельных глаза в маске Миньона, 1 = один большой глаз-циклоп Миньона
    selectedColorId: 'c_pink_yellow',
    selectedPatternId: 'pat_stripes',
    selectedCostumeId: 'hat_dino',
    unlockedColors: ['c_pink_yellow', 'c_cyan_blue', 'c_lime_choco'],
    unlockedPatterns: ['pat_belly', 'pat_stripes', 'pat_polka'],
    unlockedCostumes: ['hat_none', 'hat_dino'],
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
    unlockedPatterns: Array.isArray(data.unlockedPatterns) ? data.unlockedPatterns : defaults.unlockedPatterns,
    unlockedCostumes: Array.isArray(data.unlockedCostumes) ? data.unlockedCostumes : defaults.unlockedCostumes
  };
}

function saveGameData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (e) {}
}

let saveData = loadSaveData();
sfx.volume = Number.isFinite(saveData.effectsVolume) ? Math.max(0,Math.min(1,saveData.effectsVolume)) : .5;
music.volume = Number.isFinite(saveData.musicVolume) ? Math.max(0,Math.min(1,saveData.musicVolume)) : .5;

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
      color: 0x6278a6,
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
      roughness: 0.40,
      metalness: 0.04,
      transparent: false,
      opacity: 1
    });
    this.rimMat = new THREE.MeshStandardMaterial({
      color: initRimCol,
      roughness: 0.56,
      metalness: 0.06,
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
      opacity: 0.35,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.innerRing = new THREE.Mesh(sharedHexInnerRingGeo, ringMat);
    this.innerRing.position.y = 0.02;
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
      // Умеренный батутный прыжок, чтобы персонаж всегда оставался в кадре и не улетал под потолок верхнего этажа
      actor.vy = 15.4;
      actor.onGround = false;
      actor.squash = -0.28;
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

// ==================== ГЕНЕРАЦИЯ ПРОЦЕДУРНЫХ ПАТТЕРНОВ ДЛЯ РАСКРАСКИ ФАСОЛЬКИ ====================
const patternTextureCache = new Map();

function hexToCss(hexNum) {
  return '#' + Number(hexNum).toString(16).padStart(6, '0');
}

function drawStarShape(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

function getBeanPatternTexture(c1Hex, c2Hex, patternId = 'belly') {
  const key = `${c1Hex}_${c2Hex}_${patternId}`;
  if (patternTextureCache.has(key)) return patternTextureCache.get(key);

  const cnv = document.createElement('canvas');
  cnv.width = 512;
  cnv.height = 512;
  const ctx = cnv.getContext('2d');

  const col1 = hexToCss(c1Hex);
  const col2 = hexToCss(c2Hex);

  // Базовая заливка цветом 1
  ctx.fillStyle = col1;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = col2;
  ctx.strokeStyle = col2;

  if (patternId === 'belly') {
    // Овальное контрастное пузико спереди и сердечко/эмблема
    ctx.beginPath();
    ctx.ellipse(256, 305, 92, 130, 0, 0, Math.PI * 2);
    ctx.fill();
    // Полоска на макушке
    ctx.fillRect(0, 0, 512, 55);
  } else if (patternId === 'stripes') {
    // Выразительные тигровые диагональные и поперечные полосы
    for (let y = -120; y < 620; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(160, y + 28, 320, y - 12);
      ctx.quadraticCurveTo(420, y - 30, 512, y + 10);
      ctx.lineTo(512, y + 34);
      ctx.quadraticCurveTo(360, y + 4, 200, y + 44);
      ctx.lineTo(0, y + 28);
      ctx.closePath();
      ctx.fill();
    }
  } else if (patternId === 'polka') {
    // Крупный праздничный горошек / конфетти по всему телу
    const rows = 6;
    const cols = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = (c + (r % 2) * 0.5) * (512 / cols);
        const py = (r + 0.5) * (512 / rows);
        ctx.beginPath();
        ctx.arc(px % 512, py, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (patternId === 'flames') {
    // Языки гоночного пламени снизу вверх + воротник сверху
    ctx.fillRect(0, 390, 512, 122);
    const flameCount = 10;
    const fw = 512 / flameCount;
    for (let i = 0; i < flameCount; i++) {
      const fx = i * fw;
      const fh = (i % 2 === 0) ? 185 : 135;
      ctx.beginPath();
      ctx.moveTo(fx, 410);
      ctx.quadraticCurveTo(fx + fw * 0.35, 410 - fh * 0.6, fx + fw * 0.5, 410 - fh);
      ctx.quadraticCurveTo(fx + fw * 0.65, 410 - fh * 0.6, fx + fw, 410);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(0, 0, 512, 65);
  } else if (patternId === 'stars') {
    // Россыпь пятиконечных звёзд
    const starCoords = [
      [80, 90, 28], [220, 75, 24], [380, 95, 30], [460, 170, 22],
      [130, 195, 32], [270, 185, 36], [395, 220, 26], [60, 290, 25],
      [185, 310, 34], [320, 300, 32], [445, 325, 28], [110, 410, 26],
      [256, 415, 34], [385, 420, 28]
    ];
    for (const [sx, sy, sr] of starCoords) {
      drawStarShape(ctx, sx, sy, 5, sr, sr * 0.45);
    }
  } else if (patternId === 'lightning') {
    // Острые зигзаги-молнии вокруг корпуса
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let yBase = 95; yBase <= 415; yBase += 105) {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 64) {
        const dy = ((x / 64) % 2 === 0) ? -28 : 28;
        if (x === 0) ctx.moveTo(x, yBase + dy);
        else ctx.lineTo(x, yBase + dy);
      }
      ctx.stroke();
    }
  } else if (patternId === 'rings') {
    // Гипнотические концентрические мишени и волны
    ctx.lineWidth = 20;
    const centers = [[256, 265], [0, 265], [512, 265]];
    for (const [cx, cy] of centers) {
      for (let rad = 32; rad <= 145; rad += 38) {
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (patternId === 'diamonds') {
    // Королевский ромбовидный узор Арлекин
    const size = 64;
    for (let y = 0; y < 512; y += size) {
      for (let x = 0; x < 512; x += size) {
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y);
        ctx.lineTo(x + size, y + size / 2);
        ctx.lineTo(x + size / 2, y + size);
        ctx.lineTo(x, y + size / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  patternTextureCache.set(key, tex);
  return tex;
}

// A soft shared shadow keeps feet readable without the hard black discs that
// otherwise look like holes in the platforms.
const beanShadowCanvas = document.createElement('canvas');
beanShadowCanvas.width = beanShadowCanvas.height = 128;
const beanShadowContext = beanShadowCanvas.getContext('2d');
const beanShadowGradient = beanShadowContext.createRadialGradient(64, 64, 8, 64, 64, 64);
beanShadowGradient.addColorStop(0, 'rgba(12,18,46,0.52)');
beanShadowGradient.addColorStop(.48, 'rgba(12,18,46,0.24)');
beanShadowGradient.addColorStop(1, 'rgba(12,18,46,0)');
beanShadowContext.fillStyle = beanShadowGradient;
beanShadowContext.fillRect(0, 0, 128, 128);
const beanShadowTexture = new THREE.CanvasTexture(beanShadowCanvas);

// ==================== СОЗДАНИЕ 3D-МОДЕЛИ ФАСОЛИНКИ (ОЧКИ МИНЬОНА + ПАТТЕРН + ПОЛНЫЙ КОСТЮМ ВЕРХ И НИЗ) ====================
function createBean3DMesh(skin) {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const patTex = getBeanPatternTexture(skin.c1, skin.c2, skin.pattern || 'belly');

  // Материал туловища с процедурным 2D-паттерном поверх белой базы, чтобы оба цвета паттерна были яркими и сочными!
  const mainMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: patTex,
    roughness: 0.30,
    metalness: 0.06
  });
  const primarySolidMat = new THREE.MeshStandardMaterial({
    color: skin.c1,
    roughness: 0.32,
    metalness: 0.06
  });
  const subMat = new THREE.MeshStandardMaterial({
    color: skin.c2,
    roughness: 0.36,
    metalness: 0.08
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x161224,
    roughness: 0.25
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd0d7de,
    metalness: 0.72,
    roughness: 0.22
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.68,
    roughness: 0.22
  });

  // 1. Туловище-капсула (Bean Torso) с паттерном раскраски
  const torsoGeo = new THREE.CapsuleGeometry(0.62, 0.56, 16, 28);
  const torsoMesh = new THREE.Mesh(torsoGeo, mainMat);
  torsoMesh.position.y = 1.12;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  // Soft, dimensional goggles: each eye mode builds its own frame.
  const faceGroup = new THREE.Group();
  bodyPivot.add(faceGroup);
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(.635, .635, .095, 32, 1, true), darkMat);
  strap.position.y = 1.40; faceGroup.add(strap);
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x76513c, roughness: .3 });
  const eyeFrame = (x, radius) => {
    const unit = new THREE.Group(); unit.position.set(x, 1.40, .605);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, .055, 12, 32), chromeMat);
    unit.add(rim);
    const white = new THREE.Mesh(new THREE.SphereGeometry(radius*.86, 24, 16), whiteMat);
    white.scale.z = .5; white.position.z = .01; unit.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(radius*.34, 20, 12), irisMat);
    iris.scale.z = .32; iris.position.set(0,-.015,radius*.43); unit.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(radius*.18, 16, 12), darkMat);
    pupil.scale.z = .35; pupil.position.set(0,-.015,radius*.53); unit.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(radius*.075, 12, 8), whiteMat);
    shine.position.set(-radius*.10,radius*.09,radius*.59); unit.add(shine);
    faceGroup.add(unit);
  };
  if (skin.eyeCount === 1) eyeFrame(0, .24);
  else { eyeFrame(-.20, .18); eyeFrame(.20, .18); }

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
  const leftHand = new THREE.Mesh(armGeo, primarySolidMat);
  leftHand.position.y = -0.18;
  leftHand.castShadow = true;
  leftArm.add(leftHand);
  leftArm.rotation.z = 0.22;
  bodyPivot.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.68, 1.18, 0);
  const rightHand = new THREE.Mesh(armGeo, primarySolidMat);
  rightHand.position.y = -0.18;
  rightHand.castShadow = true;
  rightArm.add(rightHand);
  rightArm.rotation.z = -0.22;
  bodyPivot.add(rightArm);

  // ==================== 5. ПОЛНЫЕ ВЫРАЗИТЕЛЬНЫЕ 3D-КОСТЮМЫ (ВЕРХ + НИЗ + МАСКИ / ХВОСТЫ / ДОСПЕХИ) ====================
  const costumeGroup = new THREE.Group();
  bodyPivot.add(costumeGroup);

  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 1.92, 0);
  bodyPivot.add(hatGroup);

  // Базовые штанишки/пояс (переопределяются полными костюмами)
  const pantsGeo = new THREE.CylinderGeometry(0.642, 0.585, 0.40, 24);
  const pantsMat = new THREE.MeshStandardMaterial({ color: skin.c2, roughness: 0.38 });
  const pantsMesh = new THREE.Mesh(pantsGeo, pantsMat);
  pantsMesh.position.y = 0.72;
  // Separate trouser legs move with the character's existing leg joints.
  const trouserGeo = new THREE.CapsuleGeometry(.22, .20, 8, 16);
  const leftTrouser = new THREE.Mesh(trouserGeo, pantsMat);
  leftTrouser.position.y = -.12; leftLeg.add(leftTrouser);
  const rightTrouser = new THREE.Mesh(trouserGeo, pantsMat);
  rightTrouser.position.y = -.12; rightLeg.add(rightTrouser);

  const cType = skin.hat || 'none';

  if (cType === 'dino') {
    // 🦖 КОСТЮМ ТИ-РЕКСА (ВЕРХ: пасть динозавра с белыми 3D-зубами + спинной гребень | НИЗ: зелёный пояс + длинный хвост)
    const dinoMat = new THREE.MeshStandardMaterial({ color: 0x00c853, roughness: 0.35 });
    const bellyScaleMat = new THREE.MeshStandardMaterial({ color: 0xffe082, roughness: 0.4 });
    pantsMat.color.setHex(0x009624);

    // Верхняя челюсть-капюшон над очками
    const snout = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), dinoMat);
    snout.scale.set(.40,.24,.40);
    snout.position.set(0, -0.02, 0.16);
    hatGroup.add(snout);

    // Ноздри и глаза динозавра на капюшоне
    const nostrilL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), darkMat);
    nostrilL.position.set(-0.20, 0.14, 0.44);
    const nostrilR = nostrilL.clone();
    nostrilR.position.x = 0.20;
    hatGroup.add(nostrilL, nostrilR);

    // Ряд белых острых зубов под верхней челюстью
    for (let i = -2; i <= 2; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), whiteMat);
      tooth.rotation.x = Math.PI;
      tooth.position.set(i * 0.13, -0.22, 0.46);
      hatGroup.add(tooth);
    }

    // Гребень из жёлтых шипов от макушки вдоль спины до хвоста
    for (let s = 0; s < 5; s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 8), bellyScaleMat);
      spike.rotation.x = -0.85;
      spike.position.set(0, 1.82 - s * 0.25, -0.52 - (s === 2 ? 0.08 : 0));
      costumeGroup.add(spike);
    }

    // Длинный изогнутый 3D-хвост динозавра сзади (Низ)
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.95, 12), dinoMat);
    tail.rotation.x = -Math.PI * 0.42;
    tail.position.set(0, 0.68, -0.86);
    costumeGroup.add(tail);
  } else if (cType === 'hotdog') {
    // 🌭 ПОЛНЫЙ КОСТЮМ СОЧНОГО ХОТ-ДОГА (Боковые половинки пышной булочки + волна горчицы + шорты)
    const bunMat = new THREE.MeshStandardMaterial({ color: 0xe69a45, roughness: 0.48 });
    const sausageMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.32 });
    const mustardMat = new THREE.MeshStandardMaterial({ color: 0xffea00, roughness: 0.25 });
    pantsMat.color.setHex(0xb71c1c);

    // Левая и правая половинки пышной булочки по бокам туловища
    const bunGeo = new THREE.CapsuleGeometry(0.32, 0.72, 12, 18);
    const leftBun = new THREE.Mesh(bunGeo, bunMat);
    leftBun.position.set(-0.48, 1.12, -0.05);
    const rightBun = new THREE.Mesh(bunGeo, bunMat);
    rightBun.position.set(0.48, 1.12, -0.05);
    costumeGroup.add(leftBun, rightBun);

    // Верхушка сосиски на голове
    const topDog = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), sausageMat);
    topDog.scale.set(.40,.22,.40);
    topDog.position.y = -0.02;
    hatGroup.add(topDog);

    // Зигзаг горчицы на животике
    for (let i = 0; i < 4; i++) {
      const zig = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.085, 0.12), mustardMat);
      zig.position.set((i % 2 === 0 ? -0.04 : 0.04), 1.05 - i * 0.12, 0.61);
      zig.rotation.z = (i % 2 === 0) ? 0.28 : -0.28;
      costumeGroup.add(zig);
    }
  } else if (cType === 'pirate') {
    // 🏴‍☠️ КАПИТАН ПИРАТ (ВЕРХ: треуголка с золотым кантом и пером + эполеты | НИЗ: широкий пояс с пряжкой и камзол)
    const tricornMat = new THREE.MeshStandardMaterial({ color: 0x1b162a, roughness: 0.4 });
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x8e0000, roughness: 0.38 });
    pantsMat.color.setHex(0x1f2937);

    // Широкая треуголка
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.52, 0.26, 3), tricornMat);
    hatBrim.rotation.y = Math.PI;
    hatBrim.position.y = 0.02;
    hatGroup.add(hatBrim);

    // Золотой кант и красное перо на треуголке
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.52, 8), new THREE.MeshStandardMaterial({ color: 0xff1744 }));
    feather.position.set(0.36, 0.24, 0);
    feather.rotation.z = -0.35;
    hatGroup.add(feather);

    // Золотые эполеты на плечах (Верх)
    const epL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.34), goldMat);
    epL.position.set(-0.62, 1.44, 0);
    const epR = epL.clone();
    epR.position.x = 0.62;
    costumeGroup.add(epL, epR);

    // Полы капитанского камзола и широкий кожаный ремень с золотой пряжкой (Низ)
    // Short rounded coat panels leave the legs and belt visible.
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), coatMat);
      panel.scale.set(.19,.32,.16); panel.position.set(side*.44,1.05,.40);
      costumeGroup.add(panel);
    }

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.625, 0.09, 32, 1, true), darkMat);
    belt.position.y = 0.88;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.20, 0.10), goldMat);
    buckle.position.set(0, 0.88, 0.625);
    costumeGroup.add(belt, buckle);
  } else if (cType === 'chicken') {
    // 🐓 БОЕВОЙ ПЕТУШОК (ВЕРХ: красный гребешок + жёлтый клюв + крылышки | НИЗ: пуховые штанишки + хвост + оранжевые лапки)
    const combMat = new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.3 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffab00, roughness: 0.25 });
    pantsMat.color.setHex(0xffffff);
    leftFoot.material = beakMat;
    rightFoot.material = beakMat;

    // Трёхзубчатый красный гребешок на макушке
    for (let i = -1; i <= 1; i++) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), combMat);
      lobe.scale.set(0.65, 1.35, 1.0);
      lobe.position.set(0, 0.08 + (1 - Math.abs(i)) * 0.06, i * 0.20);
      hatGroup.add(lobe);
    }

    // Объёмный жёлтый клюв под очками Миньона и красная бородка
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 8), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.12, 0.74);
    const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), combMat);
    wattle.position.set(0, 0.99, 0.66);
    costumeGroup.add(beak, wattle);

    // Пышный перьевой хвост сзади (Низ)
    for (let t = -1; t <= 1; t++) {
      const tailFeather = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.48, 8), whiteMat);
      tailFeather.rotation.x = -0.8;
      tailFeather.rotation.z = t * 0.32;
      tailFeather.position.set(t * 0.14, 0.78, -0.72);
      costumeGroup.add(tailFeather);
    }
  } else if (cType === 'astronaut') {
    // 👩‍🚀 ЗВЁЗДНЫЙ АСТРОНАВТ (ВЕРХ: прозрачный купол шлема + реактивный джетпак + нагрудный пульт | НИЗ: пояс скафандра)
    const suitMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.25, metalness: 0.15 });
    pantsMat.color.setHex(0xcfd8dc);

    // Прозрачный стеклянный купол гермошлема вокруг головы
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x80d8ff,
      transparent: true,
      opacity: 0.34,
      roughness: 0.08,
      metalness: 0.2
    });
    const helmetDome = new THREE.Mesh(new THREE.SphereGeometry(0.74, 24, 20), glassMat);
    helmetDome.position.set(0, 1.40, 0.04);
    costumeGroup.add(helmetDome);

    // Золотое шейное кольцо скафандра
    const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.065, 12, 28), goldMat);
    neckRing.rotation.x = Math.PI / 2;
    neckRing.position.y = 1.05;
    costumeGroup.add(neckRing);

    // Двухсопловый реактивный джетпак за спиной
    const packBox = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.62, 0.34), suitMat);
    packBox.position.set(0, 1.22, -0.68);
    const thrusterL = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 12), darkMat);
    thrusterL.position.set(-0.20, 0.84, -0.68);
    const thrusterR = thrusterL.clone();
    thrusterR.position.x = 0.20;
    costumeGroup.add(packBox, thrusterL, thrusterR);

    // Нагрудная панель управления
    const chestPad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.10), suitMat);
    chestPad.position.set(0, 0.94, 0.60);
    costumeGroup.add(chestPad);
  } else if (cType === 'samurai') {
    // 👹 КИБЕР-САМУРАЙ (ВЕРХ: шлем Кабуто с рогами-полумесяцем + демоническая маска Мэнгу + наплечники | НИЗ: юбка-доспех)
    const armorMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.3, metalness: 0.25 });
    pantsMat.color.setHex(0x1b162a);

    // Купол шлема Кабуто и боковые пластины Сикоро
    const kabuto = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.72, 0.32, 16), darkMat);
    kabuto.position.y = 0.02;
    hatGroup.add(kabuto);

    // Золотой рогатый полумесяц Кувагата на лбу шлема
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 8), goldMat);
    hornL.position.set(-0.26, 0.22, 0.38);
    hornL.rotation.z = 0.48;
    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 8), goldMat);
    hornR.position.set(0.26, 0.22, 0.38);
    hornR.rotation.z = -0.48;
    hatGroup.add(hornL, hornR);

    // Детализированная маска демона Они (Мэнгу) на нижней половине лица с белыми клыками
    const mengu = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), armorMat);
    mengu.scale.set(.31,.14,.14);
    mengu.position.set(0, 1.08, 0.56);
    const fangL = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 6), whiteMat);
    fangL.position.set(-0.18, 1.16, 0.68);
    const fangR = fangL.clone();
    fangR.position.x = 0.18;
    costumeGroup.add(mengu, fangL, fangR);

    // Самурайские наплечники (Содэ) и боевая юбка-доспех (Кусадзури) внизу
    const sodeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.42), armorMat);
    sodeL.position.set(-0.72, 1.28, 0);
    const sodeR = sodeL.clone();
    sodeR.position.x = 0.72;

    const armorSkirt = new THREE.Group();
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), armorMat);
      plate.scale.set(.23,.20,.12); plate.position.set(side*.33,.76,.48); armorSkirt.add(plate);
    }
    const goldBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.10, 24), goldMat);
    goldBelt.position.y = 0.90;
    costumeGroup.add(sodeL, sodeR, armorSkirt, goldBelt);
  } else if (cType === 'wizard') {
    // 🧙‍♂️ ВЕРХОВНЫЙ ЧАРОДЕЙ (ВЕРХ: высокая шляпа мага + пушистая белая борода + плащ | НИЗ: мантия и пояс со сферой)
    const wizMat = new THREE.MeshStandardMaterial({ color: 0x4a148c, roughness: 0.38 });
    pantsMat.color.setHex(0x311b92);

    // Широкие поля и высокий конус шляпы волшебника
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.06, 24), wizMat);
    brim.position.y = -0.05;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.88, 18), wizMat);
    cone.position.y = 0.38;
    cone.rotation.z = -0.12;
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.48, 0.10, 18), goldMat);
    hatBand.position.y = 0.02;
    hatGroup.add(brim, cone, hatBand);

    // Пышная белоснежная 3D-борода под очками Миньона
    const beardMain = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), whiteMat);
    beardMain.scale.set(.32,.34,.14);
    beardMain.rotation.x = Math.PI;
    beardMain.position.set(0, 0.92, 0.56);
    costumeGroup.add(beardMain);

    // Магический плащ за спиной и золотой пояс со светящейся сферой (Низ)
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.78, 1.05, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), wizMat);
    cape.position.set(0, 1.05, -0.08);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    orb.position.set(0, 0.84, 0.66);
    costumeGroup.add(cape, orb);
  } else if (cType === 'pineapple') {
    // 🍍 ТРОПИЧЕСКИЙ АНАНАС (ВЕРХ: корона зелёных листьев + неоновые очки-жалюзи | НИЗ: гавайская травяная юбочка)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x00e676, roughness: 0.32 });
    const shadesMat = new THREE.MeshStandardMaterial({ color: 0xff2a85, roughness: 0.2 });
    pantsMat.color.setHex(0x00c853);

    // Пышный пучок листьев ананаса на макушке
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.62, 6), leafMat);
      leaf.position.set(Math.cos(ang) * 0.16, 0.22, Math.sin(ang) * 0.16);
      leaf.rotation.x = Math.sin(ang) * 0.45;
      leaf.rotation.z = -Math.cos(ang) * 0.45;
      hatGroup.add(leaf);
    }

    // Модные тропические козырьки над окулярами
    const visorBar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.16), shadesMat);
    visorBar.position.set(0, 1.49, 0.60);
    costumeGroup.add(visorBar);

    // Small leaf accents on the waistband keep the legs visible.
    for (let k = 0; k < 5; k++) {
      const frond = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), leafMat);
      frond.scale.set(.06,.13,.035); frond.rotation.z=(k-2)*.14;
      frond.position.set((k-2)*.13,.76,.59); costumeGroup.add(frond);
    }
  } else if (cType === 'king' || cType === 'crown') {
    // 👑 ИМПЕРАТОР КОРОНЫ (ВЕРХ: большая золотая корона с рубинами + горностаевый воротник + мантия | НИЗ: царский кушак)
    const velvetMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.35 });
    pantsMat.color.setHex(0x880e4f);

    // Большая золотая корона с бархатным куполом и самоцветами
    const crownCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.36, 0.32, 8), goldMat);
    crownCyl.position.y = 0.10;
    const innerVelvet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), velvetMat);
    innerVelvet.position.y = 0.14;
    hatGroup.add(crownCyl, innerVelvet);

    // Пышный белый горностаевый воротник вокруг плеч и пурпурная мантия за спиной
    const furCollar = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.14, 12, 24), whiteMat);
    furCollar.rotation.x = Math.PI / 2;
    furCollar.position.y = 1.54;

    const royalCape = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.84, 1.15, 18, 1, true, Math.PI * 0.55, Math.PI * 0.9),
      velvetMat
    );
    royalCape.position.set(0, 1.02, -0.10);

    const goldSash = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.14, 24), goldMat);
    goldSash.position.y = 0.86;
    costumeGroup.add(furCollar, royalCape, goldSash);
  }

  const extra = EXTRA_COSTUMES.find(item => item[0] === cType);
  if (extra) {
    const tone = new THREE.MeshStandardMaterial({color:extra[3],roughness:.48});
    const accent = new THREE.MeshStandardMaterial({color: cType === 'bee' ? 0x4b342a : 0xffd7cb,roughness:.55});
    pantsMat.color.setHex(extra[3]);
    // Rounded hood sits behind the goggles; the face remains visible.
    const hood = new THREE.Mesh(new THREE.SphereGeometry(1,24,18),tone);
    hood.scale.set(.58,.32,.53); hood.position.set(0,.04,-.03); hatGroup.add(hood);
    const addOval = (x,y,z,sx,sy,sz,mat=tone) => {
      const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),mat);
      m.scale.set(sx,sy,sz); m.position.set(x,y,z); hatGroup.add(m); return m;
    };
    if (['fox','cat','rabbit','bear','panda','cow','owl'].includes(cType)) {
      const long = cType === 'rabbit';
      for (const side of [-1,1]) {
        const ear=addOval(side*.36,long?.43:.23,-.02,long?.16:.20,long?.42:.24,.14);
        ear.rotation.z = -side*.28;
        const inner=addOval(side*.36,long?.45:.24,.11,long?.085:.10,long?.27:.12,.035,accent);
        inner.rotation.z=-side*.28;
      }
    }
    if (['frog','shark','dragon'].includes(cType)) {
      if(cType==='frog') for(const side of [-1,1]) {
        addOval(side*.32,.25,.10,.18,.17,.16);
        addOval(side*.32,.28,.24,.09,.09,.035,whiteMat);
        addOval(side*.32,.28,.275,.045,.05,.02,darkMat);
      }
      else {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(.19,.47,8),tone);
        fin.position.set(0,.36,-.08); hatGroup.add(fin);
        const nose=addOval(0,-.02,.37,.36,.15,.24);
        for(let i=-2;i<=2;i++) { const tooth=new THREE.Mesh(new THREE.ConeGeometry(.035,.11,8),whiteMat); tooth.rotation.x=Math.PI; tooth.position.set(i*.12,-.17,.53);hatGroup.add(tooth); }
      }
    }
    if(cType==='bee') {
      for(const side of [-1,1]) {
        const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.32,10),darkMat); antenna.position.set(side*.22,.34,0); antenna.rotation.z=-side*.35;hatGroup.add(antenna);
        addOval(side*.27,.50,0,.07,.07,.07,darkMat);
        const wing=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),whiteMat); wing.scale.set(.25,.36,.08); wing.position.set(side*.43,1.18,-.56);wing.rotation.z=side*.55;costumeGroup.add(wing);
      }
    }
    if(cType==='robot'||cType==='diver') {
      const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.28,12),chromeMat); antenna.position.y=.36;hatGroup.add(antenna);addOval(0,.53,0,.09,.09,.09,cType==='diver'?primarySolidMat:goldMat);
    }
    if(cType==='cow') for(const side of [-1,1]) { const horn=new THREE.Mesh(new THREE.ConeGeometry(.09,.24,12),whiteMat);horn.position.set(side*.28,.32,-.04);hatGroup.add(horn); }
  }

  // Тень-блоб под ногами (проектируется ровно на поверхность соты под персонажем для 100% читаемости прыжка!)
  const shadowGeo = new THREE.PlaneGeometry(1.55, 1.55);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: beanShadowTexture,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const blobShadow = new THREE.Mesh(shadowGeo, shadowMat);
  blobShadow.position.y = 0.03;
  root.add(blobShadow);

  // The soft projected contact shadow is easier to read than a second,
  // sharply offset silhouette from the directional light on small platforms.
  root.traverse(part => { if (part.isMesh) part.castShadow = false; });

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

    // Импульс физического отталкивания при столкновении двух фасолинок
    this.knockVx = 0;
    this.knockVz = 0;
    this.bumpCooldown = 0;

    this.radius = 0.80; // увеличенный физический радиус капсулы с учётом костюма для честных столкновений
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
      // Аккуратный прыжок (и ослабленный бонус Грави-перьев), чтобы камера всегда держала фасольку в идеальном ракурсе
      const boost = this.buffs.feather > 0 ? 1.06 : 1.0;
      this.vy = 12.4 * boost;
      this.onGround = false;
      this.jumpCount++;
      this.squash = -0.25;
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

    const diveSpeed = 13.5;
    this.vx = Math.sin(this.facing) * diveSpeed;
    this.vz = Math.cos(this.facing) * diveSpeed;
    this.vy = this.onGround ? 6.8 : Math.max(this.vy, 5.5);
    this.onGround = false;

    if (this.isPlayer) sfx.play('dive');
    spawnParticles3D(this.x, this.y + 0.8, this.z, 0xff9100, 8);

    // Мощный толчок соперников при нырке вперёд
    state.actors.forEach(other => {
      if (other !== this && other.alive && Math.abs(other.y - this.y) < 2.5) {
        const dx = other.x - this.x;
        const dz = other.z - this.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.4 && dist > 0.01) {
          other.knockVx += (dx / dist) * 14.5;
          other.knockVz += (dz / dist) * 14.5;
          other.vy = 7.2;
          other.onGround = false;
          other.squash = 0.32;
          this.score += 35;
          if (this.isPlayer || other.isPlayer) sfx.play('bump');
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
      bodyPivot.rotation.z = 0;
      leftArm.rotation.x = -2.2;
      rightArm.rotation.x = -2.2;
      leftLeg.rotation.x = 0.5;
      rightLeg.rotation.x = 0.5;
    } else if (!this.onGround) {
      this.walkCycle += dt * 8;
      bodyPivot.position.y = 0;
      bodyPivot.rotation.x = 0.15;
      bodyPivot.rotation.z *= Math.max(0, 1 - dt * 8);
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

function startMatch(options = {}) {
  if (state.showdownVisuals) { state.showdownVisuals.dispose(); state.showdownVisuals = null; }
  state.showdown = null;
  if (state.slimeVisuals) { state.slimeVisuals.dispose(); state.slimeVisuals = null; }
  state.slimeCourse = null;
  if (state.rolloutVisuals) { state.rolloutVisuals.dispose(); state.rolloutVisuals = null; }
  state.rollout = null;
  if (slimeSeaMesh) { slimeSeaMesh.material.color.setHex(0xff2a85); slimeSeaMesh.material.emissive.setHex(0xc80055); }
  document.querySelector('.brand-pill .pill-title').textContent='HEX-A-GONE 3D';
  document.querySelector('.layer-pill .pill-label').textContent='ЯРУС';
  if (state.raceVisuals) { state.raceVisuals.dispose(); state.raceVisuals = null; }
  state.race = null;
  const diffKey = state.diffKey;
  const config = { ...DIFFICULTIES[diffKey] };
  if (options.largeField) config.botsCount = Math.max(config.botsCount, 14);
  if (options.qualifiers) config.botsCount = options.qualifiers.filter(a => !a.isPlayer).length;
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

  // Включаем 3D-арену, фон телешоу и переключаем фестивальный синтезатор на драйвовый ритм шоу (136 BPM)!
  music.start();
  music.setMode('arena');
  music.selectTrack();
  lobbyGroup.visible = false;
  stadiumGroup.visible = true;
  stadiumPillars.forEach(pillar => { pillar.visible = true; });
  arenaGroup.visible = true;
  actorsGroup.visible = true;
  fxGroup.visible = true;
  // A soft daylight backdrop separates the playfield from the distant scenery.
  scene.background = new THREE.Color(0xa6dbee);
  scene.fog = new THREE.FogExp2(0xa6dbee, 0.0030);

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

  const qualifiedBots = options.qualifiers?.filter(a => !a.isPlayer) || null;
  const botNames = qualifiedBots ? qualifiedBots.map(a => a.name) : generateFunnyBotNames(config.botsCount);
  for (let i = 0; i < config.botsCount; i++) {
    const angle = ((i + 1) / totalActors) * Math.PI * 2;
    const ringDist = HEX_RADIUS * (config.gridRadius * 1.15);
    const bx = Math.cos(angle) * ringDist;
    const bz = Math.sin(angle) * ringDist;
    const axial = worldXZToAxial(bx, bz);
    const bTile = topLayer.map.get(`${axial.q},${axial.r}`) || spawnRing[(i * 2) % spawnRing.length];

    const botSkin = qualifiedBots ? qualifiedBots[i].skin : SKINS[(i + 1) % SKINS.length];
    const bot = new Actor3D(
      qualifiedBots ? qualifiedBots[i].id : `bot_${i}`,
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

// ==================== BIG FANS: TEST COURSE ====================
function startBigFans(mode = 'single') {
  state.lastMode = mode;
  startMatch({largeField: mode === 'championship'});
  state.showMode = mode;
  document.querySelector('.brand-pill .pill-title').textContent = 'BIG FANS';
  document.querySelector('.layer-pill .pill-label').textContent = 'КОНТРОЛЬНЫЕ ТОЧКИ';
  stadiumPillars.forEach(pillar => { pillar.visible = false; });
  slimeSeaMesh.material.color.setHex(0x151c42); slimeSeaMesh.material.emissive.setHex(0x090d25);
  // The race has a single ground height and its own arena and rules.
  arenaGroup.clear();
  state.layers = [{ index: 0, yHeight: 0, list: [], map: new Map() }];
  state.race = createCourseState();
  state.raceFinishNotice = 0;
  document.getElementById('race-finish-notice')?.remove();
  state.raceVisuals = createCourseVisuals(THREE, state.race);
  arenaGroup.add(state.raceVisuals.root);
  state.raceVisuals.update();
  state.phase = 'countdown';
  state.countdownTimer = 3.2;
  state.elapsed = 0;
  state.actors.forEach((actor, i) => {
    actor.x = ((i % 5) - 2) * 2.2;
    actor.z = -3 + Math.floor(i / 5) * 2;
    actor.y = 0; actor.vx = actor.vy = actor.vz = 0;
    actor.facing = 0; actor.visualFacing = 0;
    initializeRacer(actor);
  });
  state.targetCamYaw = Math.PI;
  state.camYaw = Math.PI;
  state.camFocusPos.set(state.player.x, 1.3, state.player.z);
  document.getElementById('countdown-badge').textContent = state.showMode === 'championship' ? 'BIG FANS • РАУНД 1' : 'BIG FANS';
  document.getElementById('countdown-text').textContent = '3';
  document.getElementById('countdown-sub').textContent = 'Доберитесь до финиша через вращающиеся платформы!';
  updateRaceHUD();
}
function updateRaceHUD() {
  const finished = state.actors.filter(a => a.raceFinished).length;
  const quota = Math.max(1, Math.ceil(state.actors.length * .7));
  document.getElementById('hud-mode-label').textContent = state.showMode === 'championship' ? 'BIG FANS • РАУНД 1' : 'BIG FANS';
  document.getElementById('hud-alive').textContent = `${finished} / ${quota}`;
  document.getElementById('hud-layer').textContent = `${state.player.checkpoint} / 3`;
  document.getElementById('hud-timer').textContent = formatTime(state.elapsed);
}
function finishRace(result) {
  const qualifiers = result.finished.slice(0, result.quota);
  const playerQualified = qualifiers.includes(state.player);
  if (state.showMode === 'championship' && playerQualified) {
    showCelebrationOverlay({
      type: 'qualified',
      icon: '🏁',
      ribbon: 'РАУНД 1 ПРОЙДЕН!',
      title: 'РАУНД ПРОЙДЕН!',
      subtitle: 'ТЫ ПРОШЁЛ! Переход в Раунд 2: Roll Out...',
      duration: 2.4,
      onComplete: () => {
        startRollOut('championship_rollout', qualifiers);
      }
    });
    return;
  }
  state.phase = 'gameover';
  const p = state.player;
  const place = result.finished.indexOf(p) + 1;
  const passed = playerQualified;
  document.getElementById('result-ribbon').textContent = state.showMode === 'championship' ? 'BIG FANS • РАУНД 1' : 'BIG FANS';
  document.getElementById('result-title').textContent = passed ? `ВЫ ПРОШЛИ! МЕСТО #${place}` : 'ЗАБЕГ ОКОНЧЕН';
  document.getElementById('result-subtitle').textContent = passed ? 'Вы достигли финиша в числе прошедших!' : 'Квота заполнена или время закончилось. Попробуйте ещё раз!';
  document.getElementById('spot-winner-name').textContent = result.finished[0]?.name || 'Финиширующих нет';
  document.getElementById('spot-winner-meta').textContent = `${result.finished.length} / ${result.quota} финишировали`;
  document.getElementById('res-place').textContent = place ? `#${place}` : '—';
  document.getElementById('res-time').textContent = formatTime(place ? p.raceFinishTime : state.elapsed);
  document.getElementById('res-tiles').textContent = String(p.checkpoint);
  document.getElementById('res-score').textContent = '—';
  const standings = document.getElementById('match-standings');
  standings.replaceChildren();
  result.finished.slice(0, 10).forEach((actor, index) => {
    const row = document.createElement('div'); row.className = 'standing-row';
    row.textContent = `#${index + 1} ${actor.name} — ${formatTime(actor.raceFinishTime)}`;
    standings.appendChild(row);
  });
  document.getElementById('result-modal').classList.remove('hidden');
}
function updateBigFans(dt) {
  const p = state.player;
  state.elapsed += dt;
  if (!p.raceFinished) {
    let right = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    if (joystick.active) { right += joystick.dx; forward -= joystick.dy; }
    const length = Math.hypot(right, forward);
    if (length > .05 && !p.isDiving) {
      right /= Math.max(1, length); forward /= Math.max(1, length);
      const dx = -Math.sin(state.camYaw)*forward + Math.cos(state.camYaw)*right;
      const dz = -Math.cos(state.camYaw)*forward - Math.sin(state.camYaw)*right;
      p.facing = Math.atan2(dx, dz);
      const rate = Math.min(1, dt * (p.onGround ? 11 : 6));
      p.vx += (dx * 7.2 - p.vx) * rate; p.vz += (dz * 7.2 - p.vz) * rate;
    } else if (!p.isDiving) {
      const friction = Math.max(0, 1-dt*(p.onGround ? 10 : 2.5));
      p.vx *= friction; p.vz *= friction;
    }
  }
  for (const actor of state.actors) {
    actor.diveCooldown = Math.max(0, actor.diveCooldown-dt);
    if (actor.isDiving && (actor.diveTimer -= dt) <= 0) actor.isDiving = false;
  }
  const playerFinishedBefore = p.raceFinished;
  const result = updateRace(state.race, state.actors, dt, state.elapsed);
  if (!playerFinishedBefore && p.raceFinished) {
    const place = result.finished.indexOf(p) + 1;
    state.raceVisuals.celebrateFinish();
    showCelebrationOverlay({
      type: 'qualified',
      icon: '🏁',
      ribbon: state.showMode === 'championship' ? 'BIG FANS • РАУНД 1' : 'BIG FANS • ФИНИШ',
      title: 'ФИНИШ!',
      subtitle: `ТЫ ПРОШЁЛ! Место #${place} из ${result.quota} прошедших!`,
      duration: 3.0
    });
  }
  state.raceVisuals.update();
  for (const actor of state.actors) {
    actor.rig.blobShadow.visible = actor.onGround;
    if (actor.raceFinished && !actor.isPlayer) { actor.rig.root.visible = false; actor.labelEl.style.display = 'none'; }
  }
  updateFX(dt); updateThirdPersonCamera(dt); update3DNameplates(); updateRaceHUD();
  if (result.done && !state.celebrationTimeout) finishRace(result);
}

// ==================== ROLL OUT: SURVIVAL ROUND ====================
function startRollOut(mode = 'single_rollout', qualifiers = null) {
  if (mode === 'single_rollout') state.lastMode = mode;
  startMatch(qualifiers ? {qualifiers} : {largeField:true});
  state.showMode = mode;
  document.querySelector('.brand-pill .pill-title').textContent='ROLL OUT';
  document.querySelector('.layer-pill .pill-label').textContent='КВАЛИФИКАЦИЯ';
  stadiumPillars.forEach(pillar => { pillar.visible = false; });
  slimeSeaMesh.material.color.setHex(0x151c42); slimeSeaMesh.material.emissive.setHex(0x090d25);
  arenaGroup.clear();
  state.layers = [{ index:0, yHeight:0, list:[], map:new Map() }];
  state.rollout = createRollout();
  state.rolloutVisuals = createRolloutVisuals(THREE, state.rollout);
  arenaGroup.add(state.rolloutVisuals.root); state.rolloutVisuals.update();
  state.rolloutQuota = Math.max(1, Math.ceil(state.actors.length * .6));
  state.actors.forEach((actor,i) => {
    actor.x = (((i + 2) % 5)-2)*RING_WIDTH;
    actor.z = (Math.floor(i/5)-1)*1.25;
    actor.y = sampleSurface(state.rollout,actor.x,actor.z)?.y ?? 0; actor.rollNextJump = 4 + i*.37;
    actor.vx=actor.vy=actor.vz=actor.knockVx=actor.knockVz=0;
    actor.onGround=true; actor.currentLayer=0; actor.facing=0; actor.visualFacing=0;
  });
  state.phase='countdown'; state.countdownTimer=3.2; state.elapsed=0;
  state.camYaw=state.targetCamYaw=Math.PI; state.camFocusPos.set(state.player.x,1.2,state.player.z);
  document.getElementById('countdown-badge').textContent = mode === 'championship_rollout' ? 'ROLL OUT • РАУНД 2' : 'ROLL OUT • ТЕСТ';
  document.getElementById('countdown-text').textContent='3';
  document.getElementById('countdown-sub').textContent='Переходите между вращающимися секциями и не падайте!';
  updateRolloutHUD();
}
function updateRolloutHUD() {
  const count=state.actors.filter(a=>a.alive).length;
  document.getElementById('hud-mode-label').textContent = 'ROLL OUT • ВЫЖИВАНИЕ';
  document.getElementById('hud-alive').textContent = `${count} / ${state.actors.length}`;
  document.getElementById('hud-layer').textContent = `${state.rolloutQuota} проходят`;
  document.getElementById('hud-timer').textContent = formatTime(state.elapsed);
}
function finishRollOut() {
  const survivors=state.actors.filter(a=>a.alive);
  const playerAlive = state.player && state.player.alive;
  if (state.showMode==='championship_rollout' && playerAlive) {
    showCelebrationOverlay({
      type: 'qualified',
      icon: '🏁',
      ribbon: 'РАУНД 2 ПРОЙДЕН!',
      title: 'РАУНД ПРОЙДЕН!',
      subtitle: 'ТЫ ПРОШЁЛ! Переход в финал: Jump Showdown...',
      duration: 2.6,
      onComplete: () => {
        startJumpShowdown('championship_showdown', survivors);
      }
    });
    return;
  }
  if (playerAlive) {
    showCelebrationOverlay({
      type: 'qualified',
      icon: '🏁',
      ribbon: 'ROLL OUT • ВЫЖИВАНИЕ',
      title: 'РАУНД ПРОЙДЕН!',
      subtitle: `ТЫ ПРОШЁЛ! Вы удержались на барабанах! Выжило: ${survivors.length}`,
      duration: 2.6,
      onComplete: () => {
        showRollOutResultsModal(survivors);
      }
    });
    return;
  }
  showRollOutResultsModal(survivors);
}

function showRollOutResultsModal(survivors) {
  state.phase='gameover';
  document.getElementById('spectator-bar').classList.add('hidden');
  document.getElementById('result-ribbon').textContent='ROLL OUT • ВЫЖИВАНИЕ';
  document.getElementById('result-title').textContent=state.player.alive?'ВЫ ПРОШЛИ! 🎉':'ВЫ ВЫБЫЛИ';
  document.getElementById('result-subtitle').textContent=`Участников прошло: ${survivors.length} из ${state.actors.length}`;
  document.getElementById('spot-winner-name').textContent=state.player.alive?'Вы удержались!':'Раунд окончен';
  document.getElementById('spot-winner-meta').textContent=`Время: ${formatTime(state.elapsed)}`;
  document.getElementById('res-place').textContent=state.player.alive?'✓':'—';
  document.getElementById('res-time').textContent=formatTime(state.player.survivalTime);
  document.getElementById('res-tiles').textContent='—'; document.getElementById('res-score').textContent='—';
  const list=document.getElementById('match-standings');list.replaceChildren();
  for (const a of survivors) { const row=document.createElement('div');row.className='standing-row';row.textContent=`✓ ${a.name}`;list.appendChild(row); }
  document.getElementById('result-modal').classList.remove('hidden');
}
function updateRollOut(dt) {
  state.elapsed+=dt; advanceRollout(state.rollout,dt); state.rolloutVisuals.update();
  const p=state.player;
  if (p.alive && !p.isDiving) {
    let right=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
    let forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
    if(joystick.active){right+=joystick.dx;forward-=joystick.dy;}
    const len=Math.hypot(right,forward);
    if(len>.05){right/=Math.max(1,len);forward/=Math.max(1,len);
      const dx=-Math.sin(state.camYaw)*forward+Math.cos(state.camYaw)*right;
      const dz=-Math.cos(state.camYaw)*forward-Math.sin(state.camYaw)*right;
      p.facing=Math.atan2(dx,dz);const rate=Math.min(1,dt*(p.onGround?11:6));
      p.vx+=(dx*7.2-p.vx)*rate;p.vz+=(dz*7.2-p.vz)*rate;
    }else{const friction=Math.max(0,1-dt*(p.onGround?10:2.5));p.vx*=friction;p.vz*=friction;}
  }
  for (const a of state.actors) {
    if(!a.alive)continue;
    a.survivalTime=state.elapsed; a.diveCooldown=Math.max(0,a.diveCooldown-dt);
    if(a.isDiving && (a.diveTimer-=dt)<=0)a.isDiving=false;
    if(!a.isPlayer){const d=botDecision(state.rollout,a);const rate=Math.min(1,dt*7);a.vx+=(d.vx-a.vx)*rate;a.vz+=(d.vz-a.vz)*rate;if(d.jump)a.jump();if(Math.hypot(d.vx,d.vz)>.1)a.facing=Math.atan2(d.vx,d.vz);}
    carryRacer(state.rollout,a,dt);
    const oldY=a.y, oldZ=a.z;
    a.x+=(a.vx+a.knockVx)*dt; a.z+=(a.vz+a.knockVz)*dt;
    a.knockVx*=Math.max(0,1-dt*5);a.knockVz*=Math.max(0,1-dt*5);
    a.vy-=30*dt;a.y+=a.vy*dt;
    const surface=sampleSurface(state.rollout,a.x,a.z);a.onGround=false;
    if(surface && a.vy<=0 && oldY>=surface.y-.65 && a.y<=surface.y+.08){a.y=surface.y;a.vy=0;a.onGround=true;a.jumpCount=0;}
    hitWall(surface,a,oldZ);
    a.rig.blobShadow.visible=!!surface && a.y>=surface.y;
    if(a.rig.blobShadow.visible)a.rig.blobShadow.position.y=surface.y-a.y+.03;
    if(a.y < -10){a.alive=false;a.rig.root.visible=false;a.labelEl.style.display='none';state.eliminationOrder.push(a);sfx.play('elim');if(a.isPlayer)onPlayerEliminated();}
  }
  // Gentle contact between contestants on the roller.
  const alive=state.actors.filter(a=>a.alive);
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
    const a=alive[i],b=alive[j];if(Math.abs(a.y-b.y)>1.8)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),min=(a.radius+b.radius)*.8;
    if(d>1e-4 && d<min){const nx=dx/d,nz=dz/d,off=(min-d)*.5;a.x-=nx*off;a.z-=nz*off;b.x+=nx*off;b.z+=nz*off;
      if(a.bumpCooldown<=0 && b.bumpCooldown<=0){a.knockVx-=nx*1.6;a.knockVz-=nz*1.6;b.knockVx+=nx*1.6;b.knockVz+=nz*1.6;a.bumpCooldown=b.bumpCooldown=.25;}}
  }
  for(const a of alive)a.bumpCooldown=Math.max(0,a.bumpCooldown-dt);
  updateFX(dt);updateThirdPersonCamera(dt);update3DNameplates();updateRolloutHUD();
  if(alive.length<=state.rolloutQuota || state.elapsed>=150)finishRollOut();
}

// ==================== SLIME CLIMB TEST RACE ====================
function startSlimeClimb(mode='single_slime', qualifiers=null) {
  if(mode==='single_slime') state.lastMode=mode;
  startMatch(qualifiers?{qualifiers}:{largeField:true});
  state.showMode=mode; state.slimeCourse=createSlimeCourse();
  arenaGroup.clear(); stadiumGroup.visible=false;
  state.slimeVisuals=createSlimeVisuals(THREE,state.slimeCourse);arenaGroup.add(state.slimeVisuals.root);state.slimeVisuals.update();
  state.layers=[{index:0,yHeight:0,list:[],map:new Map()}];
  state.actors.forEach((a,i)=>{a.x=((i%5)-2)*2.2;a.z=-4+Math.floor(i/5)*2;a.y=0;a.vx=a.vy=a.vz=a.knockVx=a.knockVz=0;a.onGround=true;a.climbFinished=false;a.climbHitCooldown=0;a.facing=0;a.visualFacing=0;a.wpIdx=0;});
  state.phase='countdown';state.countdownTimer=3.2;state.elapsed=0;state.camYaw=state.targetCamYaw=Math.PI;
  state.camFocusPos.set(state.player.x,1.2,state.player.z);
  document.querySelector('.brand-pill .pill-title').textContent='SLIME CLIMB';
  document.querySelector('.layer-pill .pill-label').textContent='ФИНИШ';
  document.getElementById('countdown-badge').textContent=mode==='championship_slime'?'SLIME CLIMB • РАУНД 3':'SLIME CLIMB • ТЕСТ';
  document.getElementById('countdown-text').textContent='3';
  document.getElementById('countdown-sub').textContent='Поднимайтесь к финишу раньше слизи!';
  updateSlimeHUD();
}
function updateSlimeHUD(){
 const finished=state.actors.filter(a=>a.climbFinished).length,active=state.actors.filter(a=>a.alive&&!a.climbFinished).length;
 document.getElementById('hud-mode-label').textContent='SLIME CLIMB • ГОНКА';
 document.getElementById('hud-alive').textContent=`${active} / ${state.actors.length}`;
 document.getElementById('hud-layer').textContent=`${finished} финиш`;
 document.getElementById('hud-timer').textContent=formatTime(Math.max(0,SLIME_LIMIT-state.elapsed));
}
function finishSlimeClimb(){
 const finished=state.actors.filter(a=>a.climbFinished).sort((a,b)=>a.climbTime-b.climbTime);
 const playerQualified = state.player && state.player.climbFinished;
 if(state.showMode==='championship_slime' && playerQualified){
   showCelebrationOverlay({
     type: 'qualified',
     icon: '🏆',
     ribbon: 'РАУНД 3 ПРОЙДЕН!',
     title: 'КВАЛИФИЦИРОВАН!',
     subtitle: 'ТЫ В ГРАНД-ФИНАЛЕ! Переход в Jump Showdown...',
     duration: 2.6,
     onComplete: () => {
       startJumpShowdown('championship_showdown', finished);
     }
   });
   return;
 }
 if(playerQualified){
   const place=finished.indexOf(state.player)+1;
   showCelebrationOverlay({
     type: 'qualified',
     icon: '🏆',
     ribbon: 'SLIME CLIMB • ВЕРШИНА',
     title: 'КВАЛИФИЦИРОВАН!',
     subtitle: `ТЫ ПРОШЁЛ! Место #${place} на вершине!`,
     duration: 2.6,
     onComplete: () => {
       showSlimeClimbResultsModal(finished);
     }
   });
   return;
 }
 showSlimeClimbResultsModal(finished);
}

function showSlimeClimbResultsModal(finished) {
 state.phase='gameover';document.getElementById('spectator-bar').classList.add('hidden');
 const place=finished.indexOf(state.player)+1;
 document.getElementById('result-ribbon').textContent='SLIME CLIMB • ГОНКА';
 document.getElementById('result-title').textContent=place?`ФИНИШ! МЕСТО #${place}`:'ВЫ ВЫБЫЛИ';
 document.getElementById('result-subtitle').textContent=`Добрались до финиша: ${finished.length} из ${state.actors.length}`;
 document.getElementById('spot-winner-name').textContent=finished[0]?.name || 'Финиширующих нет';
 document.getElementById('spot-winner-meta').textContent=finished[0]?formatTime(finished[0].climbTime):'Слизь победила';
 document.getElementById('res-place').textContent=place?`#${place}`:'—';
 document.getElementById('res-time').textContent=formatTime(state.player.climbTime||state.player.survivalTime);
 document.getElementById('res-tiles').textContent='—';document.getElementById('res-score').textContent='—';
 const list=document.getElementById('match-standings');list.replaceChildren();
 finished.forEach((a,i)=>{const row=document.createElement('div');row.className='standing-row';row.textContent=`#${i+1} ${a.name} — ${formatTime(a.climbTime)}`;list.appendChild(row);});
 document.getElementById('result-modal').classList.remove('hidden');
}
function updateSlimeClimb(dt){
 state.elapsed+=dt;advanceSlimeCourse(state.slimeCourse,dt,state.actors);state.slimeVisuals.update();
 const p=state.player;
 const playerClimbedBefore = p ? p.climbFinished : false;
 if(p&&p.alive&&!p.climbFinished&&!p.isDiving){
  let right=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0), forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
  if(joystick.active){right+=joystick.dx;forward-=joystick.dy;}
  const len=Math.hypot(right,forward);
  if(len>.05){right/=Math.max(1,len);forward/=Math.max(1,len);const dx=-Math.sin(state.camYaw)*forward+Math.cos(state.camYaw)*right,dz=-Math.cos(state.camYaw)*forward-Math.sin(state.camYaw)*right;p.facing=Math.atan2(dx,dz);const rate=Math.min(1,dt*(p.onGround?11:6));p.vx+=(dx*7.2-p.vx)*rate;p.vz+=(dz*7.2-p.vz)*rate;}
  else{const friction=Math.max(0,1-dt*(p.onGround?8:2.5));p.vx*=friction;p.vz*=friction;}
 }
 const obstacles=slimeObstacles(state.elapsed,state.slimeCourse);
 for(const a of state.actors){
  if(!a.alive||a.climbFinished)continue;
  a.survivalTime=state.elapsed;a.diveCooldown=Math.max(0,a.diveCooldown-dt);a.climbHitCooldown=Math.max(0,a.climbHitCooldown-dt);
  if(a.isDiving&&(a.diveTimer-=dt)<=0)a.isDiving=false;
  if(!a.isPlayer){const d=slimeBotDecision(state.slimeCourse,a);const rate=Math.min(1,dt*8);a.vx+=(d.vx-a.vx)*rate;a.vz+=(d.vz-a.vz)*rate;if(d.jump)a.jump();a.facing=Math.atan2(d.vx,d.vz);}
  const oldY=a.y;a.x+=(a.vx+a.knockVx)*dt;a.z+=(a.vz+a.knockVz)*dt;

  // Requirement 5: Rotating Cylinders (Brevna) tangential sideways carry
  if(a.onGround&&a.x>=0.0&&a.x<=14.0&&a.y>=11.5&&a.y<=13.0){
    if(Math.abs(a.z-61.5)<1.0)a.z+=1.9*dt;
    else if(Math.abs(a.z-64.5)<1.0)a.z-=1.9*dt;
  }
  // Conveyor belt zone on Floor 3 (drags backward if on belt)
  if(a.onGround&&a.y>=14.0&&a.y<=17.5&&a.x>=-12.5&&a.x<=-2.0){a.x+=2.4*dt;a.z-=1.4*dt;}

  a.knockVx*=Math.max(0,1-dt*4);a.knockVz*=Math.max(0,1-dt*4);a.vy-=30*dt;a.y+=a.vy*dt;
  const floor=slimeSurface(a.x,a.z,a.y);a.onGround=false;
  if(floor!==null&&a.vy<=0&&oldY>=floor-1.5&&a.y<=floor+0.35){a.y=floor;a.vy=0;a.onGround=true;a.jumpCount=0;}
  else if(floor!==null&&oldY>=floor-1.5&&a.y<floor){a.y=floor;a.vy=0;a.onGround=true;a.jumpCount=0;}

  // Obstacle collisions with solid body pushout
  for(const o of obstacles){
    if(o.type==='bumper_tri'){
      // Requirement 1: Solid glossy triangular bumper - cannot walk through, bouncy pushout
      const dx=a.x-o.x,dz=a.z-o.z,d=Math.hypot(dx,dz),r=o.radius+a.radius;
      if(d<r&&Math.abs(a.y-o.y)<2.0&&d>.001){
        const nx=dx/d,nz=dz/d;
        a.x=o.x+nx*r;a.z=o.z+nz*r;
        if(a.climbHitCooldown<=0){
          a.knockVx=nx*12.0;a.knockVz=nz*12.0;a.vy=4.2;a.onGround=false;
          a.squash=.35;a.climbHitCooldown=.25;sfx.play('hit');
        }
      }
    } else if(o.type==='pusher_box'){
      // Requirement 3: Snappy pusher with pixel-perfect AABB pushout
      if(Math.abs(a.y-o.y)<2.2&&a.z>=o.zMin-a.radius&&a.z<=o.zMax+a.radius){
        if(a.x<o.xMax+a.radius){
          a.x=Math.max(a.x,o.xMax+a.radius+0.04);
          a.knockVx=Math.max(a.knockVx,12.5);a.vy=2.2;a.onGround=false;a.squash=.25;
          if(a.climbHitCooldown<=0){sfx.play('hit');a.climbHitCooldown=.2;}
        }
      }
    } else if(o.type==='hammer_dynamic'){
      // Requirement 6: Fast spinning hammers with instant swat
      let hit=false;
      for(const head of [o.head1,o.head2]){
        const dh=Math.hypot(a.x-head.x,a.z-head.z),rHead=o.headRadius+a.radius;
        if(dh<rHead&&Math.abs(a.y-o.y)<2.2){
          const nhx=(a.x-head.x)/(dh||1),nhz=(a.z-head.z)/(dh||1);
          a.x=head.x+nhx*rHead;a.z=head.z+nhz*rHead;
          const tangX=-Math.sin(o.angle)*16.0,tangZ=Math.cos(o.angle)*16.0;
          a.knockVx=tangX*1.3+nhx*6.0;a.knockVz=tangZ*1.3+nhz*6.0;
          a.vy=4.6;a.onGround=false;a.squash=.4;
          sfx.play('hit');a.climbHitCooldown=.25;hit=true;break;
        }
      }
      if(!hit){
        const along=(a.x-o.x)*Math.cos(o.angle)+(a.z-o.z)*Math.sin(o.angle);
        if(Math.abs(along)<o.armLen&&Math.abs(a.y-o.y)<1.8){
          const perpX=a.x-(o.x+Math.cos(o.angle)*along),perpZ=a.z-(o.z+Math.sin(o.angle)*along);
          const dPerp=Math.hypot(perpX,perpZ);
          if(dPerp<0.6+a.radius){
            const tangX=-Math.sin(o.angle)*13.0,tangZ=Math.cos(o.angle)*13.0;
            a.knockVx=tangX;a.knockVz=tangZ;a.vy=3.6;a.onGround=false;
            sfx.play('hit');a.climbHitCooldown=.25;
          }
        }
      }
    } else if(o.type==='ball'&&o.isGiant){
      // Requirement 4: The Giant Rolling Boulder
      const dx=a.x-o.x,dz=a.z-o.z,d=Math.hypot(dx,dz),r=o.radius+a.radius;
      if(d<r&&Math.abs(a.y-o.y)<2.8&&d>.001){
        const nx=dx/d,nz=dz/d;
        a.x=o.x+nx*r;a.z=o.z+nz*r;
        a.knockVx=nx*14.0-4.0;a.knockVz=nz*14.0-4.0;a.vy=4.8;a.onGround=false;
        a.squash=.45;a.climbHitCooldown=.4;sfx.play('hit');
      }
    } else {
      const obsY=o.y!==undefined?o.y:slimeCourseY(o.z);
      if(Math.abs(a.y-obsY)<2.4){
        const {dx,dz}=slimeObstacleContact(o,a.x,a.z),d=Math.hypot(dx,dz),radius=o.radius+a.radius*.55;
        if(d<radius&&d>.001&&a.climbHitCooldown<=0){
          const nx=dx/d,nz=dz/d;a.x+=nx*(radius-d);a.z+=nz*(radius-d);
          a.knockVx=nx*(o.type==='pusher'?9:5.5);a.knockVz=nz*(o.type==='pusher'?9:5.5);
          a.vy=3.2;a.onGround=false;a.climbHitCooldown=.3;a.squash=.2;
        }
      }
    }
  }

  a.rig.blobShadow.visible=floor!==null&&a.y>=floor;if(a.rig.blobShadow.visible)a.rig.blobShadow.position.y=floor-a.y+.03;
  if(a.z>=120&&Math.abs(a.x)<8.5&&a.y>=25.0){a.climbFinished=true;a.climbTime=state.elapsed;a.vx=a.vz=0;if(!a.isPlayer){a.rig.root.visible=false;a.labelEl.style.display='none';}}
  else if(a.y<=risingSlimeY(state.elapsed)||a.y< -20){a.alive=false;a.rig.root.visible=false;a.labelEl.style.display='none';state.eliminationOrder.push(a);sfx.play('elim');if(a.isPlayer)onPlayerEliminated();}
 }

 if (!playerClimbedBefore && p && p.climbFinished) {
   const place = state.actors.filter(a => a.climbFinished).length;
   showCelebrationOverlay({
     type: 'qualified',
     icon: '🏆',
     ribbon: state.showMode === 'championship_slime' ? 'SLIME CLIMB • РАУНД 3' : 'SLIME CLIMB • ВЕРШИНА',
     title: 'КВАЛИФИЦИРОВАН!',
     subtitle: `ТЫ ПРОШЁЛ! Место #${place}! Вы обогнали розовую слизь!`,
     duration: 3.0
   });
 }

 const active=state.actors.filter(a=>a.alive&&!a.climbFinished);
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j];if(Math.abs(a.y-b.y)>1.8)continue;const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),min=(a.radius+b.radius)*.8;
  if(d>1e-4&&d<min){const nx=dx/d,nz=dz/d,off=(min-d)*.5;a.x-=nx*off;a.z-=nz*off;b.x+=nx*off;b.z+=nz*off;if(a.bumpCooldown<=0&&b.bumpCooldown<=0){a.knockVx-=nx*1.5;a.knockVz-=nz*1.5;b.knockVx+=nx*1.5;b.knockVz+=nz*1.5;a.bumpCooldown=b.bumpCooldown=.25;}}
 }
 for(const a of active)a.bumpCooldown=Math.max(0,a.bumpCooldown-dt);
 updateFX(dt);updateThirdPersonCamera(dt);update3DNameplates();updateSlimeHUD();
 if(!active.length||state.elapsed>=SLIME_LIMIT)finishSlimeClimb();
}

// ==================== JUMP SHOWDOWN: GRAND FINAL ====================
function startJumpShowdown(mode = 'single_showdown', qualifiers = null) {
  if (mode === 'single_showdown') state.lastMode = mode;
  startMatch(qualifiers ? { qualifiers } : { largeField: true });
  state.showMode = mode;
  document.querySelector('.brand-pill .pill-title').textContent = 'JUMP SHOWDOWN';
  document.querySelector('.layer-pill .pill-label').textContent = 'ФИНАЛ';
  stadiumPillars.forEach(pillar => { pillar.visible = true; });
  slimeSeaMesh.material.color.setHex(0xff2a85);
  slimeSeaMesh.material.emissive.setHex(0xc80055);

  arenaGroup.clear();
  stadiumGroup.visible = false;
  state.layers = [{ index: 0, yHeight: 0, list: [], map: new Map() }];

  state.showdown = createShowdown();
  state.showdownVisuals = createShowdownVisuals(THREE, state.showdown);
  arenaGroup.add(state.showdownVisuals.root);
  state.showdownVisuals.update();

  state.actors.forEach((actor, i) => {
    const secIdx = i % 8;
    const midAngle = state.showdown.sectors[secIdx].angleMid;
    const r = 8.5 + (Math.floor(i / 8) % 2) * 2.5;
    actor.x = Math.cos(midAngle) * r;
    actor.z = Math.sin(midAngle) * r;
    actor.y = 0;
    actor.vx = actor.vy = actor.vz = actor.knockVx = actor.knockVz = 0;
    actor.onGround = true;
    actor.currentLayer = 0;
    actor.facing = midAngle + Math.PI;
    actor.visualFacing = actor.facing;
    actor.sweeperHitCooldown = 0;
  });

  state.phase = 'countdown';
  state.countdownTimer = 3.2;
  state.elapsed = 0;
  state.camYaw = state.targetCamYaw = state.player.facing + Math.PI;
  state.camFocusPos.set(state.player.x, 1.2, state.player.z);

  document.getElementById('countdown-badge').textContent = mode === 'championship_showdown' ? 'JUMP SHOWDOWN • ГРАНД-ФИНАЛ' : 'JUMP SHOWDOWN • ФИНАЛ';
  document.getElementById('countdown-text').textContent = '3';
  document.getElementById('countdown-sub').textContent = 'Перепрыгивайте валики и не оставайтесь на падающих секциях!';
  updateShowdownHUD();
}

function updateShowdownHUD() {
  const active = state.actors.filter(a => a.alive).length;
  const remainingSectors = state.showdown ? state.showdown.sectors.filter(s => s.state !== 'dropped').length : 8;
  document.getElementById('hud-mode-label').textContent = 'JUMP SHOWDOWN • ФИНАЛ';
  document.getElementById('hud-alive').textContent = `${active} / ${state.actors.length}`;
  document.getElementById('hud-layer').textContent = `${remainingSectors} секторов`;
  document.getElementById('hud-timer').textContent = formatTime(state.elapsed);
}

function updateJumpShowdown(dt) {
  state.elapsed += dt;
  advanceShowdown(state.showdown, dt);
  state.showdownVisuals.update();

  const p = state.player;
  if (p && p.alive && !p.isDiving) {
    let right = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    if (joystick.active) { right += joystick.dx; forward -= joystick.dy; }
    const len = Math.hypot(right, forward);
    if (len > 0.05) {
      right /= Math.max(1, len); forward /= Math.max(1, len);
      const dx = -Math.sin(state.camYaw) * forward + Math.cos(state.camYaw) * right;
      const dz = -Math.cos(state.camYaw) * forward - Math.sin(state.camYaw) * right;
      p.facing = Math.atan2(dx, dz);
      const rate = Math.min(1, dt * (p.onGround ? 11 : 6));
      p.vx += (dx * 7.2 - p.vx) * rate;
      p.vz += (dz * 7.2 - p.vz) * rate;
    } else {
      const friction = Math.max(0, 1 - dt * (p.onGround ? 10 : 2.5));
      p.vx *= friction;
      p.vz *= friction;
    }
  }

  for (const a of state.actors) {
    if (!a.alive) continue;
    a.survivalTime = state.elapsed;
    a.diveCooldown = Math.max(0, a.diveCooldown - dt);
    a.sweeperHitCooldown = Math.max(0, (a.sweeperHitCooldown || 0) - dt);
    if (a.isDiving && (a.diveTimer -= dt) <= 0) a.isDiving = false;

    if (!a.isPlayer) {
      const d = showdownBotDecision(state.showdown, a);
      const rate = Math.min(1, dt * 8);
      a.vx += (d.vx - a.vx) * rate;
      a.vz += (d.vz - a.vz) * rate;
      if (d.jump) a.jump();
      if (Math.hypot(d.vx, d.vz) > 0.1) a.facing = Math.atan2(d.vx, d.vz);
    }

    const oldY = a.y;
    a.x += (a.vx + a.knockVx) * dt;
    a.z += (a.vz + a.knockVz) * dt;
    a.knockVx *= Math.max(0, 1 - dt * 4.5);
    a.knockVz *= Math.max(0, 1 - dt * 4.5);
    a.vy -= 30 * dt;
    a.y += a.vy * dt;

    // Floor surface collision (with gap detection)
    const surf = showdownSurface(state.showdown, a.x, a.z);
    a.onGround = false;
    if (surf && a.vy <= 0 && oldY >= surf.y - 0.75 && a.y <= surf.y + 0.35) {
      a.y = surf.y;
      a.vy = 0;
      a.onGround = true;
      a.jumpCount = 0;
    } else if (surf && oldY >= surf.y - 0.75 && a.y < surf.y) {
      a.y = surf.y;
      a.vy = 0;
      a.onGround = true;
      a.jumpCount = 0;
    }

    // Sweeper collision check
    if (a.sweeperHitCooldown <= 0) {
      const hit = showdownSweeperHit(state.showdown, a);
      if (hit) {
        a.knockVx = hit.knockVx;
        a.knockVz = hit.knockVz;
        a.vy = Math.max(a.vy, hit.vy);
        a.onGround = false;
        a.squash = hit.squash;
        a.sweeperHitCooldown = 0.35;
        sfx.play('hit');
        spawnParticles3D(a.x, a.y + 0.8, a.z, hit.bar === 'low' ? 0x00e676 : 0x2979ff, 12);
      }
    }

    // Shadow projection
    a.rig.blobShadow.visible = surf !== null && a.y >= surf.y;
    if (a.rig.blobShadow.visible) {
      a.rig.blobShadow.position.y = (surf.y - a.y) + 0.03;
    }

    // Fall into slime ocean
    if (a.y < -14.0) {
      a.alive = false;
      a.rig.root.visible = false;
      a.labelEl.style.display = 'none';
      state.eliminationOrder.push(a);
      sfx.play('elim');
      spawnParticles3D(a.x, -14.0 + 0.5, a.z, 0xff2a85, 20);
      if (a.isPlayer) onPlayerEliminated();
    }
  }

  // Beans bump physics
  const alive = state.actors.filter(a => a.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (Math.abs(a.y - b.y) > 1.8) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      const minDist = (a.radius + b.radius) * 0.85;
      if (dist > 1e-4 && dist < minDist) {
        const nx = dx / dist, nz = dz / dist;
        const off = (minDist - dist) * 0.5;
        a.x -= nx * off; a.z -= nz * off;
        b.x += nx * off; b.z += nz * off;
        if (a.bumpCooldown <= 0 && b.bumpCooldown <= 0) {
          a.knockVx -= nx * 1.8; a.knockVz -= nz * 1.8;
          b.knockVx += nx * 1.8; b.knockVz += nz * 1.8;
          a.bumpCooldown = b.bumpCooldown = 0.25;
        }
      }
    }
  }
  for (const a of alive) a.bumpCooldown = Math.max(0, a.bumpCooldown - dt);

  updateFX(dt);
  updateThirdPersonCamera(dt);
  update3DNameplates();
  updateShowdownHUD();

  // Jump Showdown is a FINAL: when <= 1 alive or time reaches LIMIT, end round!
  if (alive.length <= 1 || state.elapsed >= SHOWDOWN_LIMIT) {
    finishJumpShowdown(alive[0] || state.eliminationOrder[state.eliminationOrder.length - 1]);
  }
}

function finishJumpShowdown(winner) {
  state.matchWinner = winner;
  triggerWinnerCelebration(winner);
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

const sharedParticleGeo = new THREE.SphereGeometry(0.16, 10, 8);
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

// ==================== УМНЫЙ ИИ БОТОВ В 3D (HEX-A-GONE) ====================
function updateBotAI3D(bot, dt, config) {
  bot.aiRetargetTimer -= dt;
  const currentLayerIdx = Math.min(state.layers.length - 1, Math.max(0, bot.currentLayer));
  const layer = state.layers[currentLayerIdx] || state.layers[state.layers.length - 1];
  const curAx = worldXZToAxial(bot.x, bot.z);
  const curTile = layer ? layer.map.get(`${curAx.q},${curAx.r}`) : null;

  const urgent = !curTile || curTile.status === 'falling' || curTile.status === 'waiting' ||
    (curTile.status === 'stepped' && curTile.timer < config.stepHoldTime * 0.65);

  if (bot.aiRetargetTimer <= 0 || urgent || !bot.aiTargetTile ||
      bot.aiTargetTile.status === 'falling' || bot.aiTargetTile.status === 'waiting') {
    bot.aiRetargetTimer = 0.20 + (1 - config.botIQ) * 0.22;

    let bestTile = null;
    let bestScore = -9999;

    // Сначала ищем в ближнем радиусе 2, если все соты вокруг разрушены — расширяем до 4
    for (const searchRadius of [2, 4]) {
      for (let dq = -searchRadius; dq <= searchRadius; dq++) {
        for (let dr = Math.max(-searchRadius, -dq - searchRadius); dr <= Math.min(searchRadius, -dq + searchRadius); dr++) {
          const hDist = hexDistance(0, 0, dq, dr);
          if (hDist === 0) continue;
          const candidate = layer.map.get(`${curAx.q + dq},${curAx.r + dr}`);
          if (!candidate) continue;
          if (candidate.status !== 'solid' && candidate.status !== 'restoring') continue;

          let solidNeighbors = 0;
          const nDirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
          for (const [nq, nr] of nDirs) {
            const nb = layer.map.get(`${candidate.q + nq},${candidate.r + nr}`);
            if (nb && (nb.status === 'solid' || nb.status === 'restoring')) solidNeighbors++;
          }

          let score = solidNeighbors * 14;
          if (hDist === 1) score += 24;
          else if (hDist === 2) score += 12;
          else score -= (hDist - 2) * 8;

          if (candidate.specialType === 'gold') score += 20;
          if (candidate.specialType === 'spring') score += 8;
          if (candidate.specialType === 'bomb') score -= 28;

          const centerDist = hexDistance(0, 0, candidate.q, candidate.r);
          score -= centerDist * 1.8;
          score += (Math.random() - 0.5) * (1.1 - config.botIQ) * 26;

          if (score > bestScore) {
            bestScore = score;
            bestTile = candidate;
          }
        }
      }
      if (bestTile) break;
    }

    // Если на текущем ярусе вокруг все соты выбиты — смотрим на ярус НИЖЕ и направляемся к островку!
    if (!bestTile && currentLayerIdx < state.layers.length - 1) {
      const lowerLayer = state.layers[currentLayerIdx + 1];
      let bestLowerTile = null;
      let maxLowerCluster = -1;
      for (let dq = -3; dq <= 3; dq++) {
        for (let dr = Math.max(-3, -dq - 3); dr <= Math.min(3, -dq + 3); dr++) {
          const cand = lowerLayer.map.get(`${curAx.q + dq},${curAx.r + dr}`);
          if (cand && cand.status === 'solid') {
            let nCnt = 0;
            for (const [nq, nr] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]) {
              const nb = lowerLayer.map.get(`${cand.q + nq},${cand.r + nr}`);
              if (nb && nb.status === 'solid') nCnt++;
            }
            if (nCnt > maxLowerCluster) {
              maxLowerCluster = nCnt;
              bestLowerTile = cand;
            }
          }
        }
      }
      if (bestLowerTile) bestTile = bestLowerTile;
    }

    bot.aiTargetTile = bestTile;
  }

  if (bot.aiTargetTile) {
    const dx = bot.aiTargetTile.x - bot.x;
    const dz = bot.aiTargetTile.z - bot.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.25) {
      bot.facing = Math.atan2(dx, dz);

      // Тактика Fall Guys: если сота еще целая и безопасная, фасолька медленно держит позицию
      const isSafeTile = curTile && curTile.status === 'solid' && dist < HEX_RADIUS * 0.9;
      const speedMult = isSafeTile ? 0.35 : 1.0;
      const baseSpeed = 7.0 * speedMult * (bot.buffs.speed > 0 ? 1.35 : 1.0);

      const desiredVx = (dx / dist) * baseSpeed;
      const desiredVz = (dz / dist) * baseSpeed;

      bot.vx += (desiredVx - bot.vx) * Math.min(1, dt * 9);
      bot.vz += (desiredVz - bot.vz) * Math.min(1, dt * 9);

      // Прыжок при переходе на следующую соту или при разрушении текущей соты
      if (bot.onGround && (dist > HEX_RADIUS * 1.3 || !curTile || curTile.status === 'falling' || (curTile.status === 'stepped' && curTile.timer < config.stepHoldTime * 0.45))) {
        if (Math.random() < 0.45 + config.botIQ * 0.52) {
          bot.jump();
        }
      } else if (!bot.onGround && dist > 2.6 && bot.vy < 0 && bot.diveCooldown <= 0) {
        // Нырок рыбкой вперёд при длинном прыжке
        if (Math.random() < config.botIQ * 0.6) {
          bot.dive();
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

  if (state.showdown) { updateJumpShowdown(dt * (state.player && !state.player.alive ? state.spectateSpeed : 1)); return; }
  if (state.slimeCourse) { updateSlimeClimb(dt * (state.player && !state.player.alive ? state.spectateSpeed : 1)); return; }
  if (state.rollout) { updateRollOut(dt * (state.player && !state.player.alive ? state.spectateSpeed : 1)); return; }
  if (state.race) { updateBigFans(dt); return; }

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
    if (actor.bumpCooldown > 0) actor.bumpCooldown = Math.max(0, actor.bumpCooldown - simDt);
    if (actor.isDiving) {
      actor.diveTimer -= simDt;
      if (actor.diveTimer <= 0) actor.isDiving = false;
    }

    if (!actor.isPlayer) {
      updateBotAI3D(actor, simDt, state.config);
    }

    const prevY = actor.y;
    const wasOnGround = actor.onGround;

    // Плавное затухание импульса отталкивания от столкновений с другими фасольками
    const knockDecay = Math.max(0, 1 - simDt * 5.2);
    actor.knockVx *= knockDecay;
    actor.knockVz *= knockDecay;

    actor.x += (actor.vx + actor.knockVx) * simDt;
    actor.z += (actor.vz + actor.knockVz) * simDt;

    const gravity = actor.buffs.feather > 0 && actor.vy < 0 ? 23.5 : 30.0;
    actor.vy -= gravity * simDt;
    actor.y += actor.vy * simDt;

    actor.onGround = false;

    // Непрерывный Sweep-тест по всем ярусам сверху вниз
    let shadowPlaced = false;
    for (const layer of state.layers) {
      const supportTile = findSupportingTileOnLayer(layer, actor.x, actor.z, actor.radius);
      const surfaceY = supportTile ? (layer.yHeight + supportTile.offsetY) : layer.yHeight;

      // Непрерывный Sweep по траектории от prevY к actor.y (никто никогда не проваливается сквозь полигон!)
      const passedSurface = (prevY >= surfaceY - 0.22 && actor.y <= surfaceY + 0.32 && actor.y >= surfaceY - 1.5);
      if (supportTile && actor.vy <= 0 && passedSurface) {
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
        actor.y = bottomLayer.yHeight + 3.5;
        actor.vy = 16.5;
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

  // ЧЕСТНАЯ ФИЗИЧЕСКАЯ КОЛЛИЗИЯ И УПРУГОЕ ОТТАЛКИВАНИЕ ПРИ СТОЛКНОВЕНИИ 2 ФАСОЛЕК!
  const aliveList = state.actors.filter(a => a.alive);
  for (let i = 0; i < aliveList.length; i++) {
    for (let j = i + 1; j < aliveList.length; j++) {
      const a = aliveList[i];
      const b = aliveList[j];
      if (Math.abs(a.y - b.y) < 2.1) {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minDist = a.radius + b.radius; // 1.60 м — плотный контакт корпусов
        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) * 0.54;
          const nx = dx / dist;
          const nz = dz / dist;

          // Выталкиваем фасолек друг из друга, чтобы никогда не проходили сквозь модели
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;

          // Если оба ещё не в кулдауне бампа — даём ощутимый упругий импульс отскока животиками!
          if (a.bumpCooldown <= 0 || b.bumpCooldown <= 0) {
            const aDiveBoost = a.isDiving ? 14.5 : 7.8;
            const bDiveBoost = b.isDiving ? 14.5 : 7.8;

            a.knockVx = -nx * bDiveBoost;
            a.knockVz = -nz * bDiveBoost;
            b.knockVx = nx * aDiveBoost;
            b.knockVz = nz * aDiveBoost;

            // Небольшой вертикальный подскок и сплющивание при ударе плечом/животиком
            if (a.onGround) a.vy = Math.max(a.vy, 3.6);
            if (b.onGround) b.vy = Math.max(b.vy, 3.6);
            a.squash = 0.28;
            b.squash = 0.28;

            a.bumpCooldown = 0.26;
            b.bumpCooldown = 0.26;

            // Искры в точке столкновения и упругий звук "Boing!"
            const midX = (a.x + b.x) * 0.5;
            const midY = Math.max(a.y, b.y) + 1.1;
            const midZ = (a.z + b.z) * 0.5;
            spawnParticles3D(midX, midY, midZ, 0xffe600, 6);
            if (a.isPlayer || b.isPlayer) {
              sfx.play('bump');
            }
          }
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
        state.rollout ? `Смотрим за: ${focusActor.name}` : `Смотрим за: ${focusActor.name} (Ярус ${focusActor.currentLayer + 1})`;
    }
  }

  if (focusActor) {
    // По горизонтали следим быстро, а по вертикали во время прыжка плавно, чтобы камера не дёргалась вверх под потолок
    const targetX = focusActor.x;
    const targetZ = focusActor.z;
    const baseLayerY = state.slimeCourse ? focusActor.y : state.layers[focusActor.currentLayer]
      ? state.layers[focusActor.currentLayer].yHeight
      : focusActor.y;
    const jumpDeltaY = Math.max(-4, Math.min(3.2, focusActor.y - baseLayerY));
    const targetY = baseLayerY + jumpDeltaY * 0.55 + 1.35;

    state.camFocusPos.x += (targetX - state.camFocusPos.x) * Math.min(1, dt * 10);
    state.camFocusPos.z += (targetZ - state.camFocusPos.z) * Math.min(1, dt * 10);
    state.camFocusPos.y += (targetY - state.camFocusPos.y) * Math.min(1, dt * 7);
  }

  const dist = state.phase === 'celebrating' ? 9.5 : state.camDist;
  let height = state.phase === 'celebrating' ? 4.2 : state.camHeight + state.camPitchOffset;

  const camX = state.camFocusPos.x + Math.sin(state.camYaw) * dist;
  let camY = state.camFocusPos.y + Math.max(2.5, height);
  const camZ = state.camFocusPos.z + Math.cos(state.camYaw) * dist;

  // Защита от перекрытия верхним ярусом: если над персонажем есть верхний этаж, держим камеру ниже его плиток!
  if (focusActor && focusActor.currentLayer > 0) {
    const upperLayer = state.layers[focusActor.currentLayer - 1];
    if (upperLayer) {
      const maxAllowedCamY = upperLayer.yHeight - 1.8;
      if (camY > maxAllowedCamY) {
        camY = Math.max(state.camFocusPos.y + 2.4, maxAllowedCamY);
      }
    }
  }

  camera.position.set(camX, camY, camZ);
  camera.lookAt(state.camFocusPos.x, state.camFocusPos.y + 0.25, state.camFocusPos.z);
}

// Проекция 3D координат макушки каждой фасолинки в 2D экранные координаты для чётких смешных ников
const tempProjVec = new THREE.Vector3();
function update3DNameplates() {
  if (saveData.showNameplates === false) return;
  const halfW = window.innerWidth * 0.5;
  const halfH = window.innerHeight * 0.5;

  for (const actor of state.actors) {
    if (!actor.alive || (!actor.isPlayer && (actor.climbFinished || actor.raceFinished))) {
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

// ==================== ЭФФЕКТЫ КОНФЕТТИ И ПРАЗДНОВАНИЯ ФИНИША ====================
function launchScreenConfetti(type = 'champion') {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9998',
    overflow: 'hidden'
  });
  document.body.appendChild(container);

  const colors = type === 'champion'
    ? ['#ffe600', '#ffd700', '#ff2a85', '#00e5ff', '#ffffff', '#ff9100']
    : ['#00e5ff', '#7b35d1', '#ffe600', '#ff2a85', '#00e676', '#ffffff'];

  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    const color = colors[i % colors.length];
    const left = Math.random() * 100;
    const size = 9 + Math.random() * 12;
    const duration = 1.9 + Math.random() * 1.3;
    const delay = Math.random() * 0.35;
    const rot = Math.random() * 360;

    Object.assign(piece.style, {
      position: 'absolute',
      left: `${left}%`,
      top: '-25px',
      width: `${size}px`,
      height: `${size * 0.62}px`,
      backgroundColor: color,
      borderRadius: '3px',
      transform: `rotate(${rot}deg)`,
      animation: `fallConfetti ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s forwards`,
      boxShadow: `0 0 8px ${color}`
    });
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 3600);
}

function showCelebrationOverlay({ type = 'champion', icon = '👑', ribbon = '', title = '', subtitle = '', duration = 3.0, onComplete = null } = {}) {
  const overlay = document.getElementById('winner-banner-overlay');
  const card = document.getElementById('winner-plashka-card');
  const iconEl = document.getElementById('winner-crown-anim');
  const ribbonEl = document.getElementById('winner-plashka-ribbon');
  const nameEl = document.getElementById('winner-plashka-name');
  const subEl = document.getElementById('winner-plashka-sub');

  if (card) {
    card.className = `winner-plashka is-${type}`;
  }
  if (iconEl) iconEl.textContent = icon;
  if (ribbonEl) ribbonEl.textContent = ribbon;
  if (nameEl) nameEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;

  overlay.classList.remove('hidden');
  sfx.play(type === 'eliminated' ? 'elim' : 'win');

  // Запуск 3D-фейерверка вокруг персонажа
  const actor = state.player || state.matchWinner;
  const px = actor ? actor.x : 0;
  const py = actor ? actor.y + 1.5 : 5;
  const pz = actor ? actor.z : 0;
  const cols = type === 'champion'
    ? [0xffe600, 0xffd700, 0xff9100, 0xff2a85, 0xffffff]
    : [0x00e5ff, 0x7b35d1, 0xff2a85, 0x00e676, 0xffffff];

  for (let i = 0; i < 40; i++) {
    spawnParticles3D(px + (Math.random() - 0.5) * 3.5, py + Math.random() * 2, pz + (Math.random() - 0.5) * 3.5, cols[i % cols.length], 2);
  }

  // Запуск экранного праздничного конфетти
  launchScreenConfetti(type);

  if (state.celebrationTimeout) clearTimeout(state.celebrationTimeout);
  state.celebrationTimeout = setTimeout(() => {
    state.celebrationTimeout = null;
    overlay.classList.add('hidden');
    if (onComplete) onComplete();
  }, duration * 1000);
}

function triggerWinnerCelebration(winner) {
  if (state.phase === 'celebrating' || state.phase === 'gameover') return;
  state.phase = 'celebrating';
  state.celebrationTimer = 3.6;
  state.matchWinner = winner;

  document.getElementById('spectator-bar').classList.add('hidden');

  const isPlayerWin = winner && winner.isPlayer;

  showCelebrationOverlay({
    type: 'champion',
    icon: '👑',
    ribbon: isPlayerWin ? '🏆 ПОБЕДИТЕЛЬ ТЕЛЕШОУ' : '🏁 ФИНАЛ ОКОНЧЕН',
    title: 'ЧЕМПИОН!',
    subtitle: isPlayerWin
      ? 'ПОБЕДА В ШОУ! ЗОЛОТАЯ КОРОНА ВАША! 👑'
      : `${winner ? winner.name : 'Бот'} становится чемпионом и забирает Корону! 👑`,
    duration: 3.4,
    onComplete: () => {
      showFinalResultsModal();
    }
  });
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

// Проверка доступности цвета, паттерна или костюма
function isColorUnlocked(col) {
  if (col.unlockType === 'free') return true;
  if (col.unlockType === 'crowns' && saveData.crowns >= col.cost) return true;
  return saveData.unlockedColors.includes(col.id);
}

function isPatternUnlocked(pat) {
  if (pat.unlockType === 'free') return true;
  if (pat.unlockType === 'crowns' && saveData.crowns >= pat.cost) return true;
  return (saveData.unlockedPatterns || []).includes(pat.id);
}

function isCostumeUnlocked(cos) {
  if (cos.unlockType === 'free') return true;
  if (cos.unlockType === 'crowns' && saveData.crowns >= cos.cost) return true;
  return saveData.unlockedCostumes.includes(cos.id);
}

function getUnlockBadgeText(item, unlocked) {
  if (unlocked) return '✓ Открыто';
  if (item.unlockType === 'ad') return '📺 За рекламу';
  if (item.unlockType === 'crowns') return `👑 За ${item.cost} побед(ы)`;
  if (item.unlockType === 'kudos') return `🟣 ${item.cost} Лавров`;
  return 'Закрыто';
}

function applyColorWithDefaultPattern(col) {
  saveData.selectedColorId = col.id;
  if (col.defaultPat) {
    const patObj = PATTERN_ITEMS.find(p => p.id === col.defaultPat);
    if (patObj && isPatternUnlocked(patObj)) {
      saveData.selectedPatternId = patObj.id;
    }
  }
}

function handleSelectOrUnlockColor(col) {
  if (isColorUnlocked(col)) {
    applyColorWithDefaultPattern(col);
    saveGameData();
    sfx.play('step');
    rebuildLobbyBeanModel();
    renderAllLobbyPanels();
    return;
  }

  if (col.unlockType === 'ad') {
    watchRewardedAd(`ОТКРЫВАЕМ РАСЦВЕТКУ: ${col.title}`, () => {
      if (!saveData.unlockedColors.includes(col.id)) saveData.unlockedColors.push(col.id);
      if (col.defaultPat && !saveData.unlockedPatterns.includes(col.defaultPat)) {
        saveData.unlockedPatterns.push(col.defaultPat);
      }
      applyColorWithDefaultPattern(col);
      saveGameData();
      rebuildLobbyBeanModel();
      renderAllLobbyPanels();
    });
  } else if (col.unlockType === 'kudos') {
    if ((saveData.kudos || 0) >= col.cost) {
      saveData.kudos -= col.cost;
      saveData.unlockedColors.push(col.id);
      if (col.defaultPat && !saveData.unlockedPatterns.includes(col.defaultPat)) {
        saveData.unlockedPatterns.push(col.defaultPat);
      }
      applyColorWithDefaultPattern(col);
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

function handleSelectOrUnlockPattern(pat) {
  if (isPatternUnlocked(pat)) {
    saveData.selectedPatternId = pat.id;
    saveGameData();
    sfx.play('step');
    rebuildLobbyBeanModel();
    renderAllLobbyPanels();
    return;
  }

  if (pat.unlockType === 'ad') {
    watchRewardedAd(`ОТКРЫВАЕМ ПАТТЕРН: ${pat.title}`, () => {
      if (!saveData.unlockedPatterns.includes(pat.id)) saveData.unlockedPatterns.push(pat.id);
      saveData.selectedPatternId = pat.id;
      saveGameData();
      rebuildLobbyBeanModel();
      renderAllLobbyPanels();
    });
  } else if (pat.unlockType === 'kudos') {
    if ((saveData.kudos || 0) >= pat.cost) {
      saveData.kudos -= pat.cost;
      saveData.unlockedPatterns.push(pat.id);
      saveData.selectedPatternId = pat.id;
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
    watchRewardedAd(`ОТКРЫВАЕМ ПОЛНЫЙ КОСТЮМ: ${cos.title}`, () => {
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

  // Обновляем кнопки выбора 1 или 2 глаз в маске Миньона
  const btnEyes2 = document.getElementById('btn-eyes-2');
  const btnEyes1 = document.getElementById('btn-eyes-1');
  if (btnEyes2 && btnEyes1) {
    const isOne = saveData.eyeCount === 1;
    btnEyes2.classList.toggle('active', !isOne);
    btnEyes1.classList.toggle('active', isOne);
  }

  // 1. Сетка расцветок в Гардеробе (Диагональные двухцветные квадраты + авто-паттерн)
  const colGrid = document.getElementById('custom-colors-grid');
  if (colGrid) {
    colGrid.innerHTML = '';
    COLOR_PALETTES.forEach(col => {
      const unlocked = isColorUnlocked(col);
      const isSelected = saveData.selectedColorId === col.id;
      const patObj = PATTERN_ITEMS.find(p => p.id === col.defaultPat);
      const btn = document.createElement('div');
      btn.className = 'fg-color-tile' + (isSelected ? ' active' : '');
      btn.style.setProperty('--c1', col.css1);
      btn.style.setProperty('--c2', col.css2);
      btn.innerHTML = `
        ${isSelected ? '<div class="tile-check-badge">✓</div>' : ''}
        <div style="position:absolute;top:6px;left:8px;font-size:16px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.5))">${patObj ? patObj.icon : '🎨'}</div>
        ${!unlocked ? `<div class="tile-lock-tag">${getUnlockBadgeText(col, false)}</div>` : `<div class="tile-lock-tag" style="background:rgba(0,0,0,0.45);color:#fff">${col.title}</div>`}
      `;
      btn.addEventListener('click', () => {
        document.getElementById('custom-selected-title').textContent = `${col.title} (${patObj ? patObj.title : 'Узор'})`;
        document.getElementById('custom-selected-rarity').textContent = col.rarity;
        handleSelectOrUnlockColor(col);
      });
      colGrid.appendChild(btn);
    });
  }

  // 2. Сетка Паттернов (Узоров) раскраски в Гардеробе
  const patGrid = document.getElementById('custom-patterns-grid');
  if (patGrid) {
    patGrid.innerHTML = '';
    PATTERN_ITEMS.forEach(pat => {
      const unlocked = isPatternUnlocked(pat);
      const isSelected = saveData.selectedPatternId === pat.id;
      const card = document.createElement('div');
      card.className = 'fg-costume-card' + (isSelected ? ' active' : '');
      card.innerHTML = `
        ${isSelected ? '<div class="tile-check-badge">✓</div>' : ''}
        <div class="costume-icon-big">${pat.icon}</div>
        <div class="costume-card-name">${pat.title}</div>
        <div class="tile-lock-tag" style="${unlocked ? 'background:#00c853; color:#fff' : ''}">
          ${getUnlockBadgeText(pat, unlocked)}
        </div>
      `;
      card.addEventListener('click', () => {
        document.getElementById('custom-selected-title').textContent = `Узор: ${pat.title}`;
        document.getElementById('custom-selected-rarity').textContent = pat.rarity;
        handleSelectOrUnlockPattern(pat);
      });
      patGrid.appendChild(card);
    });
  }

  // 3. Сетка Полных Костюмов (Верх + Низ + Маски/Хвосты) в Гардеробе
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
        <div style="font-size:10px;color:#e0f7fa;margin-bottom:5px;font-weight:700">${cos.sub || 'Верх + Низ'}</div>
        <div class="tile-lock-tag" style="${unlocked ? 'background:#00c853; color:#fff' : ''}">
          ${getUnlockBadgeText(cos, unlocked)}
        </div>
      `;
      card.addEventListener('click', () => {
        document.getElementById('custom-selected-title').textContent = `${cos.title} (${cos.sub || ''})`;
        document.getElementById('custom-selected-rarity').textContent = cos.rarity;
        handleSelectOrUnlockCostume(cos);
      });
      cosGrid.appendChild(card);
    });
  }

  // 4. Шкала Сезона (Скриншот 2)
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

  // 5. Витрина Магазина (Скриншот 3: эксклюзив за победы + базовые за рекламу)
  const featRow = document.getElementById('shop-featured-row');
  if (featRow) {
    featRow.innerHTML = '';
    const featuredCostumes = COSTUME_ITEMS.filter(c => c.unlockType === 'crowns').slice(0, 3);
    featuredCostumes.forEach(cos => {
      const unlocked = isCostumeUnlocked(cos);
      const card = document.createElement('div');
      card.className = 'fg-shop-card';
      card.innerHTML = `
        <div class="shop-card-top">${cos.rarity} • ПОЛНЫЙ КОСТЮМ</div>
        <div class="shop-card-body">
          <div class="shop-preview-swatch" style="background:linear-gradient(135deg,#ff2a85,#7c4dff)">${cos.icon}</div>
          <strong style="font-size:14px">${cos.title}</strong>
          <small style="font-size:10.5px;color:#004d40;font-weight:800">${cos.sub || ''}</small>
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
  document.getElementById('race-finish-notice')?.remove();
  if (state.raceVisuals) { state.raceVisuals.dispose(); state.raceVisuals = null; }
  if (state.rolloutVisuals) { state.rolloutVisuals.dispose(); state.rolloutVisuals = null; }
  if (state.slimeVisuals) { state.slimeVisuals.dispose(); state.slimeVisuals = null; }
  state.slimeCourse = null;
  state.rollout = null;
  state.race = null;
  state.phase = 'menu';
  music.setMode('lobby');
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

function toggleMusic() {
  const isMuted = music.toggleMute();
  const icon = isMuted ? '🔕' : '🎵';
  const b1 = document.getElementById('btn-music');
  const b2 = document.getElementById('btn-lobby-music');
  if (b1) b1.textContent = icon;
  if (b2) b2.textContent = icon;
}

// ==================== ПРИВЯЗКА UI СОБЫТИЙ ====================
document.querySelectorAll('.fg-nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchLobbyTab(btn.dataset.tab));
});

document.getElementById('season-widget-click').addEventListener('click', () => switchLobbyTab('season'));

// Переключатель 1 или 2 глаза в маске Миньона
document.querySelectorAll('.eye-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    saveData.eyeCount = Number(btn.dataset.eyes) === 1 ? 1 : 2;
    saveGameData();
    sfx.play('step');
    rebuildLobbyBeanModel();
    renderAllLobbyPanels();
  });
});

// Переключатель под-вкладок Гардероба: Цвета | Паттерны | Полные Костюмы
document.querySelectorAll('.c-subtab').forEach(sub => {
  sub.addEventListener('click', () => {
    document.querySelectorAll('.c-subtab').forEach(s => s.classList.remove('active'));
    sub.classList.add('active');
    const st = sub.dataset.subtab;
    document.getElementById('custom-colors-grid').classList.toggle('hidden', st !== 'colors');
    document.getElementById('custom-patterns-grid').classList.toggle('hidden', st !== 'patterns');
    document.getElementById('custom-costumes-grid').classList.toggle('hidden', st !== 'costumes');
    sfx.play('step');
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

for (const [id, key] of [['volume-music','musicVolume'],['volume-effects','effectsVolume']]) {
  const slider=document.getElementById(id), label=document.getElementById(id+'-value');
  const update = () => {
    const value=Math.max(0,Math.min(100,Number(slider.value))); label.textContent=`${value}%`;
    saveData[key]=value/100;
    if(key==='musicVolume') music.setVolume(value/100);
    else { sfx.volume=value/100; if(sfx.effectsGain && sfx.ctx) sfx.effectsGain.gain.setTargetAtTime(sfx.volume,sfx.ctx.currentTime,.04); }
  };
  slider.value=String(Math.round(saveData[key]*100)); update();
  slider.addEventListener('input',update); slider.addEventListener('change',saveGameData);
}

const nameplateToggle = document.getElementById('show-nameplates');
function applyNameplateSetting() {
  document.getElementById('labels-layer').classList.toggle('hidden', saveData.showNameplates === false);
}
nameplateToggle.checked = saveData.showNameplates !== false;
applyNameplateSetting();
nameplateToggle.addEventListener('change', () => {
  saveData.showNameplates = nameplateToggle.checked;
  applyNameplateSetting();
  saveGameData();
});

document.getElementById('btn-level-select').addEventListener('click', () => document.getElementById('level-choices').classList.toggle('hidden'));
document.getElementById('btn-championship').addEventListener('click', () => startBigFans('championship'));
document.getElementById('btn-start-match').addEventListener('click', () => {
  state.lastMode = 'hex'; state.showMode = 'single';
  saveData.playerName = nameInput.value.trim() || 'СуперФасолька';
  saveGameData();
  startMatch();
});

document.getElementById('btn-play-again').addEventListener('click', () => state.lastMode === 'hex' ? startMatch() : state.lastMode === 'single_rollout' ? startRollOut() : state.lastMode === 'single_slime' ? startSlimeClimb() : state.lastMode === 'single_showdown' ? startJumpShowdown() : startBigFans(state.lastMode || 'single'));
document.getElementById('btn-big-fans').addEventListener('click', () => startBigFans('single'));
document.getElementById('btn-roll-out').addEventListener('click', () => startRollOut());
document.getElementById('btn-jump-showdown')?.addEventListener('click', () => startJumpShowdown());
document.getElementById('btn-result-settings').addEventListener('click', openStartModal);
document.getElementById('btn-menu').addEventListener('click', openStartModal);
document.getElementById('btn-sound').addEventListener('click', toggleSound);
document.getElementById('btn-lobby-sound').addEventListener('click', toggleSound);
document.getElementById('btn-music')?.addEventListener('click', toggleMusic);
document.getElementById('btn-lobby-music')?.addEventListener('click', toggleMusic);

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
  if (state.showdown) finishJumpShowdown(aliveList[0] || state.player); else if (state.slimeCourse) finishSlimeClimb(); else if (state.rollout) finishRollOut(); else triggerWinnerCelebration(aliveList[0] || state.player);
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


