// Mintairoda: egymás melletti szobák közös falakkal, folyosóval, ajtókkal,
// ablakokkal és boltívekkel, berendezve. Az alap térképmérethez (1600×1000).

import { CATALOG, newUid } from './furniture.js';

const T = 14; // falvastagság

export function sampleOffice() {
  const items = [];
  const add = (type, x, y, extra = {}) => {
    const d = CATALOG[type];
    const it = { uid: newUid(), type, x, y, w: d.w, h: d.h, rot: 0, color: '', label: '', url: '', ...extra };
    items.push(it);
    return it;
  };
  // vízszintes elem (fal, ajtó, ablak, boltív) x1..x2 között, y magasságban
  const H = (type, x1, x2, y, extra = {}) => add(type, x1, y, { w: x2 - x1, h: extra.h || CATALOG[type].h, ...extra });
  // függőleges elem: elforgatva, hogy a befoglaló doboza x..x+vastagság, y1..y2 legyen
  const V = (type, x, y1, y2, extra = {}) => {
    const th = extra.h || CATALOG[type].h;
    const len = y2 - y1;
    const cx = x + th / 2, cy = (y1 + y2) / 2;
    return add(type, Math.round(cx - len / 2), Math.round(cy - th / 2), { w: len, h: th, rot: 90, ...extra });
  };

  // ------------------------------------------------ külső falak
  H('wall', 40, 1560, 40, { h: T });
  H('wall', 40, 1300, 946, { h: T });
  H('fence', 1300, 1560, 948);
  V('wall', 40, 54, 487, { h: T });
  V('door', 40, 487, 547, { h: T, label: 'Bejárat' });
  V('wall', 40, 547, 946, { h: T });
  V('wall', 1546, 54, 574, { h: T });
  V('fence', 1548, 574, 946);

  // ------------------------------------------------ felső szobák alsó fala (folyosó felé)
  H('wall', 54, 370, 460, { h: T });
  H('door', 370, 430, 460, { h: T });
  H('wall', 430, 930, 460, { h: T });
  H('door', 930, 990, 460, { h: T });
  H('wall', 990, 1320, 460, { h: T });
  H('door', 1320, 1380, 460, { h: T });
  H('wall', 1380, 1546, 460, { h: T });

  // ------------------------------------------------ alsó szobák felső fala (folyosó felé)
  H('wall', 54, 230, 560, { h: T });
  H('door', 230, 290, 560, { h: T });
  H('wall', 290, 620, 560, { h: T });
  H('arch', 620, 760, 560, { h: T });
  H('wall', 760, 1090, 560, { h: T });
  H('double_door', 1090, 1190, 560, { h: T });
  H('wall', 1190, 1380, 560, { h: T });
  H('arch', 1380, 1480, 560, { h: T });
  H('wall', 1480, 1546, 560, { h: T });

  // ------------------------------------------------ belső függőleges falak
  V('wall', 760, 54, 140, { h: T });
  V('glass_wall', 762, 140, 300, { h: 10 });
  V('wall', 760, 300, 460, { h: T });
  V('wall', 1150, 54, 460, { h: T });
  V('wall', 480, 574, 690, { h: T });
  V('arch', 480, 690, 790, { h: T });
  V('wall', 480, 790, 946, { h: T });
  V('wall', 980, 574, 946, { h: T });
  V('wall', 1300, 574, 780, { h: T });
  V('door', 1300, 780, 840, { h: T });
  V('wall', 1300, 840, 946, { h: T });

  // ------------------------------------------------ ablakok a külső falakon
  H('window', 230, 330, 40, { h: T });
  H('window', 530, 630, 40, { h: T });
  H('window', 790, 880, 40, { h: T });
  H('window', 1250, 1450, 40, { h: T });
  H('window', 600, 760, 946, { h: T });
  H('window', 1060, 1220, 946, { h: T });
  V('window', 40, 200, 320, { h: T });
  V('window', 40, 690, 790, { h: T });

  // ================================================ Közös iroda
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 110 + col * 220, y = 130 + row * 170;
      add('desk', x, y);
      add('monitor', x + 16, y + 2);
      add('laptop', x + 74, y + 18);
      if ((row + col) % 2 === 0) add('mug', x + 104, y + 10, { color: ['#ef4444', '#3b82f6', '#22c55e'][col] });
      else add('cactus', x + 100, y + 4);
      add('office_chair', x + 43, y + 64, { rot: 180 });
    }
  }
  add('desk_lamp', 112, 132);
  add('desk_phone', 336, 140);
  add('bookshelf', 64, 58, { w: 150 });
  add('whiteboard', 350, 58, { w: 160 });
  add('cabinet', 700, 58);
  add('printer', 705, 250);
  add('shredder', 712, 300);
  add('big_plant', 700, 390);
  add('plant', 64, 405);
  add('coat_rack', 450, 420);
  add('trash', 340, 432);
  add('wall_calendar', 640, 58);
  add('clock', 260, 60);

  // ================================================ Tárgyaló
  add('tv', 910, 58);
  add('meeting_table', 862, 200);
  for (let i = 0; i < 3; i++) {
    add('chair', 887 + i * 60, 162, { color: '#334155' });
    add('chair', 887 + i * 60, 296, { color: '#334155', rot: 180 });
  }
  add('chair', 826, 229, { color: '#334155', rot: 270 });
  add('chair', 1068, 229, { color: '#334155', rot: 90 });
  add('laptop', 884, 222);
  add('papers', 1000, 238);
  add('desk_phone', 950, 214);
  add('plant', 1100, 62);
  add('monstera', 1095, 395);
  add('projector_screen', 780, 400, { w: 110, rot: 0 });

  // ================================================ Fókusz (csendes szoba)
  for (let i = 0; i < 3; i++) {
    add('desk_white', 1185 + i * 115, 110, { w: 100 });
    add('laptop', 1220 + i * 115, 124);
    add('office_chair', 1218 + i * 115, 172, { rot: 180 });
  }
  add('bonsai', 1192, 116);
  add('yoga_mat', 1480, 260);
  add('armchair', 1190, 330, { rot: 270 });
  add('floor_lamp', 1250, 340);
  add('bookshelf', 1300, 410, { w: 120, rot: 0 });
  add('big_plant', 1480, 385);
  add('mirror', 1505, 62);

  // ================================================ Folyosó
  add('corkboard', 470, 476, { w: 90 });
  add('suggestion_box', 1060, 478);
  add('water_cooler', 1250, 478);
  add('plant', 1500, 520);
  add('coat_rack', 62, 482);
  add('trophy', 820, 482);
  add('label', 640, 500, { w: 130, h: 26, label: '← Bejárat · Folyosó →', color: '#1e293b' });

  // ================================================ Konyha
  add('kitchen_counter', 60, 896, { w: 300 });
  add('microwave', 150, 900);
  add('toaster', 200, 902);
  add('kettle', 245, 902);
  add('coffee_machine', 290, 900);
  add('fridge', 368, 893);
  add('sink', 420, 900);
  add('vending_machine', 58, 836);
  add('round_table', 100, 650);
  add('chair', 124, 612, { color: '#f97316' });
  add('chair', 124, 732, { color: '#f97316', rot: 180 });
  add('chair', 62, 674, { color: '#f97316', rot: 270 });
  add('chair', 186, 674, { color: '#f97316', rot: 90 });
  add('pizza_box', 122, 672);
  add('dining_table', 290, 690, { w: 120, h: 60 });
  add('bar_stool', 305, 660);
  add('bar_stool', 365, 660);
  add('bar_stool', 305, 755);
  add('bar_stool', 365, 755);
  add('fruit_bowl', 300, 702);
  add('cookie_jar', 375, 700);
  add('trash', 455, 860);
  add('plant', 430, 590);

  // ================================================ Pihenő
  add('rug', 560, 700, { w: 240, h: 170, color: '#be185d' });
  add('sofa', 600, 880, { w: 160, rot: 180 });
  add('armchair', 528, 765, { rot: 270, color: '#0d9488' });
  add('armchair', 808, 765, { rot: 90, color: '#0d9488' });
  add('coffee_table', 645, 790);
  add('radio', 662, 795);
  add('fireplace', 830, 902);
  add('aquarium', 885, 600);
  add('tv', 770, 578, { w: 100, h: 56 });
  add('beanbag', 515, 600, { color: '#f59e0b' });
  add('cat', 700, 730);
  add('guitar', 952, 690);
  add('floor_lamp', 508, 885);
  add('big_plant', 922, 820);
  add('hammock', 820, 690, { rot: 90 });

  // ================================================ Játékterem
  add('dance_floor', 1004, 600, { w: 110, h: 100 });
  add('disco_ball', 1045, 630);
  add('pingpong', 1060, 755);
  add('arcade', 1236, 590);
  add('dartboard', 998, 720);
  add('foosball', 1010, 872);
  add('piano', 1170, 896);
  add('gong', 1252, 690);
  add('confetti_cannon', 1262, 640);
  add('balloon', 1012, 590, { color: '#ec4899' });
  add('balloon', 1028, 594, { color: '#22d3ee' });
  add('cake', 1220, 640);
  add('neon_sign', 1130, 712, { w: 120, h: 26, label: 'GAME ON' });
  add('treadmill', 1250, 760);

  // ================================================ Terasz
  add('tree', 1460, 590);
  add('grill', 1330, 590);
  add('parasol_table', 1340, 690);
  add('lounge_chair', 1470, 690);
  add('fountain', 1400, 805);
  add('flower_bed', 1325, 905);
  add('bush', 1460, 906);
  add('dog', 1330, 790);

  const zones = [
    { id: 0, name: 'Közös iroda', kind: 'talk', x: 54, y: 54, w: 706, h: 406, color: '#34d399', floor: 'wood' },
    { id: 0, name: 'Tárgyaló', kind: 'talk', x: 774, y: 54, w: 376, h: 406, color: '#60a5fa', floor: 'carpet' },
    { id: 0, name: 'Fókusz (csend)', kind: 'quiet', x: 1164, y: 54, w: 382, h: 406, color: '#a78bfa', floor: 'carpet' },
    { id: 0, name: 'Konyha', kind: 'talk', x: 54, y: 574, w: 426, h: 372, color: '#fb923c', floor: 'tile' },
    { id: 0, name: 'Pihenő', kind: 'talk', x: 494, y: 574, w: 486, h: 372, color: '#f472b6', floor: 'carpet' },
    { id: 0, name: 'Játékterem', kind: 'talk', x: 994, y: 574, w: 306, h: 372, color: '#facc15', floor: 'concrete' },
    { id: 0, name: 'Terasz', kind: 'talk', x: 1314, y: 574, w: 232, h: 372, color: '#4ade80', floor: 'grass' },
  ];
  return { zones, items, world: { w: 1600, h: 1000 } };
}
