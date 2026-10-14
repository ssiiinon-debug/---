'use strict';
// Геометрия мира: здание в разрезе, как в Fallout Shelter.
// Ряд 0 — цоколь (вахта, душевая, прачечная, качалка), ряды 1..5 — жилые этажи
// (3 комнаты + кухня). Слева лестничная клетка. Земля на y = 0, вверх — минус.

const L = {
  CW: 200,        // ширина ячейки
  CH: 150,        // высота ячейки
  FY: 138,        // уровень пола внутри ячейки
  SLAB: 14,       // толщина перекрытия
  WALL: 14,       // толщина наружной стены
  STAIR: 76,      // ширина лестничной клетки
  MARGIN: 34,
  ROOF_H: 30,
  GROUND_H: 150,
  COLS: 4,
};
L.RH = L.CH + L.SLAB;
L.BW = 2 * L.WALL + L.STAIR + L.COLS * L.CW;
L.WW = L.BW + 2 * L.MARGIN;
L.bx0 = L.MARGIN;
L.bx1 = L.MARGIN + L.BW;
L.stairX = L.bx0 + L.WALL;
L.rowTop = (r) => -(r + 1) * L.RH;
L.cellX = (c) => L.bx0 + L.WALL + L.STAIR + c * L.CW;
L.feetY = (r) => L.rowTop(r) + L.FY + 7;
L.roofTop = (floors) => L.rowTop(floors) - L.ROOF_H;
L.worldTop = (floors) => L.rowTop(Math.min(CFG.FLOORS, floors) + 1) - L.ROOF_H - 170;

// Ячейка (row, col) <-> игровой объект
L.cellOfTarget = (tg) => {
  if (!tg) return null;
  if (tg.type === 'room') return { row: Math.floor(tg.i / CFG.ROOMS_PER_FLOOR) + 1, col: tg.i % CFG.ROOMS_PER_FLOOR };
  if (tg.type === 'kitchen') return { row: tg.f + 1, col: 3 };
  if (tg.type === 'fac') return { row: 0, col: CFG.FAC_ORDER.indexOf(tg.key) };
  return null;
};
L.targetAt = (row, col) => {
  if (row === 0) return { type: 'fac', key: CFG.FAC_ORDER[col] };
  if (col === 3) return { type: 'kitchen', f: row - 1 };
  return { type: 'room', i: (row - 1) * CFG.ROOMS_PER_FLOOR + col };
};
L.hitCell = (wx, wy, floors) => {
  for (let row = 0; row <= floors; row++) {
    const y = L.rowTop(row);
    if (wy < y || wy > y + L.CH) continue;
    for (let col = 0; col < L.COLS; col++) {
      const x = L.cellX(col);
      if (wx >= x && wx <= x + L.CW) return { row, col };
    }
  }
  return null;
};
// Зона стройки следующего этажа (над крышей)
L.buildRect = (floors) => {
  const y = L.roofTop(floors) - L.RH + 20;
  return { x: L.cellX(0) + 40, y: y + 20, w: L.CW * 2 + 120, h: L.RH - 40 };
};

// Раскладка мебели по стадиям комнаты: окно, спальные места, места на полу, где сесть.
const ROOM_LAYOUT = {
  1: { win: [118, 20, 46, 40], beds: [[157, 117]], floor: [[86, 141]], sit: [] },
  2: { win: [50, 18, 40, 34], beds: [[123, 113], [123, 77], [173, 113], [173, 77]], floor: [[72, 141]], sit: [] },
  3: { win: [50, 18, 40, 32], beds: [[121, 115], [173, 113], [173, 77]], floor: [[70, 141], [120, 141]], sit: [] },
  4: { win: [50, 16, 40, 30], beds: [[121, 115], [173, 113], [173, 77]], floor: [[58, 141], [120, 141]], sit: [] },
  5: { win: [112, 22, 30, 26], beds: [[128, 115], [173, 113], [173, 77]], floor: [[52, 141], [96, 141]], sit: [[78, 137]] },
};
