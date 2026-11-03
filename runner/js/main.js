import * as THREE from 'three';
import { CFG } from './config.js';
import { SDK } from './sdk.js';
import { Audio } from './audio.js';
import { t, setLang, applyI18n } from './i18n.js';
import { makeSky, makeBlob, makeStore } from './models.js';
import { makeCharacter, animateCharacter, GUARD_SKIN } from './characters.js';
import { World } from './world.js';

const $ = (id) => document.getElementById(id);
const LANES = CFG.LANES;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- сохранение ----------
const DEFAULT_SAVE = { coins: 0, best: 0, skin: 'trigot', owned: ['trigot'], upg: { magnet: 0, x2: 0, sneakers: 0, shield: 0 }, sound: true, runs: 0 };
let save = structuredClone(DEFAULT_SAVE);
const persist = (flush) => SDK.save(save, flush);

// ---------- рендер ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb8344f, 55, 170);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
scene.add(new THREE.HemisphereLight(0xffd0dc, 0x3a2a48, 1.55));
const sun = new THREE.DirectionalLight(0xffc8a8, 1.9);
sun.position.set(-6, 12, 5); scene.add(sun); scene.add(sun.target);
const sky = makeSky(); scene.add(sky);

const world = new World(scene);
const store = makeStore(); scene.add(store);

let hero = null;
const heroShadow = makeBlob(1.4); scene.add(heroShadow);
const guard = makeCharacter(GUARD_SKIN); guard.scale.setScalar(1.06); scene.add(guard);
const guardShadow = makeBlob(1.6); scene.add(guardShadow);
const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 18, 14),
  new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.22, depthWrite: false }));
scene.add(shieldBubble);

function skinById(id) { return CFG.SKINS.find(s => s.id === id) || CFG.SKINS[0]; }
function setHero(id) {
  if (hero) scene.remove(hero);
  hero = makeCharacter(skinById(id));
  scene.add(hero);
  $('charName').textContent = t('skin_' + id);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 72 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------- состояние ----------
let state = 'loading';     // menu | run | dying | over | paused
const P = {};
const powers = { magnet: 0, x2: 0, sneakers: 0, shield: 0 };
let score = 0, runCoins = 0, deathKind = 'crash', revived = false, doubled = false;
let deathBlend = 0, time = 0, animT = 0, dieT = 0, camBlend = 0, shake = 0, guardS = 0, hintT = 0;

function powerDur(k) { return CFG.POWERS[k].base + CFG.POWERS[k].per * (save.upg[k] || 0); }

function resetPlayer() {
  Object.assign(P, { lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, s: 0, prevS: 0, prevX: 0, prevY: 0, speed: CFG.SPEED0,
    onGround: true, airT: 0, roll: 0, rollQueued: false, stumbleT: 0, invuln: 0, fallK: 0 });
  for (const k in powers) powers[k] = 0;
}

// ---------- управление ----------
function act(a) {
  if (state !== 'run') return;
  if (a === 'left' || a === 'right') {
    const nl = P.lane + (a === 'left' ? -1 : 1);
    if (nl < 0 || nl > 2) return;
    P.prevLane = P.lane; P.lane = nl; Audio.lane();
  } else if (a === 'up') {
    if (P.onGround || P.airT < 0.1) {
      P.vy = powers.sneakers > 0 ? CFG.SUPER_JUMP_V : CFG.JUMP_V;
      P.onGround = false; P.airT = 1; P.roll = 0; P.rollQueued = false; Audio.jump();
    }
  } else if (a === 'down') {
    if (!P.onGround) { P.vy = Math.min(P.vy, CFG.DIVE_V); P.rollQueued = true; }
    else { P.roll = CFG.ROLL_TIME; Audio.roll(); }
  }
}

window.addEventListener('keydown', (e) => {
  const k = e.code;
  if (['ArrowLeft', 'KeyA'].includes(k)) act('left');
  else if (['ArrowRight', 'KeyD'].includes(k)) act('right');
  else if (['ArrowUp', 'KeyW', 'Space'].includes(k)) act('up');
  else if (['ArrowDown', 'KeyS'].includes(k)) act('down');
  else if (['Escape', 'KeyP'].includes(k)) { if (state === 'run') pause(); else if (state === 'paused') resume(); }
  else if (k === 'Enter' && state === 'menu') startRun();
  if (k.startsWith('Arrow') || k === 'Space') e.preventDefault();
});

let sw = null;
canvas.addEventListener('pointerdown', (e) => { Audio.unlock(); sw = { x: e.clientX, y: e.clientY, done: false }; });
canvas.addEventListener('pointermove', (e) => {
  if (!sw || sw.done) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, th = Math.max(24, Math.min(window.innerWidth, window.innerHeight) * 0.04);
  if (Math.abs(dx) < th && Math.abs(dy) < th) return;
  sw.done = true;
  if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right'); else act(dy < 0 ? 'up' : 'down');
});
window.addEventListener('pointerup', () => { sw = null; });
window.addEventListener('pointercancel', () => { sw = null; });
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- игровая физика ----------
function overlapsS(s, o0, o1) { return s + 0.4 > o0 && s - 0.4 < o1; }

function stumble() {
  if (P.stumbleT > 0) { die('caught'); return; }
  P.stumbleT = CFG.STUMBLE_TIME; shake = 0.35; Audio.stumble(); Audio.whistle();
}
function crash(o) {
  if (powers.shield > 0) {
    powers.shield = 0; P.invuln = CFG.INVULN_SHIELD; shake = 0.4; Audio.shieldBreak();
    if (o && (o.type === 'low' || o.type === 'high')) world.removeObs(o);
    return;
  }
  die('crash');
}

function physics(dt) {
  P.prevS = P.s; P.prevX = P.x; P.prevY = P.y;
  P.speed = Math.min(CFG.SPEED_MAX, P.speed + CFG.SPEED_ACC * dt);
  P.s += P.speed * dt;
  const tx = LANES[P.lane], dx = tx - P.x, st = CFG.LANE_SPEED * dt;
  P.x = Math.abs(dx) <= st ? tx : P.x + Math.sign(dx) * st;
  P.vy -= CFG.GRAVITY * dt; P.y += P.vy * dt;
  if (P.roll > 0) P.roll -= dt;
  if (P.invuln > 0) P.invuln -= dt;
  if (P.stumbleT > 0) P.stumbleT -= dt;
  for (const k in powers) if (powers[k] > 0) powers[k] = Math.max(0, powers[k] - dt);

  const h = P.roll > 0 ? CFG.H_ROLL : CFG.H_STAND;
  let ground = 0, hitFront = null, hitSide = false, stuck = false;
  for (const o of world.obs) {
    if (o.s0 > P.s + 2 || o.s1 < P.s - 2) continue;
    if (Math.abs(P.x - o.x) >= o.hw + CFG.HALF_W) continue;
    if (!overlapsS(P.s, o.s0, o.s1)) continue;
    const wasLat = Math.abs(P.prevX - o.x) < o.hw + CFG.HALF_W;
    const wasS = overlapsS(P.prevS, o.ps0, o.ps0 + o.len);
    if (o.type === 'ramp') {
      const gh = clamp((P.s - o.s0) / o.len, 0, 1) * o.y1;
      if (P.y >= gh - 1.0 || P.invuln > 0) ground = Math.max(ground, gh);
      else if (!wasLat) hitSide = true;
      continue;
    }
    if (o.type === 'train' && (P.y >= o.y1 - 0.5 || P.prevY >= o.y1 - 0.2)) { ground = Math.max(ground, o.y1); continue; }
    if (!(P.y < o.y1 && P.y + h > o.y0)) continue;
    if (P.invuln > 0) { stuck = true; continue; }
    if (wasS && !wasLat) { hitSide = true; continue; }
    if (wasS && wasLat) { stuck = true; continue; }
    // лобовое: прощаем, если почти запрыгнул на поезд
    if (o.type === 'train' && P.y > o.y1 - 0.9) { ground = Math.max(ground, o.y1); continue; }
    hitFront = o;
  }
  if (stuck && P.invuln <= 0.1) P.invuln = 0.1;

  if (hitFront) { crash(hitFront); if (state !== 'run') return; }
  if (hitSide) {
    P.lane = P.prevLane; P.x = P.prevX;
    stumble(); if (state !== 'run') return;
  }

  if (P.y <= ground) {
    if (!P.onGround && P.prevY > ground + 0.3) { Audio.land(); if (P.rollQueued) { P.roll = CFG.ROLL_TIME; Audio.roll(); } }
    P.y = ground; P.vy = 0; P.onGround = true; P.airT = 0; P.rollQueued = false;
  } else {
    P.onGround = false; P.airT += dt;
  }

  // монеты и бонусы
  const top = P.y + h + 0.5;
  for (const c of world.coins) {
    if (c.s > P.s + 1.5) break;
    if (!c.alive || c.s < P.s - 1.2) continue;
    if (Math.abs(c.x - P.x) < 1.0 && c.y > P.y - 0.6 && c.y < top) {
      c.alive = false; runCoins++; score += CFG.COIN_SCORE * (powers.x2 > 0 ? 2 : 1); Audio.coin();
    }
  }
  for (const p of world.powers) {
    if (p.alive && Math.abs(p.s - P.s) < 1.2 && Math.abs(p.x - P.x) < 1.0 && p.y > P.y - 0.6 && p.y < top) {
      p.alive = false; powers[p.kind] = powerDur(p.kind); Audio.power();
    }
  }
  score += P.speed * dt * CFG.SCORE_PER_M * (powers.x2 > 0 ? 2 : 1);
}

function die(kind) {
  deathKind = kind; state = 'dying'; dieT = 0; P.fallK = 0; shake = 0.5;
  Audio.crash(); SDK.gameplayStop();
}

// ---------- игровой цикл ----------
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  if (window.__freeze) return;   // отладка: остановить кадр
  tick(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}

function tick(dt) {
  time += dt;

  if (state === 'run') {
    physics(dt);
    world.generate(P.s, P.speed);
    animT += dt * (6 + P.speed * 0.28);
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').classList.add('hidden'); }
  } else if (state === 'dying') {
    dieT += dt; P.fallK = Math.min(1, P.fallK + dt * 3.5);
    P.vy -= CFG.GRAVITY * dt; P.y = Math.max(groundUnder(), P.y + P.vy * dt); if (P.y <= groundUnder()) P.vy = 0;
    if (dieT > 1.3) showOver();
  } else if (state === 'menu') {
    animT += dt * 2;
  }

  if (state !== 'paused') {
    world.update(state === 'run' ? dt : (state === 'menu' ? 0 : dt * 0.3), P.s, time, powers.magnet > 0, P);
  }

  updateActors(dt);
  updateCamera(dt);
  updateStore();
  if (state === 'run' || state === 'dying') updateHud();
}

function groundUnder() {
  let g = 0;
  for (const o of world.obs) {
    if (Math.abs(P.x - o.x) >= o.hw || !overlapsS(P.s, o.s0, o.s1)) continue;
    if (o.type === 'train' && P.y >= o.y1 - 0.6) g = Math.max(g, o.y1);
    if (o.type === 'ramp') g = Math.max(g, clamp((P.s - o.s0) / o.len, 0, 1) * o.y1);
  }
  return g;
}

function updateActors(dt) {
  hero.position.set(P.x, P.y, -P.s);
  const tilt = (LANES[P.lane] - P.x) * -0.08;
  if (state === 'menu') { animateCharacter(hero, animT, 'idle'); hero.rotation.set(0, 0, 0); }
  else if (state === 'dying' || state === 'over') animateCharacter(hero, animT, deathKind === 'caught' ? 'catch' : 'fall', P.fallK);
  else if (P.roll > 0 && P.onGround) animateCharacter(hero, animT, 'roll', 1 - P.roll / CFG.ROLL_TIME);
  else if (!P.onGround) animateCharacter(hero, animT, 'jump');
  else animateCharacter(hero, animT, 'run');
  if (state === 'run' || state === 'paused') hero.rotation.set(0, 0, tilt);
  if (state === 'over' && deathKind === 'caught') hero.rotation.set(0, Math.PI, 0);
  hero.visible = !(P.invuln > 0 && state === 'run' && Math.floor(time * 14) % 2 === 0);
  heroShadow.position.set(P.x, groundUnder() + 0.03, -P.s);
  heroShadow.scale.setScalar(clamp(1 - (P.y - groundUnder()) * 0.15, 0.4, 1));
  shieldBubble.visible = powers.shield > 0 && (state === 'run' || state === 'paused');
  shieldBubble.position.set(P.x, P.y + 0.9, -P.s);
  shieldBubble.scale.setScalar(1 + Math.sin(time * 6) * 0.04);

  // контролёр
  let target, gx = P.x * 0.8;
  if (state === 'menu') { target = P.s - 2.2; gx = 1.7; }
  else if (state === 'dying' || state === 'over') { target = P.s - 1.0; gx = P.x + 1.0; }
  else if (P.stumbleT > 0) target = P.s - 2.6 - (1 - P.stumbleT / CFG.STUMBLE_TIME) * 2;
  else target = P.s - 16;
  if (state === 'menu') guardS = target;
  else guardS += (target - guardS) * Math.min(1, dt * (target > guardS ? 3 : 0.8));
  guardS = Math.min(guardS, P.s - 1.2);
  guard.position.set(state === 'menu' ? gx : guard.position.x + (gx - guard.position.x) * Math.min(1, dt * 4), 0, -guardS);
  guard.visible = P.s - guardS < 14;
  if (state === 'menu') { animateCharacter(guard, animT * 0.9 + 1, 'idle'); guard.rotation.y = -0.4; }
  else if (state === 'over' || (state === 'dying' && P.s - guardS < 1.6)) { animateCharacter(guard, time * 8, 'catch'); guard.rotation.y = 0.5; }
  else { animateCharacter(guard, animT * 0.95 + 1.5, 'run'); guard.rotation.y = 0; }
  guardShadow.visible = guard.visible;
  guardShadow.position.set(guard.position.x, 0.03, guard.position.z);
}

function updateStore() {
  // магазин — только фон главного меню; в забеге камера уходит сквозь него, поэтому прячем
  store.visible = state === 'menu' || camBlend < 0.35;
  if (store.visible) {
    const on = Math.sin(time * 23) + Math.sin(time * 7.3) > -1.6;
    store.userData.flicker.color.setScalar(on ? 1 : 0.35);
  }
}

function updateCamera(dt) {
  // меню: камера спереди, смотрит в лицо; забег: сзади-сверху
  const runPos = tmpV.set(P.x * 0.55, 4.1 + P.y * 0.6, -P.s + (camera.aspect < 0.8 ? 8.4 : 7.2));
  // после удара камера облетает сбоку, чтобы контролёр не закрывал героя
  const dead = state === 'dying' || state === 'over';
  deathBlend += ((dead ? 1 : 0) - deathBlend) * Math.min(1, dt * 3);
  if (deathBlend > 0.001) runPos.lerp(new THREE.Vector3(P.x + 0.3, P.y + 6.2, -P.s + 5.2), deathBlend);
  const menuPos = new THREE.Vector3(1.4, 1.9, -P.s - 5.6);
  const want = state === 'menu' ? 0 : 1;
  camBlend += (want - camBlend) * Math.min(1, dt * 2.6);
  const e = camBlend * camBlend * (3 - 2 * camBlend);
  camPos.copy(menuPos).lerp(runPos, e);
  const lookRun = new THREE.Vector3(P.x * 0.4, 1.4 + P.y * 0.6, -P.s - 10).lerp(new THREE.Vector3(P.x + 0.5, P.y + 0.8, -P.s + 0.5), deathBlend);
  const lookMenu = new THREE.Vector3(0.6, 1.35, -P.s);
  camLook.copy(lookMenu).lerp(lookRun, e);
  if (shake > 0) { shake -= dt; camPos.x += (Math.random() - 0.5) * shake; camPos.y += (Math.random() - 0.5) * shake; }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  sky.position.set(camera.position.x, 0, camera.position.z);
  sun.position.set(camera.position.x - 6, 12, camera.position.z - 2);
  sun.target.position.set(camera.position.x, 0, camera.position.z - 12);
}

// ---------- HUD ----------
let lastScoreTxt = '', powersTick = 0;
function updateHud() {
  const s = Math.floor(score).toString();
  if (s !== lastScoreTxt) { $('hudScore').textContent = s; lastScoreTxt = s; }
  $('hudCoins').textContent = runCoins;
  const m = $('hudMult'); const x2 = powers.x2 > 0;
  m.textContent = x2 ? 'x2' : 'x1'; m.classList.toggle('hot', x2);
  if ((powersTick += 1) % 6) return;
  const html = Object.keys(powers).filter(k => powers[k] > 0).map(k => {
    const p = CFG.POWERS[k], f = powers[k] / powerDur(k);
    return `<div class="pw"><div class="pw-ico" style="background:${p.color}">${p.label}</div><div class="pw-bar"><i style="width:${(f * 100).toFixed(0)}%"></i></div></div>`;
  }).join('');
  $('powers').innerHTML = html;
}

// ---------- экраны ----------
function show(id) {
  for (const s of ['menu', 'shop', 'pause', 'over']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', !(id === null || id === 'pause'));
}

function refreshMenu() {
  $('menuCoins').textContent = save.coins; $('menuBest').textContent = Math.floor(save.best);
  $('btnSound').classList.toggle('off', !save.sound);
}

function toMenu() {
  state = 'menu'; SDK.gameplayStop(); if (save.sound) Audio.startMusic();
  world.reset(); resetPlayer(); world.generate(0, CFG.SPEED0);
  guardS = -2.2; refreshMenu(); show('menu');
}

function startRun() {
  Audio.unlock(); Audio.click();
  world.reset(); resetPlayer(); world.generate(0, CFG.SPEED0);
  score = 0; runCoins = 0; revived = false; doubled = false; lastScoreTxt = '';
  guardS = -2.5; P.stumbleT = 1.2;                  // в начале контролёр «на хвосте»
  state = 'run'; show(null);
  if ((save.runs || 0) < 2) { $('hint').textContent = t('hint'); $('hint').classList.remove('hidden'); hintT = 4; }
  else $('hint').classList.add('hidden');
  if (save.sound) Audio.startMusic();
  Audio.whistle();
  SDK.gameplayStart();
}

function pause() {
  if (state !== 'run') return;
  state = 'paused'; show('pause'); Audio.pauseMusic(); SDK.gameplayStop();
}
function resume() {
  if (state !== 'paused') return;
  state = 'run'; show(null); clock.getDelta(); if (save.sound) Audio.startMusic(); SDK.gameplayStart();
}

function showOver() {
  state = 'over';
  save.coins += runCoins; save.runs = (save.runs || 0) + 1;
  const isBest = score > save.best;
  if (isBest) { save.best = Math.floor(score); SDK.setLeaderboard(save.best); }
  persist(true);
  $('overTitle').textContent = isBest ? t('newBest') : t(deathKind === 'caught' ? 'caught' : 'crashed');
  $('overScore').textContent = Math.floor(score);
  $('overBest').textContent = Math.floor(save.best);
  $('overCoins').textContent = runCoins;
  $('btnRevive').classList.toggle('hidden', revived);
  $('btnDouble').disabled = doubled || runCoins === 0;
  show('over');
}

function revive() {
  revived = true; save.coins -= runCoins;  // монеты забега начислятся заново в конце
  save.runs = Math.max(0, (save.runs || 1) - 1);
  world.clearAhead(P.s - 3, P.s + 30);
  P.y = groundUnder(); P.vy = 0; P.roll = 0; P.stumbleT = 0; P.invuln = CFG.INVULN_REVIVE;
  P.speed = Math.max(CFG.SPEED0, P.speed * 0.9); P.fallK = 0;
  guardS = P.s - 16;
  state = 'run'; show(null); clock.getDelta();
  if (save.sound) Audio.startMusic();
  SDK.gameplayStart();
}

function adOpen() { Audio.mute(true); }
function adClose() { Audio.mute(false); clock.getDelta(); }

async function maybeInterstitial() {
  if (save.runs > 0 && save.runs % CFG.INTERSTITIAL_EVERY === 0) await SDK.showInterstitial(adOpen, adClose);
}

// ---------- магазин ----------
let shopTab = 'chars';
function openShop(tab) { shopTab = tab; renderShop(); show('shop'); }
function renderShop() {
  $('shopTitle').textContent = t(shopTab === 'chars' ? 'characters' : 'upgrades');
  $('shopCoins').textContent = save.coins;
  const list = $('shopList'); list.innerHTML = '';
  if (shopTab === 'chars') {
    for (const sk of CFG.SKINS) {
      const owned = save.owned.includes(sk.id), sel = save.skin === sk.id;
      const el = document.createElement('div');
      el.className = 'item' + (sel ? ' sel' : '');
      el.innerHTML = `<div class="swatch" style="background:${sk.jacket}">
          <i style="top:0;height:38%;background:${sk.hair}"></i><i style="top:38%;height:16%;background:${sk.skin}"></i>
          <i style="bottom:0;height:24%;background:${sk.pants}"></i></div>
        <div class="item-body"><b>${t('skin_' + sk.id)}</b><small>${t('sd_' + sk.id)}</small></div>`;
      const b = document.createElement('button'); b.className = 'btn' + (owned ? '' : ' play');
      if (sel) { b.textContent = t('selected'); b.disabled = true; }
      else if (owned) b.textContent = t('select');
      else { b.innerHTML = `<i class="coin-ico"></i>${sk.price}`; b.disabled = save.coins < sk.price; }
      b.onclick = () => {
        if (!owned) { if (save.coins < sk.price) return; save.coins -= sk.price; save.owned.push(sk.id); Audio.buy(); }
        else Audio.click();
        save.skin = sk.id; setHero(sk.id); persist(true); renderShop(); refreshMenu();
      };
      el.appendChild(b); list.appendChild(el);
    }
  } else {
    for (const k of Object.keys(CFG.POWERS)) {
      const p = CFG.POWERS[k], lvl = save.upg[k] || 0, cost = CFG.UPG_COST[lvl];
      const el = document.createElement('div'); el.className = 'item';
      el.innerHTML = `<div class="swatch" style="background:${p.color};display:grid;place-items:center;font-weight:900;font-size:22px">${p.label}</div>
        <div class="item-body"><b>${t('p_' + k)} · ${powerDur(k).toFixed(0)}${t('sec')}</b><small>${t('pd_' + k)}</small>
        <div class="lvl">${Array.from({ length: CFG.UPG_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const b = document.createElement('button'); b.className = 'btn play';
      if (lvl >= CFG.UPG_MAX) { b.textContent = t('max'); b.disabled = true; }
      else { b.innerHTML = `<i class="coin-ico"></i>${cost}`; b.disabled = save.coins < cost; }
      b.onclick = () => {
        if (lvl >= CFG.UPG_MAX || save.coins < cost) return;
        save.coins -= cost; save.upg[k] = lvl + 1; Audio.buy(); persist(true); renderShop(); refreshMenu();
      };
      el.appendChild(b); list.appendChild(el);
    }
  }
}

// ---------- кнопки ----------
$('btnPlay').onclick = startRun;
window.addEventListener('pointerdown', () => Audio.unlock(), { once: true });
window.addEventListener('keydown', () => Audio.unlock(), { once: true });
$('btnChars').onclick = () => { Audio.unlock(); Audio.click(); openShop('chars'); };
$('btnUpg').onclick = () => { Audio.unlock(); Audio.click(); openShop('upg'); };
$('btnShopBack').onclick = () => { Audio.click(); refreshMenu(); show('menu'); };
$('btnSound').onclick = () => {
  save.sound = !save.sound; Audio.setEnabled(save.sound); if (save.sound) { Audio.unlock(); Audio.click(); Audio.startMusic(); }
  refreshMenu(); persist();
};
$('btnPause').onclick = pause;
$('btnResume').onclick = resume;
$('btnPauseMenu').onclick = () => { score > save.best && (save.best = Math.floor(score)); save.coins += runCoins; persist(true); toMenu(); };
$('btnRevive').onclick = async () => {
  const ok = await SDK.showRewarded(adOpen, adClose);
  if (ok) revive();
};
$('btnDouble').onclick = async () => {
  const ok = await SDK.showRewarded(adOpen, adClose);
  if (ok && !doubled) {
    doubled = true; save.coins += runCoins; persist(true);
    $('overCoins').textContent = runCoins * 2; $('btnDouble').disabled = true; Audio.buy();
  }
};
$('btnAgain').onclick = async () => { await maybeInterstitial(); startRun(); };
$('btnOverMenu').onclick = async () => { await maybeInterstitial(); toMenu(); };

SDK.onPause = () => { pause(); Audio.mute(true); };
SDK.onResume = () => { Audio.mute(false); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); Audio.mute(true); } else { Audio.mute(false); if (state === 'paused') Audio.pauseMusic(); }
});

// ---------- старт ----------
async function boot() {
  resize();
  await SDK.init();
  setLang(SDK.lang || (navigator.language || 'ru').slice(0, 2));
  applyI18n();
  const loaded = await SDK.load();
  if (loaded) save = Object.assign(structuredClone(DEFAULT_SAVE), loaded, { upg: Object.assign({}, DEFAULT_SAVE.upg, loaded.upg || {}) });
  save.owned = save.owned.filter(id => CFG.SKINS.some(s => s.id === id));
  if (!save.owned.includes('trigot')) save.owned.unshift('trigot');
  if (!save.owned.includes(save.skin)) save.skin = 'trigot';
  Audio.setEnabled(save.sound);
  setHero(save.skin);
  resetPlayer();
  toMenu();
  camBlend = 0;
  $('loading').classList.add('hidden');
  SDK.loadingReady();
  frame();
}
boot();
// для отладки из консоли
window.__rr = { get state() { return state; }, P, powers, world, camera, renderer, scene, get hero() { return hero; }, guard, tick, act, startRun, get score() { return score; } };
