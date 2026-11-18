// A térképszerkesztő oldalpanelje (szobák és bútorok).

import { el, ICONS } from './util.js';
import * as map from './map.js';
import { CATALOG, CATEGORIES, previewSVG, sampleOffice } from './furniture.js';

let panel = null;
let hooks = {};
let cat = 'office';

const FLOORS = [['none', 'Nincs (csak szín)'], ['wood', 'Parketta'], ['carpet', 'Szőnyegpadló'], ['tile', 'Csempe'], ['concrete', 'Beton'], ['grass', 'Fű']];

export function initEditor(container, h) {
  hooks = h;
  panel = el('div', { class: 'edit-panel card hidden' });
  container.append(panel);
}

export function open() {
  map.startEditing();
  panel.classList.remove('hidden');
  render(null);
}

export function close() {
  map.stopEditing();
  panel.classList.add('hidden');
  hooks.onClose?.();
}

export function render(sel) {
  const st = map.editState();
  if (!st || !panel) return;
  // a beviteli mezőben lévő fókuszt megtartjuk gépelés közben
  const active = document.activeElement;
  if (active && panel.contains(active) && active.matches('input[type=text], input:not([type])') && sel && sel === panel._sel) return;
  panel._sel = sel;
  panel.innerHTML = '';
  panel.append(
    el('div', { class: 'tabs' },
      el('button', { class: `tab ${st.tab === 'items' ? 'active' : ''}`, onclick: () => map.setTab('items') }, 'Bútorok'),
      el('button', { class: `tab ${st.tab === 'zones' ? 'active' : ''}`, onclick: () => map.setTab('zones') }, 'Szobák')));

  if (st.tab === 'items') renderItemsTab(st, sel);
  else renderZonesTab(st, sel);

  panel.append(el('div', { class: 'edit-foot' },
    el('p', { class: 'muted-text small' }, 'Billentyűk: R forgatás, Del törlés, ⌘/Ctrl+D másolás, nyilak finom mozgatás (Shift: 10 px), Alt húzás közben: rács nélkül.'),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => close() }, 'Mégse'),
      el('button', { class: 'btn primary', onclick: async () => { if (await map.saveEditing()) { panel.classList.add('hidden'); hooks.onSaved?.(); } } }, 'Mentés'))));
}

function renderItemsTab(st, sel) {
  const cats = el('div', { class: 'chips' }, CATEGORIES.map(([id, label]) =>
    el('button', { class: `chip ${cat === id ? 'active' : ''}`, onclick: () => { cat = id; render(sel); } }, label)));
  const grid = el('div', { class: 'palette' });
  for (const [type, def] of Object.entries(CATALOG)) {
    if (def.cat !== cat) continue;
    grid.append(el('button', { class: 'pal-item', title: def.label, onclick: () => map.addItem(type) },
      el('span', { class: 'pal-ico', html: previewSVG(type) }), el('span', { class: 'pal-label' }, def.label)));
  }
  if (sel?.kind === 'item') {
    const it = sel.obj;
    const def = CATALOG[it.type];
    const box = el('div', { class: 'form sel-box' }, el('h4', {}, def.label));
    box.append(el('div', { class: 'row tight' },
      el('button', { class: 'btn small', title: 'Forgatás balra (Shift+R)', onclick: () => map.rotateSelected(-90) }, '⟲'),
      el('button', { class: 'btn small', title: 'Forgatás jobbra (R)', onclick: () => map.rotateSelected(90) }, '⟳'),
      el('button', { class: 'btn small', title: 'Másolás (⌘/Ctrl+D)', onclick: () => map.duplicateSelected() }, 'Másolat'),
      el('button', { class: 'btn small', title: 'Előre', onclick: () => map.reorderSelected(1) }, 'Előre'),
      el('button', { class: 'btn small', title: 'Hátra', onclick: () => map.reorderSelected(-1) }, 'Hátra')));
    if (def.hasLabel) {
      box.append(el('label', {}, 'Szöveg', el('input', { type: 'text', value: it.label || '', maxlength: 64, oninput: (e) => { it.label = e.target.value; map.refreshEdit(); } })));
    }
    if (def.tint) {
      box.append(el('label', { class: 'inline' }, 'Szín: ', el('input', { type: 'color', value: it.color || def.tint, oninput: (e) => { it.color = e.target.value; map.refreshEdit(); } }),
        it.color ? el('button', { class: 'btn small link', onclick: () => { it.color = ''; map.refreshEdit(); render(sel); } }, 'alapszín') : null));
    }
    if (def.resizable) box.append(el('p', { class: 'muted-text small' }, 'Méret: húzd a jobb alsó sarkát.'));
    box.append(el('button', { class: 'btn danger block small', onclick: () => map.deleteSelected(), html: `${ICONS.trash}<span>Törlés</span>` }));
    panel.append(box);
  }
  panel.append(el('p', { class: 'muted-text small' }, 'Kattints egy tárgyra a hozzáadáshoz, majd húzd a helyére.'), cats, grid);

  panel.append(el('div', { class: 'row' },
    el('button', {
      class: 'btn small', onclick: () => {
        if (confirm('Betöltöd a mintairodát? Ez lecseréli a szobákat és a bútorokat ebben a szerkesztésben (mentés előtt még visszavonható a Mégse gombbal).')) map.loadTemplate(sampleOffice());
      },
    }, 'Mintairoda betöltése'),
    el('button', { class: 'btn small danger', onclick: () => { if (confirm('Minden bútort törölsz?')) map.clearItems(); } }, 'Bútorok törlése')));
}

function renderZonesTab(st, sel) {
  panel.append(
    el('p', { class: 'muted-text small' }, 'Húzd a szobákat a mozgatáshoz, a jobb alsó sarkukat az átméretezéshez. A beszélgetős szobában a bent lévők hallják egymást.'),
    el('button', { class: 'btn block', onclick: () => map.addZone(), html: `${ICONS.plus}<span>Új szoba</span>` }));
  if (sel?.kind === 'zone') {
    const z = sel.obj;
    const kind = el('select', { onchange: (e) => { z.kind = e.target.value; map.refreshEdit(); } },
      el('option', { value: 'talk' }, 'Beszélgetős'), el('option', { value: 'quiet' }, 'Csendes (senki nem hall senkit)'));
    kind.value = z.kind;
    const floor = el('select', { onchange: (e) => { z.floor = e.target.value; map.refreshEdit(); } }, FLOORS.map(([v, l]) => el('option', { value: v }, l)));
    floor.value = z.floor || 'none';
    panel.append(el('div', { class: 'form sel-box' },
      el('h4', {}, 'Kijelölt szoba'),
      el('label', {}, 'Név', el('input', { type: 'text', value: z.name, maxlength: 64, oninput: (e) => { z.name = e.target.value; map.refreshEdit(); } })),
      el('label', {}, 'Típus', kind),
      el('label', {}, 'Padló', floor),
      el('label', { class: 'inline' }, 'Szín: ', el('input', { type: 'color', value: z.color, oninput: (e) => { z.color = e.target.value; map.refreshEdit(); } })),
      el('div', { class: 'row tight' },
        el('button', { class: 'btn small', onclick: () => map.duplicateSelected() }, 'Másolat'),
        el('button', { class: 'btn small danger', onclick: () => map.deleteSelected(), html: `${ICONS.trash}<span>Törlés</span>` }))));
  }
  const wIn = el('input', { type: 'number', value: st.world.w, min: 600, max: 6000, step: 50 });
  const hIn = el('input', { type: 'number', value: st.world.h, min: 400, max: 6000, step: 50 });
  const sizeChange = () => map.setWorldSize(Number(wIn.value), Number(hIn.value));
  wIn.addEventListener('change', sizeChange);
  hIn.addEventListener('change', sizeChange);
  panel.append(el('div', { class: 'form' }, el('h4', {}, 'Térkép mérete'), el('div', { class: 'row' }, el('label', {}, 'Szélesség', wIn), el('label', {}, 'Magasság', hIn))));
}
