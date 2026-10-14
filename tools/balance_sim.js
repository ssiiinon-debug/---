// Симулятор баланса «Общаги-тайкуна».
// Бот играет «жадно»: покупает то, что быстрее всего окупается, кликает и убирает мусор.
// Запуск: node tools/balance_sim.js [минут] [звёзд] [корпус]
// Показывает, когда открываются комнаты, этажи, персонал и сколько звёзд даст престиж.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = ['js/config.js', 'js/utils.js', 'js/economy.js', 'js/state.js', 'js/sim.js'];
let code = 'function t(k){return k;}\n';
for (const f of files) code += fs.readFileSync(path.join(root, f), 'utf8') + '\n';
code += 'globalThis.__x = { CFG, U, Eco, State, Sim, Bus };';
const ctx = { console, Math, Date, JSON };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const { CFG, U, Eco, State, Sim } = ctx.__x;
// Быстрая подгонка без правки конфига: OVERRIDE='{"UPG_GROWTH":1.2}' node tools/balance_sim.js
if (process.env.OVERRIDE) Object.assign(CFG, JSON.parse(process.env.OVERRIDE));

const MINUTES = +(process.argv[2] || 150);
// RUNS=4 — бот будет переезжать в новый корпус, когда престиж удвоит звёзды (и минимум 5)
const RUNS = +(process.env.RUNS || 1);

let s = State.create();
const dt = 0.25;
let tSec = 0;
const log = [];
const mark = (msg) => log.push(`${fmtT(tSec)}  ${msg}`);
function fmtT(sec) { const m = Math.floor(sec / 60), ss = Math.floor(sec % 60); return `${String(m).padStart(3)}:${String(ss).padStart(2, '0')}`; }

function potentialTotal() {
  let sum = 0;
  for (let i = 0; i < s.rooms.length; i++) if (s.rooms[i].lvl) sum += Eco.roomPotential(s, i, s.rooms[i].lvl);
  return sum;
}

function options() {
  const opts = [];
  const total = Math.max(1, potentialTotal());
  for (let i = 0; i < s.rooms.length; i++) {
    const r = s.rooms[i];
    const f = Eco.floorOf(i);
    if (f >= s.floors) continue;
    if (r.lvl === 0) {
      opts.push({ kind: 'unlock', i, cost: Eco.roomUnlockCost(i), gain: Eco.roomPotential(s, i, 1) * 4 });
    } else if (r.lvl < CFG.ROOM_MAX_LVL) {
      opts.push({ kind: 'upg', i, cost: Eco.roomUpgradeCost(i, r.lvl), gain: Eco.roomPotential(s, i, r.lvl + 1) - Eco.roomPotential(s, i, r.lvl) });
    }
  }
  if (s.floors < CFG.FLOORS) {
    const f = s.floors;
    opts.push({ kind: 'floor', f, cost: Eco.floorCost(f), gain: Eco.roomPotential(s, f * 3, 1) * 8 });
  }
  for (let f = 0; f < s.floors; f++) {
    if (s.kitchens[f] >= CFG.KITCHEN_MAX) continue;
    let floorPot = 0;
    for (let k = 0; k < 3; k++) { const i = f * 3 + k; if (s.rooms[i].lvl) floorPot += Eco.roomPotential(s, i, s.rooms[i].lvl); }
    opts.push({ kind: 'kitchen', f, cost: Eco.kitchenCost(f, s.kitchens[f]), gain: floorPot * CFG.KITCHEN_BONUS / Eco.floorMult(s, f) });
  }
  const facGain = { shower: 0.035, laundry: CFG.LAUNDRY_SHARE, gym: 0.03 };
  for (const k of ['shower', 'laundry', 'gym']) {
    if (s.fac[k] >= CFG.FAC[k].max) continue;
    opts.push({ kind: 'fac', key: k, cost: Eco.facCost(k, s.fac[k]), gain: total * facGain[k] });
  }
  const staffGain = { cleaner: 0.12, plumber: 0.06, starosta: 0.06 };
  for (const k of ['cleaner', 'plumber', 'starosta']) {
    if (s.staff[k] >= CFG.STAFF[k].max) continue;
    opts.push({ kind: 'staff', key: k, cost: Eco.staffCost(k, s.staff[k]), gain: total * staffGain[k] / (1 + s.staff[k]) });
  }
  return opts;
}

function buy(o) {
  if (s.coins < o.cost) return false;
  s.coins -= o.cost;
  switch (o.kind) {
    case 'unlock': s.rooms[o.i].lvl = 1; s.rooms[o.i].arriveT = 1; mark(`открыта комната ${o.i + 1}`); break;
    case 'upg': {
      const before = Eco.stageOf(s.rooms[o.i].lvl);
      s.rooms[o.i].lvl++;
      const after = Eco.stageOf(s.rooms[o.i].lvl);
      if (after > before && after > Eco.maxStageSeen) { Eco.maxStageSeen = after; mark(`первая комната стадии ${after}`); }
      break;
    }
    case 'floor': s.floors++; s.rooms[o.f * 3].lvl = 1; mark(`ЭТАЖ ${s.floors} (${U.fmt(o.cost)})  доход ${U.fmt(Eco.totalIncome(s, true))}/с`); break;
    case 'kitchen': s.kitchens[o.f]++; if (s.kitchens[o.f] === 1) mark(`кухня на этаже ${o.f + 1}`); break;
    case 'fac': s.fac[o.key]++; if (s.fac[o.key] === 1) mark(`построено: ${o.key}`); break;
    case 'staff': s.staff[o.key]++; mark(`${o.key} ур.${s.staff[o.key]}`); break;
  }
  return true;
}
Eco.maxStageSeen = 1;

let prestigeMarked = 0;
let runStart = 0, runsDone = 0;
let lastReport = 0;
let cleanT = 0, fixT = 0;
while (tSec < MINUTES * 60) {
  Sim.update(s, dt);
  tSec += dt;
  const valya = s.staff.valya > 0;
  // Игрок кликает: до тёти Вали активно, потом лениво
  const taps = valya ? 1 : 3;
  Sim.earn(s, Eco.tapValue(s) * taps * dt);
  if (!valya) for (const r of s.rooms) { Sim.earn(s, r.box); r.box = 0; }
  if (!valya) { Sim.earn(s, s.laundryBox); s.laundryBox = 0; }
  // Игрок убирает мусор и чинит поломки сам, но не мгновенно
  cleanT -= dt; fixT -= dt;
  if (cleanT <= 0) { cleanT = 6; const r = s.rooms.find((x) => x.trash > 0); if (r) r.trash--; }
  if (fixT <= 0) { fixT = 8; const i = s.rooms.findIndex((x) => x.broken); if (i >= 0) Sim.fixRoom(s, i); }

  if (!valya && s.coins >= Eco.staffCost('valya', 0)) { s.coins -= Eco.staffCost('valya', 0); s.staff.valya = 1; mark('нанята тётя Валя'); }

  // Покупаем лучшее по «время накопить + окупаемость»
  for (let guard = 0; guard < 20; guard++) {
    const inc = Math.max(0.5, Eco.totalIncome(s));
    let best = null, bestScore = Infinity;
    for (const o of options()) {
      if (o.gain <= 0) continue;
      const score = Math.max(0, o.cost - s.coins) / inc + o.cost / o.gain;
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (!best || !buy(best)) break;
  }

  const st = Eco.starsGain(s);
  if (RUNS > 1 && Eco.canPrestige(s) && st >= Math.max(5, s.stars) && s.floors >= CFG.FLOORS) {
    mark(`=== ПЕРЕЕЗД: +${st} звёзд (было ${s.stars}), корпус ${s.building + 2}, время корпуса ${fmtT(tSec - runStart)}`);
    s = State.prestige(s, st);
    runStart = tSec; prestigeMarked = 0; runsDone++;
    if (runsDone >= RUNS) break;
    continue;
  }
  if (Eco.canPrestige(s) && st > prestigeMarked && (st === 1 || st % 5 === 0) && !process.env.QUIET_STARS) {
    prestigeMarked = st;
    mark(`престиж даст ${st} звёзд`);
  }
  if (tSec - lastReport >= 600) {
    lastReport = tSec;
    mark(`-- доход ${U.fmt(Eco.totalIncome(s))}/с, монет ${U.fmt(s.coins)}, реп ${s.rep.toFixed(0)}, комнат ${Eco.openRooms(s)}, макс.ур ${Eco.maxRoomLvl(s)}`);
  }
}
console.log(log.join('\n'));
console.log(`\nИтог за ${fmtT(tSec)}: заработано за корпус ${U.fmt(s.runEarned)}, всего ${U.fmt(s.totalEarned)}, звёзд ${s.stars}, престиж даст ещё ${Eco.starsGain(s)}`);
console.log('Уровни комнат:', s.rooms.map((r) => r.lvl).join(' '));
console.log('Кухни:', s.kitchens.join(' '), ' Помещения:', JSON.stringify(s.fac), ' Персонал:', JSON.stringify(s.staff));
