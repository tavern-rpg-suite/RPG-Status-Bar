import { getContext, extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced, setExtensionPrompt, extension_prompt_roles, characters } from '../../../../script.js';

const MODULE_NAME = 'rpg_equipment';
const PROMPT_KEY = 'rpg_equipment_injection';
const SLOTS = ['head', 'top', 'bottom', 'boots', 'accessory', 'weapon'];
const SLOT_ICONS = { head: 'fa-hat-cowboy', top: 'fa-shirt', bottom: 'fa-person', boots: 'fa-shoe-prints', accessory: 'fa-gem', weapon: 'fa-khanda' };
// base stats a fresh item in each slot is worth; armor mitigates damage, weapon adds attack.
const SLOT_BASE_ARMOR = { head: 3, top: 6, bottom: 4, boots: 3, accessory: 1, weapon: 0 };
const SLOT_BASE_ATTACK = { weapon: 8 };

const defaultSettings = {
    enabled: false,
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: 'google/gemma-4-31b-it',
    temperature: 0.8,
    language: 'en',
    decayEvery: 8,
    decayAmount: 10,
    patchChance: 35,
    patchWear: 5,
    affectHp: true,
    injectStats: true,
    autoWear: false,
    injectDepth: 1,
    aiCheckEquip: true,
    chatStates: {}
};

let settings = {};
let state = null;
let editMode = false;
let pendingSlot = null;
let detailSlot = null;

function genId() { return Math.random().toString(36).substr(2, 9); }

function escapeHtml(x) {
    return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function genLang() { return settings.language === 'ru' ? 'Russian' : 'English'; }

const I18N = {
    en: {
        btn_title: 'Outfit & Gear', panel_title: 'Outfit & Gear',
        slot_head: 'Head', slot_top: 'Top', slot_bottom: 'Bottom', slot_boots: 'Boots', slot_accessory: 'Accessory', slot_weapon: 'Weapon',
        empty: '(empty)', detail_hint: 'Tap a slot to manage it.', equip: 'Equip', empty_hint: 'Equip from your backpack — or turn on Edit mode to add one by hand.', close: 'Close',
        case_no: 'CASE №', stamp_1: 'PROPERTY', stamp_2: 'INVENTORY', memo_lbl: 'FROM THE CASE FILES', subject_default: 'SUBJECT',
        dossier_hint_k: 'EVIDENCE', dossier_hint_n: 'Pick an exhibit', slot_empty_title: 'Slot not filled', slot_empty_desc: 'Nothing logged in this category yet. Pick an item and a new photo joins the file.', gm_actions: 'EDIT THE FILE',
        from_backpack: 'Wear from backpack:', pick_item: '— pick an item —', or_new: '— or add a new item —',
        unequip: 'Unequip → backpack', discard: 'Discard',
        toast_unequipped: 'Moved to backpack: {name}.', toast_discarded: 'Item discarded.',
        set_aicheck: 'AI-check what you put on', toast_checking: 'Checking the fit...', toast_wrong_slot: "{name} can't go in the {slot} slot: {reason}", save: 'Save', cancel: 'Cancel',
        name_ph: 'Item name', desc_ph: 'Short description (optional)', max_ph: 'Max', dur_ph: 'Durability',
        patch: 'Patch', repair: 'Repair', remove: 'Remove',
        edit_mode: 'Edit mode', auto_outfit: 'Outfit from my description',
        state_good: 'good', state_worn: 'worn', state_tattered: 'tattered', state_broken: 'BROKEN',
        inject_wearing: "{{user}}'s current outfit", inject_see: '{{char}} can see this',
        toast_equipped: 'Equipped: {name}', toast_removed: 'Slot cleared.',
        toast_patch_ok: 'Field patch held! +{n} durability.', toast_patch_fail: 'The patch did not hold.',
        toast_repaired: 'Repaired: {name}.', toast_broke: '{name} broke!',
        repair_with: 'Repair with an item:', pick_material: '— pick a material —', do_repair: 'Use item to repair',
        no_inv_repair: 'Enable the inventory module to repair with items.', no_materials: 'Your backpack is empty.',
        rep_checking: 'Trying to mend it...', rep_rejected: "Can't fix it with {item}: {reason}",
        rep_ok: 'Mended {gear} with {item} (+{n}%). {reason}', rep_poor: 'A rough fix with {item} (+{n}%). {reason}',
        rep_used_up: '{item} is used up.', rep_left: '{item}: {n}% left.', rep_err: 'Repair failed — check URL / key / model.',
        stat_armor: 'Armor', stat_attack: 'Attack',
        inject_defense: 'Armor rating ~{def}', inject_weapon: 'wielding {name} (attack {atk})', inject_unarmed: 'unarmed',
        toast_outfit_gen: 'AI is putting together an outfit...', toast_outfit_done: 'Outfit generated!',
        toast_outfit_err: 'Could not generate an outfit — check URL / key / model.',
        toast_need_name: 'Enter an item name.',
        set_title: 'RPG Equipment (Outfit & Durability)', set_enable: 'Enable Equipment',
        set_api: 'API Settings', set_logic: 'Durability',
        set_decay_every: 'Durability drops every (messages):', set_decay_amount: 'Durability lost each time:',
        set_patch: 'Field-patch success chance (%):', set_depth: 'Context injection depth:',
        set_patchwear: 'Max durability lost per field-patch:', set_affecthp: 'Armor reduces incoming damage (HP)', set_injectstats: 'Add armor/weapon stats to the prompt', set_autowear: 'AI wears gear from the story (damages the item the scene hits)', wear_changed: 'Wear:',
        set_lang: 'Language:', set_url: 'URL', set_key: 'API Key', set_model: 'Model'
    },
    ru: {
        btn_title: 'Экипировка', panel_title: 'Экипировка',
        slot_head: 'Голова', slot_top: 'Верх', slot_bottom: 'Низ', slot_boots: 'Обувь', slot_accessory: 'Аксессуар', slot_weapon: 'Оружие',
        empty: '(пусто)', detail_hint: 'Нажми на слот, чтобы управлять им.', equip: 'Надеть', empty_hint: 'Надевай из рюкзака — или включи режим редактирования, чтобы добавить вручную.', close: 'Закрыть',
        case_no: 'ДЕЛО №', stamp_1: 'ОПИСЬ', stamp_2: 'ИМУЩЕСТВА', memo_lbl: 'ПО МАТЕРИАЛАМ ДЕЛА', subject_default: 'СУБЪЕКТ',
        dossier_hint_k: 'УЛИКА', dossier_hint_n: 'Выбери улику', slot_empty_title: 'Слот не заполнен', slot_empty_desc: 'По этой категории в опись ничего не занесено. Подбери предмет — и в дело добавится новая фотография.', gm_actions: 'ПРАВКА ДЕЛА',
        from_backpack: 'Надеть из рюкзака:', pick_item: '— выбери предмет —', or_new: '— или добавить новый —',
        unequip: 'Снять → в рюкзак', discard: 'Выбросить',
        toast_unequipped: 'В рюкзак: {name}.', toast_discarded: 'Предмет выброшен.',
        set_aicheck: 'Проверять надевание через ИИ', toast_checking: 'Проверяю, подходит ли...', toast_wrong_slot: 'Нельзя надеть «{name}» в слот «{slot}»: {reason}', save: 'Сохранить', cancel: 'Отмена',
        name_ph: 'Название', desc_ph: 'Краткое описание (необязательно)', max_ph: 'Макс', dur_ph: 'Прочность',
        patch: 'Заплатка', repair: 'Починить', remove: 'Снять',
        edit_mode: 'Режим редактирования', auto_outfit: 'Наряд из моего описания',
        state_good: 'целое', state_worn: 'потёртое', state_tattered: 'ветхое', state_broken: 'СЛОМАНО',
        inject_wearing: 'Текущий наряд {{user}}', inject_see: '{{char}} это видит',
        toast_equipped: 'Надето: {name}', toast_removed: 'Слот очищен.',
        toast_patch_ok: 'Заплатка держится! +{n} прочности.', toast_patch_fail: 'Заплатка не удержалась.',
        toast_repaired: 'Починено: {name}.', toast_broke: '{name} сломалось!',
        repair_with: 'Починить предметом:', pick_material: '— выбери материал —', do_repair: 'Чинить предметом',
        no_inv_repair: 'Включи модуль инвентаря, чтобы чинить предметами.', no_materials: 'Рюкзак пуст.',
        rep_checking: 'Пробую починить...', rep_rejected: 'Нельзя починить с помощью «{item}»: {reason}',
        rep_ok: 'Починил {gear} с помощью «{item}» (+{n}%). {reason}', rep_poor: 'Кое-как залатал «{item}» (+{n}%). {reason}',
        rep_used_up: '«{item}» израсходован.', rep_left: '«{item}»: осталось {n}%.', rep_err: 'Починка не удалась — проверь URL / ключ / модель.',
        stat_armor: 'Броня', stat_attack: 'Урон',
        inject_defense: 'Защита ~{def}', inject_weapon: 'в руках {name} (урон {atk})', inject_unarmed: 'без оружия',
        toast_outfit_gen: 'ИИ подбирает наряд...', toast_outfit_done: 'Наряд подобран!',
        toast_outfit_err: 'Не удалось подобрать наряд — проверь URL / ключ / модель.',
        toast_need_name: 'Введите название предмета.',
        set_title: 'RPG Equipment (экипировка и прочность)', set_enable: 'Включить экипировку',
        set_api: 'Настройки API', set_logic: 'Прочность',
        set_decay_every: 'Прочность падает каждые (сообщений):', set_decay_amount: 'Сколько прочности теряется за раз:',
        set_patch: 'Шанс успеха заплатки (%):', set_depth: 'Глубина вставки в контекст:',
        set_patchwear: 'Потеря макс. прочности за заплатку:', set_affecthp: 'Броня снижает входящий урон (HP)', set_injectstats: 'Добавлять статы брони/оружия в подсказку', set_autowear: 'ИИ изнашивает экипировку по сюжету (снимает с той вещи, что задело)', wear_changed: 'Износ:',
        set_lang: 'Язык:', set_url: 'URL', set_key: 'API-ключ', set_model: 'Модель'
    }
};
function t(key, vars) {
    const lang = settings.language === 'ru' ? 'ru' : 'en';
    let str = (I18N[lang] && I18N[lang][key] !== undefined) ? I18N[lang][key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
    if (vars) for (const k in vars) str = str.split('{' + k + '}').join(vars[k]);
    return str;
}

function loadSettings() {
    if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = {};
    settings = Object.assign({}, defaultSettings, extension_settings[MODULE_NAME]);
    if (!settings.chatStates) settings.chatStates = {};
}
function saveSettings() {
    extension_settings[MODULE_NAME] = settings;
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
}

function freshState() {
    return { slots: { head: null, top: null, bottom: null, boots: null, accessory: null, weapon: null }, msgCount: 0 };
}
function loadState() {
    const chatId = getContext().chatId;
    if (!chatId) { state = freshState(); return; }
    if (settings.chatStates[chatId]) {
        state = settings.chatStates[chatId];
        if (!state.slots) state.slots = freshState().slots;
        for (const s of SLOTS) if (!(s in state.slots)) state.slots[s] = null;
        if (typeof state.msgCount !== 'number') state.msgCount = 0;
    } else {
        state = freshState();
        settings.chatStates[chatId] = state;
    }
}
function saveState() {
    const chatId = getContext().chatId;
    if (chatId) settings.chatStates[chatId] = state;
    saveSettings();
}

async function callAI(systemPrompt, userPrompt) {
    if (!settings.apiKey) throw new Error('API key is not set');
    const url = (settings.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';
    for (let i = 0; i < 2; i++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${settings.apiKey.trim()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                    temperature: settings.temperature,
                    response_format: { type: 'json_object' }
                })
            });
            if (res.status === 429 && i === 0) { await new Promise(r => setTimeout(r, 2000)); continue; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const content = data.choices[0].message.content.trim();
            const m = content.match(/\{[\s\S]*\}/);
            return JSON.parse(m ? m[0] : content);
        } catch (e) { if (i === 1) throw e; }
    }
}

// ---- durability helpers ----
function stateWord(it) {
    if (it.broken || it.dur <= 0) return t('state_broken');
    const r = it.dur / (it.max || 100);
    if (r > 0.6) return t('state_good');
    if (r > 0.3) return t('state_worn');
    return t('state_tattered');
}
function durColor(it) {
    if (it.broken || it.dur <= 0) return '#9e9e9e';
    const r = it.dur / (it.max || 100);
    if (r > 0.6) return '#2e7d32';
    if (r > 0.3) return '#e0a32e';
    return '#c0392b';
}

// armor each piece still provides, scaled by how intact it is (broken = nothing)
function pieceArmor(it) {
    if (!it || it.broken || it.dur <= 0 || !it.armor) return 0;
    return Math.round(it.armor * (it.dur / (it.max || 100)));
}
function totalDefense() {
    if (!state) return 0;
    let d = 0;
    for (const s of SLOTS) if (s !== 'weapon') d += pieceArmor(state.slots[s]);
    return d;
}
function weaponInfo() {
    if (!state) return null;
    const it = state.slots.weapon;
    if (!it) return null;
    const atk = (it.broken || it.dur <= 0 || !it.attack) ? 0 : Math.round(it.attack * (it.dur / (it.max || 100)));
    return { name: it.name, atk, broken: !!it.broken || it.dur <= 0 };
}

// a blow in combat wears the armour that took it (called by Vitals' damage())
function combatWearArmor(raw) {
    if (!state) return;
    const amt = Math.min(20, Math.max(1, Math.round((Math.abs(raw) || 0) * 0.4)));
    const worn = SLOTS.filter(s => s !== 'weapon' && state.slots[s] && !state.slots[s].broken && state.slots[s].dur > 0 && (state.slots[s].armor || 0) > 0);
    if (!worn.length) return;
    const s = worn[Math.floor(Math.random() * worn.length)];
    const it = state.slots[s];
    it.dur = Math.max(0, it.dur - amt);
    if (it.dur <= 0) { it.dur = 0; it.broken = true; toastr.warning(t('toast_broke', { name: it.name })); }
    saveState(); renderPanel(); buildInjection();
}

function decayTick(messageId) {
    if (!settings.enabled || !state) return;
    if (settings.autoWear) return; // AI narrative wear replaces the blind timer decay
    const msg = getContext().chat[messageId];
    if (!msg || msg.is_user || msg.is_system) return;
    state.msgCount = (state.msgCount || 0) + 1;
    const every = Math.max(1, settings.decayEvery || 8);
    if (state.msgCount % every !== 0) { saveState(); return; }

    let broke = null;
    for (const s of SLOTS) {
        const it = state.slots[s];
        if (!it || it.broken) continue;
        it.dur = Math.max(0, it.dur - (settings.decayAmount || 10));
        if (it.dur <= 0) { it.broken = true; broke = it.name; }
    }
    saveState();
    renderPanel();
    buildInjection();
    if (broke) toastr.warning(t('toast_broke', { name: broke }));
}

async function analyzeWear(messageId) {
    if (!settings.enabled || !settings.autoWear || !settings.apiKey || !state) return;
    const ctx = getContext();
    const msg = ctx.chat[messageId];
    if (!msg || msg.is_user || msg.is_system || !msg.mes) return;
    const worn = SLOTS.filter(s => state.slots[s] && !state.slots[s].broken)
        .map(s => `${s}: "${state.slots[s].name}" (${Math.round(state.slots[s].dur / (state.slots[s].max || 100) * 100)}%)`);
    if (!worn.length) return;
    const who = ctx.name1 || 'the player';
    try {
        const sys = `You track wear-and-tear on "${who}"'s worn clothing/gear in a roleplay. Read ONLY the latest scene and report which of "${who}"'s OWN worn items got physically damaged THIS message — burned, scorched, torn, cut, slashed, soaked, stained, frayed, etc.
Be conservative: most messages damage nothing → return an empty array. React only to clear physical damage to a SPECIFIC garment that "${who}" is wearing. Damage to anyone else's clothes does not count. Match the affected garment to the correct slot.
"${who}"'s worn items by slot:
${worn.join('\n')}
For each damaged item give its slot key and how much durability it loses (severity: a scuff/singe ~3-8, a burn/tear/cut ~12-30, severe ~40-60). Slot key must be exactly one of: head, top, bottom, boots, accessory, weapon.
Respond strictly JSON: {"wear":[{"slot":"bottom","amount":15,"reason":"<short, in ${genLang()}>"}]}`;
        const res = await callAI(sys, String(msg.mes).slice(0, 1600));
        if (!res || !Array.isArray(res.wear) || !res.wear.length) return;
        const notes = [];
        let broke = null;
        for (const w of res.wear) {
            if (!w || !SLOTS.includes(w.slot)) continue;
            const it = state.slots[w.slot];
            if (!it || it.broken) continue;
            const amt = Math.min(60, Math.max(1, parseInt(w.amount) || 0));
            it.dur = Math.max(0, it.dur - amt);
            notes.push(`${it.name} −${amt}%`);
            if (it.dur <= 0) { it.broken = true; broke = it.name; }
        }
        if (notes.length) {
            saveState(); renderPanel(); buildInjection();
            toastr.info(t('wear_changed') + ' ' + notes.join(', '));
            if (broke) toastr.warning(t('toast_broke', { name: broke }));
        }
    } catch (e) { /* silent: never disrupt chat */ }
}

function patchItem(slot) {
    const it = state.slots[slot];
    if (!it) return;
    // every patch frays the garment a little: its ceiling drops, so endless free patching is impossible
    const wear = Math.max(0, settings.patchWear || 0);
    if (wear > 0) it.max = Math.max(10, (it.max || 100) - wear);
    if (Math.random() * 100 <= (settings.patchChance || 35)) {
        const gain = Math.floor((it.max || 100) * 0.2);
        it.dur = Math.min(it.max || 100, it.dur + gain);
        it.broken = false;
        toastr.success(t('toast_patch_ok', { n: gain }));
    } else {
        it.dur = Math.min(it.max || 100, it.dur);
        toastr.error(t('toast_patch_fail'));
    }
    saveState(); renderPanel(); buildInjection();
}
function repairItem(slot) {
    const it = state.slots[slot];
    if (!it) return;
    it.dur = it.max || 100; it.broken = false;
    saveState(); renderPanel(); buildInjection();
    toastr.success(t('toast_repaired', { name: it.name }));
}
function removeSlot(slot) {
    state.slots[slot] = null;
    saveState(); renderPanel(); buildInjection();
    toastr.info(t('toast_removed'));
}
function equipSlot(slot, name, desc, max, dur) {
    const m = Math.max(1, parseInt(max) || 100);
    let d = parseInt(dur);
    if (!isFinite(d)) d = m;              // blank → full
    d = Math.max(0, Math.min(m, d));      // clamp to 0..max
    state.slots[slot] = { id: genId(), name: name, desc: desc || '', dur: d, max: m, broken: d <= 0, armor: SLOT_BASE_ARMOR[slot] || 0, attack: SLOT_BASE_ATTACK[slot] || 0 };
    pendingSlot = null;
    saveState(); renderPanel(); buildInjection();
    toastr.success(t('toast_equipped', { name }));
}

// Recognises "empty"/"none" answers the model sometimes returns for a slot,
// so we leave that slot empty instead of equipping a bogus "нет" item.
const NONE_WORDS = new Set(['', 'none', 'no', 'n/a', 'na', '-', '—', '–', 'empty', 'null', 'nothing',
    'нет', 'нету', 'ничего', 'пусто', 'отсутствует', 'не указано', 'нет данных']);
function isNoneName(name) {
    const n = String(name || '').trim().toLowerCase().replace(/[.!,;:"'()\[\]]/g, '').trim();
    if (!n) return true;
    if (NONE_WORDS.has(n)) return true;
    if (/^отсутств/.test(n)) return true;
    if (/^(нет|нету|ничего|none|no|не указан|нет данных)(\s|$)/.test(n)) return true;
    return false;
}

async function autoOutfit() {
    if (!settings.enabled) return;
    const ctx = getContext();
    let persona = '';
    try { if (typeof ctx.substituteParams === 'function') persona = ctx.substituteParams('{{persona}}') || ''; } catch (e) { persona = ''; }
    const who = ctx.name1 || 'the player';
    toastr.info(t('toast_outfit_gen'));
    try {
        const sys = `You are dressing the PLAYER character (the user, named "${who}") in an RPG — this is the USER's own gear, NOT the AI character's.
Read the player's OWN description below and identify what THEY wear and carry as clothing/gear across these slots: head, top, bottom, boots, accessory.
Fill a slot ONLY if the description clearly mentions or strongly implies an item for it. If the player has nothing for a slot (for example no headwear), leave that slot's name EMPTY ("") — do NOT invent a default, and never write placeholder words like "none" or "нет". Keep names short (1-4 words) and descriptions one short sentence.
Write ALL names and descriptions strictly in ${genLang()}.
Output strictly JSON: {"head":{"name":"","desc":""},"top":{"name":"","desc":""},"bottom":{"name":"","desc":""},"boots":{"name":"","desc":""},"accessory":{"name":"","desc":""}}`;
        const res = await callAI(sys, `${who}'s own description:\n${String(persona).substring(0, 1200)}`);
        for (const s of SLOTS) {
            const piece = res[s];
            if (piece && piece.name && !isNoneName(piece.name)) {
                state.slots[s] = { id: genId(), name: String(piece.name), desc: String(piece.desc || ''), dur: 100, max: 100, broken: false, armor: SLOT_BASE_ARMOR[s] || 0, attack: SLOT_BASE_ATTACK[s] || 0 };
            } else if (piece && isNoneName(piece.name) && state.slots[s] && isNoneName(state.slots[s].name)) {
                // clean up a previously auto-added "нет"/placeholder item
                state.slots[s] = null;
            }
        }
        saveState(); renderPanel(); buildInjection();
        toastr.success(t('toast_outfit_done'));
    } catch (e) {
        toastr.error(t('toast_outfit_err'));
    }
}

function invApi() { return (window.RPG && window.RPG.inventory && window.RPG.inventory.available) ? window.RPG.inventory : null; }
const SLOT_MEANING = {
    head: 'headwear worn on the head: hats, hoods, helmets, crowns',
    top: 'upper-body clothing/armor: shirts, tunics, coats, chestplates',
    bottom: 'lower-body clothing/armor: trousers, skirts, leg armor',
    boots: 'footwear: boots, shoes, sandals, greaves',
    accessory: 'a small worn item: jewelry, amulets, belts, gloves, glasses',
    weapon: 'a hand-held weapon or tool wielded in the hands: swords, daggers, axes, bows, staves, guns, wands'
};
async function checkSlotFit(slot, item) {
    const sys = `You check whether an item can realistically be WORN by a person in a given equipment slot.
Slot: "${t('slot_' + slot)}" — ${SLOT_MEANING[slot] || ''}.
Item: "${item.name}" (${item.desc || 'no description'}).
If a person could not sensibly wear THIS item in THIS slot (e.g. an inkwell on the legs, a sword as a hat), it is NOT ok.
Respond strictly JSON: {"ok": true/false, "reason": "<one short sentence in ${genLang()}>"}`;
    const res = await callAI(sys, 'Judge whether it fits.');
    return { ok: !!res.ok, reason: res.reason || '' };
}
async function equipFromInventory(slot, invId) {
    const inv = invApi(); if (!inv) return;
    const it = inv.list().find(i => i.id === invId);
    if (!it) return;
    if (settings.aiCheckEquip && settings.apiKey) {
        toastr.info(t('toast_checking'));
        try {
            const fit = await checkSlotFit(slot, it);
            if (!fit.ok) { toastr.warning(t('toast_wrong_slot', { name: it.name, slot: t('slot_' + slot), reason: fit.reason })); return; }
        } catch (e) { /* if the check fails, don't block the player */ }
    }
    const max = (typeof it.max === 'number') ? it.max : 100;
    const dur = (typeof it.dur === 'number') ? it.dur : max;
    state.slots[slot] = { id: genId(), name: it.name, desc: it.desc || '', type: it.type, dur: dur, max: max, broken: !!it.broken || dur <= 0, armor: (typeof it.armor === 'number') ? it.armor : (SLOT_BASE_ARMOR[slot] || 0), attack: (typeof it.attack === 'number') ? it.attack : (SLOT_BASE_ATTACK[slot] || 0) };
    inv.remove(invId);
    pendingSlot = null; detailSlot = slot;
    saveState(); renderPanel(); buildInjection();
    toastr.success(t('toast_equipped', { name: it.name }));
}
async function repairWithItem(slot, invId) {
    const inv = invApi(); if (!inv) { toastr.warning(t('no_inv_repair')); return; }
    const gear = state.slots[slot];
    const mat = inv.list().find(i => i.id === invId);
    if (!gear || !mat) return;
    toastr.info(t('rep_checking'));
    try {
        const sys = `You are the logic arbiter for repairing worn gear with a material.
Item to repair: "${gear.name}" (${gear.desc || 'no description'}) — currently ${gear.broken ? 'BROKEN' : 'damaged'}.
Offered material/tool: "${mat.name}" (${mat.desc || 'no description'}).
Decide REALISTICALLY whether this material/tool could plausibly mend THIS item (e.g. needle & thread mend cloth; a whetstone/metal mend a blade; an inkwell cannot fix boots).
If logical, choose how much durability a FULL fresh use would restore.
Respond strictly JSON: {"logical": true/false, "amount": <integer 0-100>, "reason": "<one short sentence in ${genLang()}>"}`;
        const res = await callAI(sys, 'Judge the repair attempt.');
        if (!res.logical) { toastr.warning(t('rep_rejected', { item: mat.name, reason: res.reason || '' })); return; }

        const cond = (typeof mat.cond === 'number') ? mat.cond : 100;           // material's own condition 0-100
        const baseChance = (typeof mat.chance === 'number') ? mat.chance : 60;  // its success rating
        const effChance = Math.max(5, Math.round(baseChance * (cond / 100)));   // worn tool is less reliable
        const aiAmt = Math.max(1, Math.min(100, parseInt(res.amount) || 25));
        const good = (Math.random() * 100) <= effChance;
        // never a full repair: partial, scaled by the material's remaining condition
        const factor = (good ? 0.6 : 0.25) * (cond / 100);
        const restore = Math.max(1, Math.round(aiAmt * factor));

        if (window.RPG && window.RPG.equipment) window.RPG.equipment.repair(slot, restore);
        else { gear.dur = Math.min(gear.max || 100, gear.dur + Math.round((gear.max || 100) * restore / 100)); if (gear.dur > 0) gear.broken = false; }

        // wear the material; delete it at 0
        const wearPerUse = 34; // ~3 uses from a fresh material
        const r = inv.consumeAsMaterial(invId, wearPerUse);
        const tail = r.consumed ? t('rep_used_up', { item: mat.name }) : t('rep_left', { item: mat.name, n: r.left });
        toastr.success(t(good ? 'rep_ok' : 'rep_poor', { gear: gear.name, item: mat.name, n: restore, reason: (res.reason || '') }) + ' ' + tail);
        saveState(); renderPanel(); buildInjection();
    } catch (e) { toastr.error(t('rep_err')); }
}
function unequipToInventory(slot) {
    const it = state.slots[slot]; if (!it) return;
    const inv = invApi();
    if (inv) { inv.add({ name: it.name, desc: it.desc, type: it.type, dur: it.dur, max: it.max, broken: it.broken, armor: it.armor, attack: it.attack }); toastr.success(t('toast_unequipped', { name: it.name })); }
    else { toastr.info(t('toast_discarded')); }
    state.slots[slot] = null; detailSlot = null;
    saveState(); renderPanel(); buildInjection();
}
function discardSlot(slot) {
    state.slots[slot] = null; detailSlot = null;
    saveState(); renderPanel(); buildInjection();
    toastr.info(t('toast_discarded'));
}
function buildInjection() {
    if (!settings.enabled || !state || settings.injectDepth < 0) {
        setExtensionPrompt(PROMPT_KEY, '', 2, 0, false, extension_prompt_roles.SYSTEM);
        return;
    }
    const parts = [];
    for (const s of SLOTS) {
        const it = state.slots[s];
        if (it) parts.push(`${t('slot_' + s)}: ${it.name} (${stateWord(it)})`);
    }
    let text = '';
    if (parts.length) {
        const extra = [];
        if (settings.injectStats !== false) {
            if (settings.affectHp) { const def = totalDefense(); if (def > 0) extra.push(t('inject_defense', { def })); }
            const w = weaponInfo();
            if (w && w.atk > 0) extra.push(t('inject_weapon', { name: w.name, atk: w.atk }));
        }
        const tail = extra.length ? ` (${extra.join('; ')})` : '';
        text = `\n[${t('inject_wearing')} — ${parts.join('; ')}.${tail} ${t('inject_see')}.]\n`;
    }
    setExtensionPrompt(PROMPT_KEY, text, 2, settings.injectDepth, false, extension_prompt_roles.SYSTEM);
}

// ---- UI ----
function renderButton() {
    if ($('#rpg-eq-btn').length === 0) {
        $('body').append(`<div class="rpg-floating-btn" id="rpg-eq-btn" title="${escapeHtml(t('btn_title'))}"><i class="fa-solid fa-shirt"></i></div>`);
    }
    if ($('#rpg-eq-modal').length === 0) {
        $('body').append(`
            <div class="rpg-modal rpg-eq-modal" id="rpg-eq-modal">
                <div class="rpg-modal-header" id="rpg-eq-drag"><span><i class="fa-solid fa-shirt"></i> <span id="rpg-eq-title">${escapeHtml(t('panel_title'))}</span></span> <i class="fa-solid fa-xmark rpg-modal-close"></i></div>
                <div class="rpg-eq-body" id="rpg-eq-body"></div>
            </div>`);
        makeModalDraggable(document.getElementById('rpg-eq-modal'), document.getElementById('rpg-eq-drag'));
        $('#rpg-eq-modal .rpg-modal-close').on('click', () => $('#rpg-eq-modal').removeClass('visible'));
        window.addEventListener('resize', () => { if ($('#rpg-eq-modal').hasClass('visible')) fitDossier(); });
    }
    if (!settings.enabled) { $('#rpg-eq-btn').hide(); return; }
    $('#rpg-eq-btn').show();
    $('#rpg-eq-btn').off('click').on('click', () => { renderPanel(); $('#rpg-eq-modal').toggleClass('visible'); });
}

function makeModalDraggable(elmnt, handle) {
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    if (!handle) return;
    handle.onmousedown = (e) => {
        if (e.target.closest('.rpg-modal-close')) return;
        e.preventDefault(); p3 = e.clientX; p4 = e.clientY;
        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
        document.onmousemove = (ev) => {
            ev.preventDefault(); p1 = p3 - ev.clientX; p2 = p4 - ev.clientY; p3 = ev.clientX; p4 = ev.clientY;
            elmnt.style.top = (elmnt.offsetTop - p2) + 'px'; elmnt.style.left = (elmnt.offsetLeft - p1) + 'px';
        };
    };
}

// ---- evidence-board dossier (design ported from equipment-dossier) ----
const EQ_ICONS = {
    head: '<path d="M3 16c2-1 4-1.5 9-1.5S19 15 21 16M6 13c0-3.5 2.5-6 6-6s6 2.5 6 6"/>',
    top: '<path d="M9 4 6 7l-3 1 1 3 2-1v10h12V10l2 1 1-3-3-1-3-3c-1.5 1.5-4 1.5-6 0Z"/>',
    bottom: '<path d="M8 4h8l3 16H5L8 4Z"/><path d="M12 4v16"/>',
    boots: '<path d="M3 9c2 0 3 1 4 3 1.5 0 5 .5 8 2 2 1 6 1 6 1v2H3V9Z"/>',
    accessory: '<path d="M6 4h12l3 5-9 11L3 9l3-5Z"/><path d="M3 9h18M9 4l3 16M15 4l-3 16"/>',
    weapon: '<path d="M14 3l7 7-2 2-3-1-7 7-2 4-1-1 4-2 7-7-1-3 2-2Z"/>'
};
const EQ_LAYOUT = {
    weapon:    { x: -6, y: 14,  rot: -12, pin: [40, 22] },
    head:      { x: 182, y: -10, rot: 5,  pin: [234, -4] },
    top:       { x: 24, y: 118, rot: -8,  pin: [76, 124] },
    bottom:    { x: 152, y: 196, rot: 7,  pin: [204, 202] },
    boots:     { x: 300, y: 150, rot: -6, pin: [352, 156] },
    accessory: { x: 392, y: 64, rot: 10,  pin: [444, 70] }
};
const EQ_ORDER = ['weapon', 'head', 'top', 'bottom', 'boots', 'accessory'];
const EQ_CENTER = [230, 160];
const EQ_ARMOR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 6v6c0 4.5 3.2 8 8 10 4.8-2 8-5.5 8-10V6l-8-4Z"/></svg>';
function condGrad(p) {
    return p >= 70 ? 'linear-gradient(90deg,#3f5a1c,#5d7e30)'
        : p >= 40 ? 'linear-gradient(90deg,#8a6a16,#bd9020)'
        : 'linear-gradient(90deg,#591a15,#9a382d)';
}

function buildReport() {
    if (!detailSlot) {
        return `<div class="eqd-rpt-in">
            <span class="eqd-kind">${escapeHtml(t('dossier_hint_k'))}</span>
            <h2 class="eqd-name eqd-name-muted">${escapeHtml(t('dossier_hint_n'))}</h2>
            <p class="eqd-desc">${escapeHtml(t('detail_hint'))}</p></div>`;
    }
    const sl = detailSlot, it = state.slots[sl];
    if (pendingSlot === sl || !it) {
        const inv = invApi();
        const items = inv ? inv.list() : [];
        const fromInv = (inv && items.length) ? `
            <div class="eqd-row two">
                <select class="eqd-sel rpg-eq-from-inv"><option value="">${escapeHtml(t('pick_item'))}</option>${items.map(i => `<option value="${i.id}">${escapeHtml(i.name)}${(typeof i.dur === 'number') ? ` (${Math.round(i.dur / (i.max || 100) * 100)}%)` : ''}</option>`).join('')}</select>
                <button class="eqd-btn eqd-btn-fix rpg-eq-equip-inv" data-slot="${sl}">${escapeHtml(t('equip'))}</button>
            </div>` : '';
        const manual = editMode ? `
            <input type="text" class="eqd-input rpg-eq-in-name" placeholder="${escapeHtml(t('name_ph'))}">
            <input type="text" class="eqd-input rpg-eq-in-desc" placeholder="${escapeHtml(t('desc_ph'))}">
            <div class="eqd-row two">
                <input type="number" class="eqd-input eqd-input-num rpg-eq-in-dur" min="0" placeholder="${escapeHtml(t('dur_ph'))}" title="${escapeHtml(t('dur_ph'))}">
                <input type="number" class="eqd-input eqd-input-num rpg-eq-in-max" min="1" value="100" placeholder="${escapeHtml(t('max_ph'))}" title="${escapeHtml(t('max_ph'))}">
                <button class="eqd-btn eqd-btn-patch rpg-eq-save" data-slot="${sl}">${escapeHtml(t('save'))}</button>
            </div>` : (!fromInv ? `<p class="eqd-desc">${escapeHtml(t('empty_hint'))}</p>` : '');
        return `<div class="eqd-rpt-in">
            <span class="eqd-kind">${escapeHtml(t('slot_' + sl))}</span>
            <h2 class="eqd-name eqd-name-muted">${escapeHtml(t('slot_empty_title'))}</h2>
            <p class="eqd-desc">${escapeHtml(t('slot_empty_desc'))}</p>
            <div class="eqd-repair">
                <div class="eqd-repair-h">${escapeHtml(t('from_backpack'))}</div>
                ${fromInv}${manual}
                <div class="eqd-row" style="margin-top:9px;"><button class="eqd-btn eqd-btn-ghost rpg-eq-cancel">${escapeHtml(t('cancel'))}</button></div>
            </div></div>`;
    }
    const pct = Math.max(0, Math.min(100, Math.round((it.dur / (it.max || 100)) * 100)));
    const damaged = it.broken || it.dur < (it.max || 100);
    const weap = (sl === 'weapon') ? weaponInfo() : null;
    const statVal = (sl === 'weapon') ? (weap ? weap.atk : 0) : pieceArmor(it);
    const statLbl = (sl === 'weapon') ? t('stat_attack') : t('stat_armor');
    let repairInner;
    if (editMode) {
        repairInner = `<div class="eqd-repair-h">${escapeHtml(t('gm_actions'))}</div>
            <div class="eqd-row">
                <button class="eqd-btn eqd-btn-fix rpg-eq-unequip" data-slot="${sl}">${escapeHtml(t('unequip'))}</button>
                <button class="eqd-btn eqd-btn-patch rpg-eq-repair" data-slot="${sl}">${escapeHtml(t('repair'))}</button>
            </div>
            <div class="eqd-row two"><button class="eqd-btn eqd-btn-danger rpg-eq-discard" data-slot="${sl}">${escapeHtml(t('discard'))}</button></div>`;
    } else {
        const invR = invApi();
        let mat = '';
        if (damaged) {
            if (!invR) mat = `<p class="eqd-desc">${escapeHtml(t('no_inv_repair'))}</p>`;
            else {
                const mats = invR.list();
                mat = mats.length ? `<div class="eqd-row two">
                    <select class="eqd-sel rpg-eq-mat"><option value="">${escapeHtml(t('pick_material'))}</option>${mats.map(i => `<option value="${i.id}">${escapeHtml(i.name)}${(typeof i.cond === 'number') ? ` (${i.cond}%)` : ''}</option>`).join('')}</select>
                    <button class="eqd-btn eqd-btn-fix rpg-eq-dorepair" data-slot="${sl}">${escapeHtml(t('do_repair'))}</button></div>` : `<p class="eqd-desc">${escapeHtml(t('no_materials'))}</p>`;
            }
        }
        repairInner = `<div class="eqd-repair-h">${escapeHtml(t('repair_with'))}</div>
            <div class="eqd-row"><button class="eqd-btn eqd-btn-patch rpg-eq-patch" data-slot="${sl}">${escapeHtml(t('patch'))}</button></div>
            ${mat}`;
    }
    return `<div class="eqd-rpt-in">
        <span class="eqd-kind">${escapeHtml(t('slot_' + sl))}</span>
        <h2 class="eqd-name">${escapeHtml(it.name)}</h2>
        ${it.desc ? `<p class="eqd-desc">${escapeHtml(it.desc)}</p>` : ''}
        <div class="eqd-meta">
            <div class="eqd-armor">${EQ_ARMOR_SVG}<div><div class="eqd-l">${escapeHtml(statLbl)}</div><div class="eqd-v">${statVal}</div></div></div>
            <div class="eqd-big"><div class="eqd-track"><i style="width:${pct}%;background:${condGrad(pct)}"></i><span>${it.broken ? escapeHtml(stateWord(it)) : pct + '% — ' + escapeHtml(stateWord(it))}</span></div></div>
        </div>
        <div class="eqd-repair">${repairInner}</div></div>`;
}

function fitDossier() {
    const d = document.getElementById('rpg-eq-dossier');
    if (!d) return;
    d.style.transform = 'scale(1)'; // reset to measure natural size
    const naturalH = d.offsetHeight || 720;
    const availW = Math.min(460, window.innerWidth * 0.96) - 4;
    const availH = window.innerHeight - 60;
    const s = Math.min(1, availW / 500, availH / naturalH);
    d.style.transform = 'scale(' + s + ')';
    if (d.parentElement) d.parentElement.style.height = (naturalH * s) + 'px';
}

function renderPanel() {
    const body = $('#rpg-eq-body');
    if (body.length === 0 || !state) return;
    const who = (getContext().name1) || t('subject_default');

    let photos = '', lines = '';
    for (const sl of EQ_ORDER) {
        const L = EQ_LAYOUT[sl];
        const it = state.slots[sl];
        const empty = !it;
        const pct = empty ? 0 : Math.max(0, Math.min(100, Math.round((it.dur / (it.max || 100)) * 100)));
        const cls = (empty ? ' empty' : '') + (it && it.broken ? ' broken' : '') + (detailSlot === sl ? ' active' : '');
        lines += `<line x1="${EQ_CENTER[0]}" y1="${EQ_CENTER[1]}" x2="${L.pin[0]}" y2="${L.pin[1]}" class="${empty ? 'eqd-dash' : ''}${(detailSlot === sl && !empty) ? ' eqd-on' : ''}"></line>`;
        photos += `<div class="eqd-photo${cls}" data-slot="${sl}" style="left:${L.x}px;top:${L.y}px;" tabindex="0">
            <div class="eqd-inner" style="--rot:${L.rot}deg">
                <span class="eqd-pin"></span>
                <div class="eqd-pic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">${EQ_ICONS[sl]}</svg>${empty ? '' : `<div class="eqd-mini"><i style="width:${pct}%;background:${condGrad(pct)}"></i></div>`}</div>
                <div class="eqd-cap"><div class="eqd-k">${escapeHtml(t('slot_' + sl))}</div><div class="eqd-n">${empty ? escapeHtml(t('empty')) : escapeHtml(it.name)}</div></div>
            </div></div>`;
    }

    body.html(`<div class="eqd-fit"><div class="eqd" id="rpg-eq-dossier">
        <div class="eqd-tab">${escapeHtml(t('case_no'))} <b>07-СВ</b> · ${escapeHtml(who)}</div>
        <div class="eqd-folder">
            <button class="eqd-close" title="${escapeHtml(t('close'))}" aria-label="${escapeHtml(t('close'))}">✕</button>
            <div class="eqd-holes"><i></i><i></i><i></i><i></i></div>
            <div class="eqd-stamp">${escapeHtml(t('stamp_1'))}<small>${escapeHtml(t('stamp_2'))}</small></div>
            <div class="eqd-pad">
                <div class="eqd-memo-wrap">
                    <button class="eqd-memo rpg-eq-auto"><span class="eqd-clip"></span>
                        <span class="eqd-lbl">${escapeHtml(t('memo_lbl'))}</span>
                        <span class="eqd-txt">${escapeHtml(t('auto_outfit'))}</span></button>
                    <div class="eqd-toggle${editMode ? ' on' : ''}" id="eqd-edit"><span class="eqd-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l4 4 10-10"/></svg></span>${escapeHtml(t('edit_mode'))}</div>
                </div>
            </div>
            <div class="eqd-stage">
                <svg class="eqd-threads" viewBox="0 0 500 344" preserveAspectRatio="none">${lines}</svg>
                <div class="eqd-subject"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg><span class="eqd-subject-l">${escapeHtml(t('subject_default'))}</span></div>
                ${photos}
            </div>
            <div class="eqd-report" id="eqd-report"><span class="eqd-clip2"></span><span class="eqd-peek"></span>${buildReport()}</div>
        </div>
    </div></div>`);

    body.find('.rpg-eq-auto').off('click').on('click', autoOutfit);
    body.find('.eqd-close').off('click').on('click', () => $('#rpg-eq-modal').removeClass('visible'));
    body.find('#eqd-edit').off('click').on('click', function () { editMode = !editMode; renderPanel(); });
    body.find('.eqd-photo').off('click').on('click', function () {
        const sl = $(this).data('slot'); detailSlot = sl; pendingSlot = state.slots[sl] ? null : sl; renderPanel();
    });
    body.find('.eqd-photo').off('keydown').on('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(this).trigger('click'); } });
    body.find('.rpg-eq-cancel').off('click').on('click', function () { pendingSlot = null; if (!state.slots[detailSlot]) detailSlot = null; renderPanel(); });
    body.find('.rpg-eq-patch').off('click').on('click', function () { patchItem($(this).data('slot')); });
    body.find('.rpg-eq-dorepair').off('click').on('click', function () { const v = body.find('.rpg-eq-mat').val(); if (v) repairWithItem($(this).data('slot'), v); });
    body.find('.rpg-eq-repair').off('click').on('click', function () { repairItem($(this).data('slot')); });
    body.find('.rpg-eq-equip-inv').off('click').on('click', function () { const v = body.find('.rpg-eq-from-inv').val(); if (v) equipFromInventory($(this).data('slot'), v); });
    body.find('.rpg-eq-unequip').off('click').on('click', function () { unequipToInventory($(this).data('slot')); });
    body.find('.rpg-eq-discard').off('click').on('click', function () { discardSlot($(this).data('slot')); });
    body.find('.rpg-eq-save').off('click').on('click', function () {
        const name = body.find('.rpg-eq-in-name').val().trim();
        if (!name) { toastr.warning(t('toast_need_name')); return; }
        const sl = $(this).data('slot');
        equipSlot(sl, name, body.find('.rpg-eq-in-desc').val().trim(), body.find('.rpg-eq-in-max').val(), body.find('.rpg-eq-in-dur').val());
        detailSlot = sl;
    });

    fitDossier();
    const tabEl = body.find('.eqd-tab')[0];
    if (tabEl) makeModalDraggable(document.getElementById('rpg-eq-modal'), tabEl);
}

// ---- settings ----
function settingsHtml() {
    return `
<div class="extension_settings rpg-eq-settings">
    <div class="inline-drawer">
        <div class="rpg-eq-toggle inline-drawer-header" style="cursor: pointer;">
            <b><i class="fa-solid fa-shirt"></i> ${t('set_title')}</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display: none; padding-top: 10px;">
            <label class="checkbox_label"><input type="checkbox" id="rpg-eq-enabled"> ${t('set_enable')}</label>
            <label class="checkbox_label"><input type="checkbox" id="rpg-eq-aicheck"> ${t('set_aicheck')}</label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10" style="margin-top:8px;">
                <label>${t('set_lang')}</label>
                <select id="rpg-eq-lang" class="text_pole" style="width:auto;">
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
            <hr class="sysHR">
            <h4>🔌 ${t('set_api')}</h4>
            <input type="text" id="rpg-eq-base" class="text_pole margin-b-10" placeholder="${t('set_url')}" style="width:100%;">
            <input type="password" id="rpg-eq-key" class="text_pole margin-b-10" placeholder="${t('set_key')}" style="width:100%;">
            <input type="text" id="rpg-eq-model" class="text_pole margin-b-10" placeholder="${t('set_model')}" style="width:100%;">
            <hr class="sysHR">
            <h4>⚙️ ${t('set_logic')}</h4>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_decay_every')}</label>
                <input type="number" id="rpg-eq-decay-every" class="text_pole" min="1" style="width:55px;">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_decay_amount')}</label>
                <input type="number" id="rpg-eq-decay-amount" class="text_pole" min="1" style="width:55px;">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_patch')}</label>
                <input type="number" id="rpg-eq-patch" class="text_pole" min="0" max="100" style="width:55px;">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_patchwear')}</label>
                <input type="number" id="rpg-eq-patchwear" class="text_pole" min="0" max="100" style="width:55px;">
            </div>
            <label class="checkbox_label"><input type="checkbox" id="rpg-eq-affecthp"> ${t('set_affecthp')}</label>
            <label class="checkbox_label"><input type="checkbox" id="rpg-eq-injectstats"> ${t('set_injectstats')}</label>
            <label class="checkbox_label"><input type="checkbox" id="rpg-eq-autowear"> ${t('set_autowear')}</label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_depth')}</label>
                <input type="number" id="rpg-eq-depth" class="text_pole" min="0" style="width:55px;">
            </div>
        </div>
    </div>
</div>`;
}

function setupUI() {
    $('#extensions_settings').append(settingsHtml());
    $('.rpg-eq-settings .rpg-eq-toggle').on('click', function () {
        $(this).next('.inline-drawer-content').slideToggle();
        $(this).find('.inline-drawer-icon').toggleClass('down up');
    });
    $('#rpg-eq-enabled').prop('checked', settings.enabled).on('change', function () {
        settings.enabled = this.checked; saveSettings(); renderButton(); loadState(); buildInjection();
    });
    $('#rpg-eq-aicheck').prop('checked', settings.aiCheckEquip !== false).on('change', function () { settings.aiCheckEquip = this.checked; saveSettings(); });
    $('#rpg-eq-lang').val(settings.language || 'en').on('change', function () {
        settings.language = $(this).val(); saveSettings();
        $('.rpg-eq-settings').remove();
        setupUI();
        $('.rpg-eq-settings .inline-drawer-content').show();
        $('.rpg-eq-settings .inline-drawer-icon').removeClass('down').addClass('up');
        $('#rpg-eq-btn').attr('title', t('btn_title'));
        $('#rpg-eq-title').text(t('panel_title'));
        renderPanel(); buildInjection();
    });
    $('#rpg-eq-base').val(settings.baseUrl).on('change', function () { settings.baseUrl = $(this).val(); saveSettings(); });
    $('#rpg-eq-key').val(settings.apiKey).on('change', function () { settings.apiKey = $(this).val(); saveSettings(); });
    $('#rpg-eq-model').val(settings.model).on('change', function () { settings.model = $(this).val(); saveSettings(); });
    $('#rpg-eq-decay-every').val(settings.decayEvery).on('change', function () { settings.decayEvery = Math.max(1, parseInt($(this).val()) || 8); saveSettings(); });
    $('#rpg-eq-decay-amount').val(settings.decayAmount).on('change', function () { settings.decayAmount = Math.max(1, parseInt($(this).val()) || 10); saveSettings(); });
    $('#rpg-eq-patch').val(settings.patchChance).on('change', function () { settings.patchChance = Math.min(100, Math.max(0, parseInt($(this).val()) || 0)); saveSettings(); });
    $('#rpg-eq-patchwear').val(settings.patchWear).on('change', function () { settings.patchWear = Math.min(100, Math.max(0, parseInt($(this).val()) || 0)); saveSettings(); });
    $('#rpg-eq-affecthp').prop('checked', settings.affectHp !== false).on('change', function () { settings.affectHp = this.checked; saveSettings(); buildInjection(); });
    $('#rpg-eq-injectstats').prop('checked', settings.injectStats !== false).on('change', function () { settings.injectStats = this.checked; saveSettings(); buildInjection(); });
    $('#rpg-eq-autowear').prop('checked', !!settings.autoWear).on('change', function () { settings.autoWear = this.checked; saveSettings(); });
    $('#rpg-eq-depth').val(settings.injectDepth).on('change', function () { settings.injectDepth = parseInt($(this).val()); saveSettings(); buildInjection(); });
}

jQuery(() => {
    loadSettings();
    setupUI();
    if (getContext().chatId) { loadState(); renderButton(); buildInjection(); }

    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(() => { loadState(); editMode = false; pendingSlot = null; renderButton(); renderPanel(); buildInjection(); }, 100);
    });
    eventSource.on(event_types.MESSAGE_RECEIVED, (id) => { decayTick(id); analyzeWear(id); });
});

// ============================================================
// CROSS-EXTENSION BRIDGE — lets Vendors (and others) read/repair gear.
// Safe no-op for anyone who doesn't use it.
// ============================================================
window.RPG = window.RPG || {};
window.RPG.equipment = {
    available: true,
    isEnabled: () => !!settings.enabled,
    list: () => {
        if (!state) return [];
        return SLOTS.map(s => {
            const it = state.slots[s];
            return { slot: s, label: t('slot_' + s), item: it ? { name: it.name, desc: it.desc, dur: it.dur, max: it.max, broken: !!it.broken } : null };
        });
    },
    repairable: () => {
        if (!state) return [];
        return SLOTS.filter(s => { const it = state.slots[s]; return it && (it.broken || it.dur < it.max); })
            .map(s => { const it = state.slots[s]; return { slot: s, label: t('slot_' + s), name: it.name, desc: it.desc, dur: it.dur, max: it.max, broken: !!it.broken }; });
    },
    // amount = % of max to restore (null = full repair)
    repair: (slot, amount) => {
        if (!state || !state.slots[slot]) return false;
        const it = state.slots[slot];
        if (amount == null) it.dur = it.max || 100;
        else it.dur = Math.min(it.max || 100, it.dur + Math.round((it.max || 100) * (amount / 100)));
        if (it.dur > 0) it.broken = false;
        saveState(); renderPanel(); buildInjection();
        return true;
    },
    refresh: () => { loadState(); renderPanel(); buildInjection(); },
    // mechanical stats other modules can read (scaled by durability; broken gear = 0)
    affectsHp: () => !!settings.affectHp,
    defense: () => totalDefense(),
    attack: () => { const w = weaponInfo(); return w ? w.atk : 0; },
    wearArmor: (raw) => combatWearArmor(raw)
};
