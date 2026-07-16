import { getContext, extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveChatDebounced, saveSettingsDebounced, setExtensionPrompt, extension_prompt_roles, characters } from '../../../../script.js';
import { selected_group, groups } from '../../../group-chats.js';

const MODULE_NAME = 'rpg_status_bar';
const PROMPT_KEY = 'rpg_status_injection';

let settings = {};
let currentlyEditingChar = null;

/* ============================================================
   LOCALIZATION (RU / EN)
   Every user-facing string, the color labels, the presets and
   the AI's summary language switch with settings.language.
   ============================================================ */
const I18N = {
    en: {
        ui_header: "RPG Status Bar (Inline)",
        ui_enable: "Enable RPG Status Bar",
        ui_language: "Interface language",
        ui_api: "🔌 API Settings",
        ui_url: "URL",
        ui_key: "API Key",
        ui_model: "Model",
        ui_temp: "Temperature:",
        ui_gen: "⚙️ Generation & Context",
        ui_inject: "Use status in conversation (Inject)",
        ui_inject_title: "Inject the stat summary into the system prompt",
        ui_per_chat: "Separate status for each chat",
        ui_per_chat_title: "When on, every chat keeps its own values for a character (a new chat starts fresh instead of continuing old HP). Stat setup is seeded from the character's global template.",
        ui_reset: "Reset character",
        ui_ai_generate: "✨ Generate 4 stats (AI)",
        ai_names_lang: "All stat names and descriptions must be in English.",
        confirm_ai_generate: "Let AI design 4 custom stats for \"{char}\" from their character card? This replaces the current stats.",
        toast_gen_start: "AI is designing stats from the character card...",
        toast_gen_done: "AI generated 4 stats!",
        toast_gen_fail: "Stat generation failed.",
        toast_no_card: "No character card found for \"{char}\".",
        toast_no_key: "API key is not set!",
        ui_update_every: "Update every:",
        ui_messages: "messages",
        ui_inject_depth: "Injection depth:",
        ui_inject_depth_title: "How deep to inject the character status into the prompt (0 = at the very end)",
        ui_stat_config: "📊 Stat configuration",
        ui_edit_for: "Edit stats for:",
        ui_add_stat: "Add stat",
        ui_stat_name_ph: "Stat name",
        ui_stat_desc_ph: "Description for the AI...",
        ui_color_by_value: "🎨 Color by value",
        ui_color_by_value_title: "Color the bar by value: green high, gold mid, red low (best for 'higher = better' stats)",
        ui_delete: "Delete",
        ui_profiles: "💾 Character profiles",
        ui_export_current: "Export current character",
        ui_import: "Import profile",
        preset_fantasy: "⚔️ Fantasy",
        preset_survival: "🏕️ Survival",
        preset_romance: "💕 Romance",
        confirm_preset: "Replace the current stats for {char} with this preset?",
        toast_exported: "Profile for \"{char}\" exported!",
        toast_imported: "Profile imported onto \"{char}\"!",
        toast_imported_all: "Imported {n} profile(s)!",
        toast_import_bad: "Invalid profile file.",
        toast_import_err: "File read error.",
        confirm_reset: "Reset {char}'s status to the baseline (fresh values)?",
        toast_reset: "{char}'s status was reset.",
        inline_status: "Status: {char}",
        inline_analyzing: "Analyzing...",
        inline_error: "Error: {char}",
        inline_retry: "Retry",
        inline_recalc: "Recalculate",
        inline_recalc_title: "Recalculate status at this point",
        inline_toggle_title: "Show / hide status",
        inline_no_changes: "No changes",
        condition_stable: "Condition stable.",
        ai_summary_lang: "Write the one-sentence summary in English.",
        stat_health: "Health",
        stat_health_desc: "Physical health. Drops when injured, restored by healing/rest.",
        stat_energy: "Energy",
        stat_energy_desc: "Alertness. Drops over time, restored by sleep.",
        new_stat_name: "New stat",
        new_stat_desc: "Description...",
        ui_link_label: "🔗 Link to Vitals:",
        ui_link_title: "Mirror the PLAYER's live value from the RPG Vitals extension — no AI call, always in sync. Note: Fatigue is 'higher = worse', so turn 'Color by value' off for it.",
        link_none: "— not linked —",
        link_hp: "HP (health)", link_hunger: "Satiety", link_mana: "Mana", link_fatigue: "Fatigue",
        link_missing: "RPG Vitals is not active — the linked value will freeze until it is.",
        colors: {
            red: "🔴 Blood / Health", blue: "🔵 Mana / Energy", green: "🟢 Stamina / Poison",
            gold: "🟡 Satiety / Morale", purple: "🟣 Magic / Sanity", cyan: "💠 Shield / Cold",
            dark: "⚫ Darkness / Stress", pink: "🌸 Arousal / Bond"
        },
        presets: {
            fantasy: [
                { name: "Health", desc: "Physical health. Drops when injured, restored by healing/rest.", color: "red", value: 100, dynamicColor: true },
                { name: "Mana", desc: "Magical energy. Spent casting spells, restored by rest.", color: "blue", value: 100, dynamicColor: true },
                { name: "Stamina", desc: "Physical stamina. Drops with exertion, restored by rest.", color: "green", value: 100, dynamicColor: true }
            ],
            survival: [
                { name: "Satiety", desc: "Fullness. Drops over time without food, restored by eating.", color: "gold", value: 100, dynamicColor: true },
                { name: "Hydration", desc: "Hydration. Drops over time, restored by drinking.", color: "cyan", value: 100, dynamicColor: true },
                { name: "Warmth", desc: "Body warmth. Drops in cold, restored by fire/shelter.", color: "red", value: 100, dynamicColor: true }
            ],
            romance: [
                { name: "Trust", desc: "Emotional trust toward {{user}}. Grows with kindness, drops with betrayal.", color: "green", value: 50, dynamicColor: true },
                { name: "Attraction", desc: "Romantic/physical attraction toward {{user}}. Grows with chemistry and intimacy.", color: "pink", value: 30, dynamicColor: true },
                { name: "Mood", desc: "Current mood. Rises with positive moments, falls with conflict.", color: "gold", value: 70, dynamicColor: true }
            ]
        }
    },
    ru: {
        ui_header: "RPG Status Bar (Инлайн)",
        ui_enable: "Включить статус-бар",
        ui_language: "Язык интерфейса",
        ui_api: "🔌 Настройки API",
        ui_url: "URL",
        ui_key: "API-ключ",
        ui_model: "Модель",
        ui_temp: "Температура:",
        ui_gen: "⚙️ Генерация и контекст",
        ui_inject: "Использовать статус в диалоге (инъекция)",
        ui_inject_title: "Внедрять сводку статов в системный промпт",
        ui_per_chat: "Свой статус на каждый чат",
        ui_per_chat_title: "Когда включено, у каждого чата свои значения для персонажа (новый чат начинается заново, а не продолжает старое HP). Настройки статов берутся из глобального шаблона персонажа.",
        ui_reset: "Сбросить персонажа",
        ui_ai_generate: "✨ Сгенерировать 4 стата (ИИ)",
        ai_names_lang: "Все названия и описания статов должны быть на русском языке.",
        confirm_ai_generate: "Пусть ИИ придумает 4 стата для «{char}» по карточке персонажа? Текущие статы будут заменены.",
        toast_gen_start: "ИИ подбирает статы по карточке персонажа...",
        toast_gen_done: "ИИ сгенерировал 4 стата!",
        toast_gen_fail: "Не удалось сгенерировать статы.",
        toast_no_card: "Карточка персонажа «{char}» не найдена.",
        toast_no_key: "API-ключ не указан!",
        ui_update_every: "Обновлять каждые:",
        ui_messages: "сообщений",
        ui_inject_depth: "Глубина внедрения:",
        ui_inject_depth_title: "Насколько глубоко внедрять статус в промпт (0 = в самый конец)",
        ui_stat_config: "📊 Настройка статов",
        ui_edit_for: "Редактировать статы для:",
        ui_add_stat: "Добавить стат",
        ui_stat_name_ph: "Название стата",
        ui_stat_desc_ph: "Описание для ИИ...",
        ui_color_by_value: "🎨 Цвет по значению",
        ui_color_by_value_title: "Красить полоску по значению: зелёный — высоко, золотой — средне, красный — низко (для статов, где «больше = лучше»)",
        ui_delete: "Удалить",
        ui_profiles: "💾 Профили персонажей",
        ui_export_current: "Экспорт текущего персонажа",
        ui_import: "Импорт профиля",
        preset_fantasy: "⚔️ Фэнтези",
        preset_survival: "🏕️ Выживание",
        preset_romance: "💕 Романтика",
        confirm_preset: "Заменить текущие статы «{char}» этим пресетом?",
        toast_exported: "Профиль «{char}» экспортирован!",
        toast_imported: "Профиль импортирован в «{char}»!",
        toast_imported_all: "Импортировано профилей: {n}!",
        toast_import_bad: "Неверный файл профиля.",
        toast_import_err: "Ошибка чтения файла.",
        confirm_reset: "Сбросить статус «{char}» к базовому (свежие значения)?",
        toast_reset: "Статус «{char}» сброшен.",
        inline_status: "Статус: {char}",
        inline_analyzing: "Анализирую...",
        inline_error: "Ошибка: {char}",
        inline_retry: "Повторить",
        inline_recalc: "Пересчитать",
        inline_recalc_title: "Пересчитать статус на этом моменте",
        inline_toggle_title: "Показать / скрыть статус",
        inline_no_changes: "Без изменений",
        condition_stable: "Состояние стабильно.",
        ai_summary_lang: "Пиши краткое описание (одно предложение) на русском языке.",
        stat_health: "Здоровье",
        stat_health_desc: "Физическое здоровье. Падает при травмах, восстанавливается лечением/отдыхом.",
        stat_energy: "Энергия",
        stat_energy_desc: "Бодрость. Снижается со временем, восстанавливается сном.",
        new_stat_name: "Новый стат",
        new_stat_desc: "Описание...",
        ui_link_label: "🔗 Связать с Vitals:",
        ui_link_title: "Зеркалит живое значение ИГРОКА из расширения RPG Vitals — без вызова ИИ, всегда синхронно. Учти: «Усталость» — это «больше = хуже», для неё лучше выключить «Цвет по значению».",
        link_none: "— не связан —",
        link_hp: "HP (здоровье)", link_hunger: "Сытость", link_mana: "Мана", link_fatigue: "Усталость",
        link_missing: "RPG Vitals не активен — связанное значение замрёт, пока он не появится.",
        colors: {
            red: "🔴 Кровь / Здоровье", blue: "🔵 Мана / Энергия", green: "🟢 Выносливость / Яд",
            gold: "🟡 Сытость / Дух", purple: "🟣 Магия / Рассудок", cyan: "💠 Щит / Холод",
            dark: "⚫ Тьма / Стресс", pink: "🌸 Возбуждение / Связь"
        },
        presets: {
            fantasy: [
                { name: "Здоровье", desc: "Физическое здоровье. Падает при травмах, восстанавливается лечением/отдыхом.", color: "red", value: 100, dynamicColor: true },
                { name: "Мана", desc: "Магическая энергия. Тратится на заклинания, восстанавливается отдыхом.", color: "blue", value: 100, dynamicColor: true },
                { name: "Выносливость", desc: "Физическая выносливость. Падает от нагрузки, восстанавливается отдыхом.", color: "green", value: 100, dynamicColor: true }
            ],
            survival: [
                { name: "Сытость", desc: "Насыщение. Падает со временем без еды, восстанавливается едой.", color: "gold", value: 100, dynamicColor: true },
                { name: "Гидратация", desc: "Уровень воды. Падает со временем, восстанавливается питьём.", color: "cyan", value: 100, dynamicColor: true },
                { name: "Тепло", desc: "Тепло тела. Падает на холоде, восстанавливается огнём/укрытием.", color: "red", value: 100, dynamicColor: true }
            ],
            romance: [
                { name: "Доверие", desc: "Эмоциональное доверие к {{user}}. Растёт от доброты, падает от предательства.", color: "green", value: 50, dynamicColor: true },
                { name: "Влечение", desc: "Романтическое/физическое влечение к {{user}}. Растёт от химии и близости.", color: "pink", value: 30, dynamicColor: true },
                { name: "Настроение", desc: "Текущее настроение. Растёт от приятных моментов, падает от конфликтов.", color: "gold", value: 70, dynamicColor: true }
            ]
        }
    }
};

// Names/summaries come from the AI and from downloaded character cards — never trust them raw in HTML.
function escapeHtml(x) {
    return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// The model sometimes returns junk instead of a string (-1, bare numbers, "null").
// String(x || fallback) lets it through because -1 is truthy. A real name/summary has letters.
function aiName(x, fallback = null, maxLen = 60) {
    const s = String(x == null ? '' : x).trim();
    if (s.length < 2 || !/\p{L}/u.test(s)) return fallback;
    if (/^(null|undefined|n\/?a|none|нет|-?\d+)$/i.test(s)) return fallback;
    return s.slice(0, maxLen);
}

function langObj() { return I18N[settings.language] || I18N.en; }
function t(key, vars) {
    let str = langObj()[key];
    if (str === undefined) str = I18N.en[key];
    if (str === undefined) str = key;
    if (typeof str === 'string' && vars) {
        for (const k in vars) str = str.split(`{${k}}`).join(vars[k]);
    }
    return str;
}
function colorOptions() { return langObj().colors || I18N.en.colors; }
function statPresets() { return langObj().presets || I18N.en.presets; }

const defaultSettings = {
    enabled: false,
    language: 'en',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: 'google/gemma-4-31b-it',
    temperature: 0.8,
    updateFrequency: 5,
    injectDepth: 0,
    injectContext: true,
    perChatProfiles: false,
    profiles: {}
};

function makeDefaultProfile() {
    return {
        msgCount: 0,
        stats: [
            { name: t('stat_health'), desc: t('stat_health_desc'), color: "red", value: 100, dynamicColor: true },
            { name: t('stat_energy'), desc: t('stat_energy_desc'), color: "blue", value: 100, dynamicColor: true }
        ],
        summary: t('condition_stable')
    };
}

function loadSettings() {
    if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = {};
    settings = Object.assign({}, defaultSettings, extension_settings[MODULE_NAME]);
    if (!settings.profiles) settings.profiles = {};
    if (!settings.chatStamps) settings.chatStamps = {};
    // heal NaN/garbage saved from empty number inputs by older builds
    if (!Number.isFinite(settings.updateFrequency)) settings.updateFrequency = defaultSettings.updateFrequency;
    if (!Number.isFinite(settings.injectDepth)) settings.injectDepth = defaultSettings.injectDepth;
}

// With "per-chat" on, keys like `chatId::Name` used to pile up forever, bloating settings.json.
// Per-chat VALUES untouched for 60 days are dropped; the character's global template (plain
// `Name` key, i.e. the stat config) is never pruned, so nothing needs re-setting-up.
const STATE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
function pruneOldStates() {
    const now = Date.now();
    let changed = false;
    const liveChats = new Set();
    for (const key of Object.keys(settings.profiles)) {
        const i = key.indexOf('::');
        if (i < 0) continue;                      // global template — keep forever
        const chatId = key.slice(0, i);
        if (!settings.chatStamps[chatId]) { settings.chatStamps[chatId] = now; changed = true; liveChats.add(chatId); continue; } // migrate
        if (now - settings.chatStamps[chatId] > STATE_TTL_MS) { delete settings.profiles[key]; changed = true; }
        else liveChats.add(chatId);
    }
    for (const id of Object.keys(settings.chatStamps)) {
        if (!liveChats.has(id)) { delete settings.chatStamps[id]; changed = true; }
    }
    if (changed) saveSettings();
}

function saveSettings() {
    extension_settings[MODULE_NAME] = settings;
    if (typeof saveSettingsDebounced === 'function') {
        saveSettingsDebounced();
    }
}

// When "per-chat" is on, a character's live state is stored per chat, seeded
// from the character's global template (config carries over, values are fresh).
function profileKey(charName) {
    const chatId = getContext().chatId;
    if (settings.perChatProfiles && chatId) {
        if (!settings.chatStamps) settings.chatStamps = {};
        settings.chatStamps[chatId] = Date.now();   // touch: keeps this chat's values from being pruned
        return `${chatId}::${charName}`;
    }
    return charName;
}

function getProfile(charName) {
    const key = profileKey(charName);
    if (!settings.profiles[key]) {
        const globalTpl = (key !== charName && settings.profiles[charName]) ? settings.profiles[charName] : null;
        settings.profiles[key] = globalTpl ? JSON.parse(JSON.stringify(globalTpl)) : makeDefaultProfile();
        settings.profiles[key].msgCount = 0; // fresh counter for a new chat
    }
    let p = settings.profiles[key];
    if (p.msgCount === undefined) p.msgCount = 0;
    if (!p.stats || !Array.isArray(p.stats)) p.stats = makeDefaultProfile().stats;
    if (!p.summary) p.summary = t('condition_stable');
    return p;
}

function resetCharacter(charName) {
    const key = profileKey(charName);
    if (settings.perChatProfiles && key !== charName && settings.profiles[charName]) {
        // per-chat: reseed from the character's global template baseline
        settings.profiles[key] = JSON.parse(JSON.stringify(settings.profiles[charName]));
        settings.profiles[key].msgCount = 0;
    } else {
        // global (or no template): restore full values and clear the summary
        const p = getProfile(charName);
        p.stats.forEach(s => { s.value = 100; });
        p.summary = t('condition_stable');
        p.msgCount = 0;
    }
    saveSettings();
    renderDynamicStats();
    updateContextInjection();
    toastr.success(t('toast_reset', { char: escapeHtml(charName) }));
}

// === AI: design custom stats from the character card ===
function getCharacterCard(charName) {
    const c = characters.find(ch => ch.name === charName);
    if (!c) return '';
    const parts = [c.name, c.description, c.personality, c.scenario].filter(Boolean);
    return parts.join('\n').trim().slice(0, 3000);
}

async function callStatsAI(system, user) {
    const url = (settings.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${settings.apiKey.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.6,
            response_format: { type: "json_object" }
        })
    });
    if (!resp.ok) {
        let detail = '';
        try { detail = (await resp.json())?.error?.message || ''; } catch (e) {}
        throw new Error(`HTTP ${resp.status} ${detail}`.trim());
    }
    const data = await resp.json();
    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) throw new Error("Unexpected AI response");
    let content = (data.choices[0].message.content || '').trim();
    const m = content.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : content);
}

async function generateStatsForCharacter(charName) {
    if (!settings.apiKey) { toastr.warning(t('toast_no_key')); return; }
    const card = getCharacterCard(charName);
    if (!card) { toastr.warning(t('toast_no_card', { char: escapeHtml(charName) })); return; }

    toastr.info(t('toast_gen_start'));
    try {
        const validColors = Object.keys(colorOptions());
        const sys = `You are an RPG systems designer. Based on the character below, invent EXACTLY 4 status stats that best fit their nature, role and personality. Mix physical, emotional and relational stats where it makes sense.
For each stat provide:
- "name": short (1-2 words)
- "desc": one sentence telling a Game Master what raises and lowers it
- "color": one of [${validColors.join(', ')}]
- "value": a starting value 0-100 that fits the character right now
- "dynamicColor": true if higher is better (health-like), false otherwise
${t('ai_names_lang')}
Output ONLY valid JSON: { "stats": [ {"name":"","desc":"","color":"red","value":100,"dynamicColor":true} ] } with exactly 4 entries.`;

        const result = await callStatsAI(sys, `Character:\n${card}`);
        let stats = Array.isArray(result?.stats) ? result.stats : [];
        stats = stats.slice(0, 4).map(s => {
            let v = Number(s.value);
            if (!isFinite(v)) v = 100;
            const nm = aiName(s.name, null, 40);
            if (!nm) return null;                       // junk entry from the model — drop it
            return {
                name: nm,
                desc: aiName(s.desc, '', 200) || '',
                color: validColors.includes(s.color) ? s.color : 'blue',
                value: Math.max(0, Math.min(100, Math.round(v))),
                dynamicColor: !!s.dynamicColor
            };
        }).filter(Boolean);
        if (stats.length === 0) throw new Error("no stats returned");

        const profile = getProfile(charName);
        profile.stats = stats;
        profile.summary = t('condition_stable');
        profile.msgCount = 0;
        saveSettings();
        renderDynamicStats();
        updateContextInjection();
        toastr.success(t('toast_gen_done'));
    } catch (e) { console.error("Stat generation failed:", e); toastr.error(t('toast_gen_fail')); }
}

/* ============================================================
   RPG VITALS LINK
   A stat can mirror the PLAYER's live value from the RPG Vitals
   extension (window.RPG.vitals): zero AI calls, never out of sync,
   and it stops the same HP being computed twice by two extensions.
   Vitals loads after this extension, so the bridge is checked at
   read time, never cached.
   ============================================================ */
const LINK_KEYS = ['hp', 'hunger', 'mana', 'fatigue'];
function vitApi() {
    const v = (typeof window !== 'undefined') && window.RPG && window.RPG.vitals;
    return (v && v.available) ? v : null;
}
function linkedValue(link) {
    const v = vitApi();
    if (!v) return null;
    try {
        if (link === 'hp') { const h = v.getHp(); return (h && h.max > 0) ? Math.round(h.hp / h.max * 100) : null; }
        if (link === 'hunger') { const n = v.getHunger(); return isFinite(n) ? Math.round(n) : null; }
        if (link === 'mana') { const n = v.getMana(); return isFinite(n) ? Math.round(n) : null; }
        if (link === 'fatigue') { const n = v.getFatigue(); return isFinite(n) ? Math.round(n) : null; }
    } catch (e) { /* vitals mid-switch — keep the old value */ }
    return null;
}
// refresh every linked stat of a profile from Vitals; returns true if anything moved
function refreshLinkedStats(profile) {
    let changed = false;
    (profile.stats || []).forEach(st => {
        if (!st.link) return;
        const nv = linkedValue(st.link);
        if (nv !== null && nv !== st.value) { st.value = Math.max(0, Math.min(100, nv)); changed = true; }
    });
    return changed;
}

function getActiveCharacters() {
    let activeChars = [];
    const context = getContext();

    if (selected_group) {
        const group = groups.find(g => g.id === selected_group);
        if (group && group.members && Array.isArray(group.members)) {
            group.members.forEach(memberIdentifier => {
                let char = characters.find(c => c.avatar === memberIdentifier);
                if (!char && !isNaN(memberIdentifier)) char = characters[parseInt(memberIdentifier)];
                if (!char) char = characters.find(c => c.name === memberIdentifier);
                if (char) activeChars.push(char);
            });
        }
    } else if (context.characterId !== undefined && characters[context.characterId]) {
        activeChars.push(characters[context.characterId]);
    }

    return activeChars;
}

async function calculateNewStats(historyText, charName) {
    if (!settings.apiKey) throw new Error("API key is not set!");
    const profile = getProfile(charName);

    let statsRules = "";
    let currentValuesJSON = {};

    profile.stats.forEach(stat => {
        if (stat.link) return;                 // linked stats come live from Vitals — no tokens, no drift
        statsRules += `- "${stat.name}": (0 to 100). ${stat.desc}\n`;
        currentValuesJSON[stat.name] = stat.value;
    });

    const systemPrompt = `You are a strict RPG Game Master calculator. 
Update the character's (${charName}) stats based on the story events. All stats are 0 to 100.

Active Stats and rules:
${statsRules}

Current Stats:
${JSON.stringify(currentValuesJSON)}

RULES:
1. Analyze events. Change stats if damage, rest, food, or stress occurred.
2. Also account for EMOTIONAL, SOCIAL and INTIMATE events (affection, trust, arousal, fear, tension) whenever such stats exist — move those stats accordingly.
3. If nothing relevant happened, slightly decrease energy/satiety over time.
4. Write a brief 1-sentence summary of ${charName}'s physical and emotional state. ${t('ai_summary_lang')}
5. Output ONLY valid JSON. Keep the stat keys EXACTLY as given above.

Format:
{
  "stats": { "Stat1": 95, "Stat2": 80 },
  "summary": "Short description."
}`;

    let endpointUrl = (settings.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';

    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(endpointUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${settings.apiKey.trim()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Story:\n${historyText}\n\nOutput JSON:` }
                    ],
                    temperature: settings.temperature,
                    response_format: { type: "json_object" }
                })
            });

            if (response.status === 429 && i === 0) {
                await new Promise(r => setTimeout(r, 2000)); continue;
            }
            if (!response.ok) {
                let detail = '';
                try { detail = (await response.json())?.error?.message || ''; } catch (e) {}
                throw new Error(`HTTP ${response.status} ${detail}`.trim());
            }

            const data = await response.json();
            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("Unexpected AI response");
            }
            let content = (data.choices[0].message.content || '').trim();
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            return JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch (e) {
            if (i === 1) throw e;
        }
    }
}

// === RENDER (CSS GRID ANIMATION) ===
// Resolve the container by walking the nodes rather than with an attribute selector:
// character names may contain quotes or apostrophes, which would make the selector invalid.
function findStatusContainer(messageElement, charName) {
    return Array.from(messageElement.querySelectorAll('.rpg-inline-container'))
        .find(c => c.getAttribute('data-char') === charName) || null;
}

function renderInlineStatus(messageId, charName, statsData, isLoading = false, isError = false) {
    const messageElement = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (!messageElement) return;

    let container = findStatusContainer(messageElement, charName);
    if (!container) {
        const mesText = messageElement.querySelector('.mes_text');
        if (!mesText) return;   // message body not built yet; avoid creating a detached container
        container = document.createElement('div');
        container.className = 'rpg-inline-container';
        container.setAttribute('data-char', charName);
        mesText.appendChild(container);
    }

    if (isLoading) {
        container.innerHTML = `
            <div class="rpg-inline-header">
                <div class="rpg-header-left">
                    <i class="fa-solid fa-heart-pulse"></i> <span>${t('inline_status', { char: escapeHtml(charName) })}</span>
                </div>
                <div class="rpg-header-right">
                    <span class="rpg-mini-summary">${t('inline_analyzing')}</span>
                    <i class="fa-solid fa-spinner fa-spin rpg-chevron"></i>
                </div>
            </div>
        `;
        return;
    }

    if (isError) {
        container.innerHTML = `
            <div class="rpg-inline-header expanded">
                <div class="rpg-header-left">
                    <i class="fa-solid fa-triangle-exclamation"></i> <span>${t('inline_error', { char: escapeHtml(charName) })}</span>
                </div>
            </div>
            <div class="rpg-accordion-wrapper expanded">
                <div class="rpg-inline-body">
                    <div class="rpg-inline-body-inner">
                        <div style="color:#ff6b6b; font-size:0.85rem; margin-bottom: 10px;">${escapeHtml(statsData)}</div>
                        <button class="rpg-force-update" data-id="${messageId}" data-char="${escapeHtml(charName)}"><i class="fa-solid fa-rotate-right"></i> ${t('inline_retry')}</button>
                    </div>
                </div>
            </div>
        `;
    }
    else if (statsData && statsData.stats) {
        let barsHtml = '';
        let anyCritical = false;
        statsData.stats.forEach(stat => {
            let val = Math.max(0, Math.min(100, stat.value));

            let colorClass = `rpg-color-${stat.color}`;
            if (stat.dynamicColor) {
                colorClass = val > 60 ? 'rpg-color-green' : (val >= 30 ? 'rpg-color-gold' : 'rpg-color-red');
            }

            const isCritical = val <= 15;
            if (isCritical) anyCritical = true;

            const d = stat.delta || 0;
            let deltaHtml = '';
            if (d > 0) deltaHtml = ` <span class="rpg-delta up">▲${d}</span>`;
            else if (d < 0) deltaHtml = ` <span class="rpg-delta down">▼${Math.abs(d)}</span>`;

            barsHtml += `
                <div class="rpg-stat-row${isCritical ? ' rpg-critical' : ''}">
                    <div class="rpg-stat-labels"><span>${escapeHtml(stat.name)}${isCritical ? ' <i class="fa-solid fa-triangle-exclamation rpg-crit-icon"></i>' : ''}</span><span>${val}/100${deltaHtml}</span></div>
                    <div class="rpg-stat-bar-bg"><div class="rpg-stat-bar-fill ${colorClass}" style="width: ${val}%"></div></div>
                </div>`;
        });

        let shortSummary = statsData.summary || t('inline_no_changes');
        if (shortSummary.length > 35) shortSummary = shortSummary.substring(0, 35) + '...';

        const headerIcon = anyCritical ? 'fa-triangle-exclamation' : 'fa-heart-pulse';

        container.innerHTML = `
            <div class="rpg-inline-header${anyCritical ? ' rpg-header-critical' : ''}" title="${t('inline_toggle_title')}">
                <div class="rpg-header-left">
                    <i class="fa-solid ${headerIcon}"></i> <span>${t('inline_status', { char: escapeHtml(charName) })}</span>
                </div>
                <div class="rpg-header-right">
                    <span class="rpg-mini-summary">${escapeHtml(shortSummary)}</span>
                    <i class="fa-solid fa-chevron-down rpg-chevron"></i>
                </div>
            </div>
            <div class="rpg-accordion-wrapper">
                <div class="rpg-inline-body">
                    <div class="rpg-inline-body-inner">
                        ${barsHtml}
                        <div class="rpg-body-footer">
                            <div class="rpg-status-summary">${escapeHtml(statsData.summary)}</div>
                            <button class="rpg-force-update" data-id="${messageId}" data-char="${escapeHtml(charName)}" title="${t('inline_recalc_title')}">
                                <i class="fa-solid fa-rotate-right"></i> ${t('inline_recalc')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    const header = container.querySelector('.rpg-inline-header');
    const wrapper = container.querySelector('.rpg-accordion-wrapper');
    if (header && wrapper) {
        header.addEventListener('click', () => {
            header.classList.toggle('expanded');
            wrapper.classList.toggle('expanded');
        });
    }

    const updateBtn = container.querySelector('.rpg-force-update');
    if (updateBtn) {
        updateBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            updateBtn.classList.add('rpg-force-spinning');
            await processCharacterStatus(messageId, charName, true);
        });
    }
}

async function processCharacterStatus(messageId, charName, forceUpdate = false) {
    if (!settings.enabled) return;

    const context = getContext();
    const chat = context.chat;
    const msg = chat[messageId];
    if (!msg || msg.is_user || msg.is_system) return;

    const profile = getProfile(charName);

    if (!forceUpdate && msg.extra?.rpg_status?.[charName]) {
        renderInlineStatus(messageId, charName, msg.extra.rpg_status[charName]);
        return;
    }

    let needsApiCall = forceUpdate;
    if (!forceUpdate) {
        profile.msgCount += 1;
        if (profile.msgCount >= settings.updateFrequency) {
            needsApiCall = true;
            profile.msgCount = 0;
        }
    }

    if (!needsApiCall) {
        refreshLinkedStats(profile);           // even without an AI call, linked bars stay live
        const currentData = { stats: JSON.parse(JSON.stringify(profile.stats)), summary: profile.summary };
        if (!msg.extra) msg.extra = {};
        if (!msg.extra.rpg_status) msg.extra.rpg_status = {};
        msg.extra.rpg_status[charName] = currentData;
        saveChatDebounced();
        renderInlineStatus(messageId, charName, currentData);
        return;
    }

    renderInlineStatus(messageId, charName, null, true, false);
    const myChat = context.chatId;   // message ids overlap between chats: a result arriving after a
                                     // switch used to paint the OLD chat's status onto the NEW chat's
                                     // message with the same number, and save into the wrong chat file

    try {
        const startIdx = Math.max(0, messageId - 10);
        const historySlice = chat.slice(startIdx, messageId + 1).filter(m => !m.is_system);
        const historyText = historySlice.map(m => `${m.name}: ${m.mes}`).join('\n\n');

        const result = await calculateNewStats(historyText, charName);
        if (getContext().chatId !== myChat) return;   // chat changed while the AI was thinking

        const deltas = {};
        if (result.stats) {
            profile.stats.forEach((stat) => {
                if (stat.link) return;                    // Vitals owns this one
                if (result.stats[stat.name] !== undefined) {
                    // the model can answer with strings, -5 or 150 — a stat is always a clamped number
                    const nv = Number(result.stats[stat.name]);
                    if (!isFinite(nv)) return;
                    const oldVal = Number(stat.value) || 0;
                    stat.value = Math.max(0, Math.min(100, Math.round(nv)));
                    deltas[stat.name] = stat.value - oldVal;
                }
            });
        }
        const cleanSummary = aiName(result.summary, null, 400);   // junk ("-1") must not become the state line
        if (cleanSummary) profile.summary = cleanSummary;
        refreshLinkedStats(profile);           // stamp the snapshot with Vitals' current numbers
        saveSettings();

        const snapshotData = { stats: JSON.parse(JSON.stringify(profile.stats)), summary: profile.summary };
        snapshotData.stats.forEach(s => { s.delta = deltas[s.name] || 0; });
        if (!msg.extra) msg.extra = {};
        if (!msg.extra.rpg_status) msg.extra.rpg_status = {};
        msg.extra.rpg_status[charName] = snapshotData;
        saveChatDebounced();

        renderInlineStatus(messageId, charName, snapshotData);
        updateContextInjection();

    } catch (e) {
        console.error(`Status Update Failed for ${charName}:`, e);
        renderInlineStatus(messageId, charName, e.message, false, true);
    }
}

function updateContextInjection() {
    if (!settings.enabled || !settings.injectContext) {
        setExtensionPrompt(PROMPT_KEY, '', 0, 0, false);
        return;
    }

    let injectionText = "\n[System Notes - Character States]\n";
    const activeChars = getActiveCharacters();

    activeChars.forEach(char => {
        const p = settings.profiles[profileKey(char.name)];
        if (!p) return;
        refreshLinkedStats(p);
        const linked = (p.stats || []).filter(st => st.link).map(st => `${st.name} ${st.value}/100`).join(', ');
        injectionText += `${char.name}: ${p.summary}${linked ? ` (${linked})` : ''}\n`;
    });

    setExtensionPrompt(PROMPT_KEY, injectionText, 2, settings.injectDepth, false, extension_prompt_roles.SYSTEM);
}

// === IMPORT / EXPORT (per character; file carries the full profile) ===
function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportCurrentProfile() {
    const name = currentlyEditingChar || "Character";
    const profile = getProfile(name);
    const safe = String(name).replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, '_') || 'character';
    downloadJson({
        type: 'rpg_status_profile',
        version: 1,
        character: name,
        profile: JSON.parse(JSON.stringify(profile))
    }, `rpg_status_${safe}.json`);
    toastr.success(t('toast_exported', { char: escapeHtml(name) }));
}

function importProfile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // single-character file (our export) → apply onto the selected character
                if (data && data.profile && Array.isArray(data.profile.stats)) {
                    const target = currentlyEditingChar || data.character || "Character";
                    settings.profiles[target] = JSON.parse(JSON.stringify(data.profile));
                    saveSettings();
                    renderDynamicStats();
                    updateContextInjection();
                    toastr.success(t('toast_imported', { char: escapeHtml(target) }));
                    return;
                }

                // a map of {name: profile} → merge all (backward/forward compatible)
                if (data && typeof data === 'object') {
                    let n = 0;
                    for (const [name, prof] of Object.entries(data)) {
                        if (prof && Array.isArray(prof.stats)) { settings.profiles[name] = JSON.parse(JSON.stringify(prof)); n++; }
                    }
                    if (n > 0) {
                        saveSettings();
                        renderDynamicStats();
                        updateContextInjection();
                        toastr.success(t('toast_imported_all', { n }));
                        return;
                    }
                }

                toastr.error(t('toast_import_bad'));
            } catch (err) {
                console.error(err);
                toastr.error(t('toast_import_err'));
            }
        };
        reader.readAsText(file);
    };
    fileInput.click();
}

// === SETTINGS UI ===
function buildSettingsHtml() {
    return `
<div class="extension_settings rpg-status-settings">
    <div class="inline-drawer">
        <div class="rpg-drawer-toggle inline-drawer-header" style="cursor: pointer;">
            <b><i class="fa-solid fa-heart-pulse"></i> ${t('ui_header')}</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" id="rpg-drawer-content" style="display: none; padding-top: 10px;">
            <label class="checkbox_label">
                <input type="checkbox" id="rpg-enabled">
                ${t('ui_enable')}
            </label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10 margin-t-10">
                <label>${t('ui_language')}:</label>
                <select id="rpg-language" class="text_pole" style="width:auto;">
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
            <hr class="sysHR">
            <h4>${t('ui_api')}</h4>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <input type="text" id="rpg-base-url" class="text_pole flex1" placeholder="${t('ui_url')}">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <input type="password" id="rpg-api-key" class="text_pole flex1" placeholder="${t('ui_key')}">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <input type="text" id="rpg-model" class="text_pole flex1" placeholder="${t('ui_model')}">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label style="min-width: 120px;">${t('ui_temp')}</label>
                <input type="range" id="rpg-temperature" min="0" max="2" step="0.1" style="flex: 1;">
                <span id="rpg-temp-val" style="min-width: 30px; text-align: right;"></span>
            </div>
            <hr class="sysHR">
            <h4>${t('ui_gen')}</h4>
            <label class="checkbox_label" title="${t('ui_inject_title')}">
                <input type="checkbox" id="rpg-inject-context">
                <b>${t('ui_inject')}</b>
            </label>
            <label class="checkbox_label margin-t-10" title="${t('ui_per_chat_title')}">
                <input type="checkbox" id="rpg-per-chat">
                <b>${t('ui_per_chat')}</b>
            </label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10 margin-t-10">
                <label>${t('ui_update_every')}</label>
                <input type="number" id="rpg-freq" class="text_pole" min="1" max="15" style="width: 50px;">
                <label>${t('ui_messages')}</label>
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10" title="${t('ui_inject_depth_title')}">
                <label>${t('ui_inject_depth')}</label>
                <input type="number" id="rpg-inject-depth" class="text_pole" min="0" max="100" style="width: 50px;">
            </div>
            <hr class="sysHR">
            <div id="rpg-dynamic-stats-container"></div>
        </div>
    </div>
</div>
`;
}

function renderDynamicStats() {
    let activeChars = getActiveCharacters().map(c => c.name);
    if (activeChars.length === 0) activeChars = ["Character"];
    if (!currentlyEditingChar || !activeChars.includes(currentlyEditingChar)) {
        currentlyEditingChar = activeChars[0];
    }

    let html = `<h4>${t('ui_stat_config')}</h4>`;
    html += `<div class="flex-container alignitemscenter flexgap5 margin-b-10">
        <label>${t('ui_edit_for')}</label>
        <select id="rpg-char-select" class="text_pole flex1">`;
    activeChars.forEach(name => {
        html += `<option value="${escapeHtml(name)}" ${name === currentlyEditingChar ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    });
    html += `</select></div>`;

    // per-character profile export / import
    html += `<div class="flex-container flexgap5 margin-b-10">
        <div class="rpg-add-stat-btn flex1" id="rpg-export-profile" style="margin-bottom:0;"><i class="fa-solid fa-file-export"></i> ${t('ui_export_current')}</div>
        <div class="rpg-add-stat-btn flex1" id="rpg-import-profile" style="margin-bottom:0; background:rgba(105,240,174,0.15); border-color:#69f0ae;"><i class="fa-solid fa-file-import"></i> ${t('ui_import')}</div>
    </div>`;
    html += `<div class="rpg-add-stat-btn margin-b-10" id="rpg-reset-char" style="background:rgba(255,82,82,0.12); border-color:rgba(255,82,82,0.5);"><i class="fa-solid fa-rotate-left"></i> ${t('ui_reset')}</div>`;

    html += `<div class="rpg-add-stat-btn margin-b-10" id="rpg-ai-generate" style="background:rgba(139,92,246,0.25); border-color:rgba(139,92,246,0.7);"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('ui_ai_generate')}</div>`;

    html += `<div class="rpg-presets">
        <div class="rpg-preset-btn" data-preset="fantasy">${t('preset_fantasy')}</div>
        <div class="rpg-preset-btn" data-preset="survival">${t('preset_survival')}</div>
        <div class="rpg-preset-btn" data-preset="romance">${t('preset_romance')}</div>
    </div>`;
    html += `<div id="rpg-stats-setup-list">`;

    const profile = getProfile(currentlyEditingChar);

    profile.stats.forEach((stat, i) => {
        let colorOptionsHtml = "";
        for (const [key, name] of Object.entries(colorOptions())) {
            colorOptionsHtml += `<option value="${key}" ${stat.color === key ? 'selected' : ''}>${name}</option>`;
        }

        html += `
            <div class="rpg-settings-stat-block">
                <i class="fa-solid fa-trash rpg-delete-stat-btn" data-id="${i}" title="${t('ui_delete')}"></i>
                <input type="text" class="text_pole rpg-stat-name" data-id="${i}" value="${escapeHtml(stat.name)}" placeholder="${t('ui_stat_name_ph')}" style="width: 80%; margin-bottom: 5px;">
                <select class="text_pole rpg-stat-color" data-id="${i}" style="width: 100%; margin-bottom: 5px;">${colorOptionsHtml}</select>
                <textarea class="text_pole rpg-stat-desc" data-id="${i}" rows="2" placeholder="${t('ui_stat_desc_ph')}" style="width: 100%;">${escapeHtml(stat.desc)}</textarea>
                <label class="checkbox_label rpg-dyncolor-label" title="${t('ui_color_by_value_title')}">
                    <input type="checkbox" class="rpg-stat-dyncolor" data-id="${i}" ${stat.dynamicColor ? 'checked' : ''}>
                    <span>${t('ui_color_by_value')}</span>
                </label>
                <div class="flex-container alignitemscenter flexgap5" title="${t('ui_link_title')}">
                    <label style="font-size:0.85em;">${t('ui_link_label')}</label>
                    <select class="text_pole rpg-stat-link" data-id="${i}" style="flex:1;">
                        <option value="" ${!stat.link ? 'selected' : ''}>${t('link_none')}</option>
                        ${LINK_KEYS.map(k => `<option value="${k}" ${stat.link === k ? 'selected' : ''}>${t('link_' + k)}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
    });

    html += `</div><div class="rpg-add-stat-btn" id="rpg-add-stat"><i class="fa-solid fa-plus"></i> ${t('ui_add_stat')}</div>`;
    $('#rpg-dynamic-stats-container').html(html);

    $('#rpg-char-select').on('change', function () {
        currentlyEditingChar = $(this).val();
        renderDynamicStats();
    });

    $('#rpg-export-profile').on('click', exportCurrentProfile);
    $('#rpg-import-profile').on('click', importProfile);
    $('#rpg-reset-char').on('click', () => {
        if (confirm(t('confirm_reset', { char: currentlyEditingChar }))) resetCharacter(currentlyEditingChar);
    });
    $('#rpg-ai-generate').on('click', () => {
        if (confirm(t('confirm_ai_generate', { char: currentlyEditingChar }))) generateStatsForCharacter(currentlyEditingChar);
    });

    $('#rpg-add-stat').on('click', () => {
        profile.stats.push({ name: t('new_stat_name'), desc: t('new_stat_desc'), color: "blue", value: 100, dynamicColor: false });
        saveSettings(); renderDynamicStats();
    });

    $('.rpg-delete-stat-btn').on('click', function () {
        profile.stats.splice($(this).data('id'), 1);
        saveSettings(); renderDynamicStats();
    });

    $('.rpg-stat-name').on('input', function () { profile.stats[$(this).data('id')].name = $(this).val(); saveSettings(); });
    $('.rpg-stat-desc').on('input', function () { profile.stats[$(this).data('id')].desc = $(this).val(); saveSettings(); });
    $('.rpg-stat-color').on('change', function () { profile.stats[$(this).data('id')].color = $(this).val(); saveSettings(); });
    $('.rpg-stat-dyncolor').on('change', function () { profile.stats[$(this).data('id')].dynamicColor = this.checked; saveSettings(); });
    $('.rpg-stat-link').on('change', function () {
        const st = profile.stats[$(this).data('id')];
        st.link = $(this).val() || '';
        if (st.link) {
            const nv = linkedValue(st.link);
            if (nv !== null) st.value = nv; else toastr.info(t('link_missing'));
        }
        saveSettings(); updateContextInjection();
    });

    $('.rpg-preset-btn').on('click', function () {
        const preset = statPresets()[$(this).data('preset')];
        if (!preset) return;
        if (!confirm(t('confirm_preset', { char: currentlyEditingChar }))) return;
        profile.stats = JSON.parse(JSON.stringify(preset));
        saveSettings();
        renderDynamicStats();
    });
}

function mountSettings() {
    $('.rpg-status-settings').remove();
    $('#extensions_settings').append(buildSettingsHtml());

    $('.rpg-status-settings .rpg-drawer-toggle').on('click', function () {
        $('#rpg-drawer-content').slideToggle();
        $(this).find('.inline-drawer-icon').toggleClass('down up');
    });

    $('#rpg-enabled').prop('checked', settings.enabled).on('change', function () {
        settings.enabled = this.checked;
        saveSettings();
        updateContextInjection();
        if (this.checked) restoreStatusesOnLoad();
    });

    $('#rpg-language').val(settings.language).on('change', function () {
        settings.language = $(this).val();
        saveSettings();
        mountSettings();           // re-skin settings in the new language
        restoreStatusesOnLoad();   // re-render inline labels in the new language
    });

    $('#rpg-base-url').val(settings.baseUrl).on('input', function () { settings.baseUrl = $(this).val(); saveSettings(); });
    $('#rpg-api-key').val(settings.apiKey).on('input', function () { settings.apiKey = $(this).val(); saveSettings(); });
    $('#rpg-model').val(settings.model).on('input', function () { settings.model = $(this).val(); saveSettings(); });
    $('#rpg-freq').val(settings.updateFrequency).on('change', function () { settings.updateFrequency = Math.max(1, parseInt($(this).val()) || 5); $(this).val(settings.updateFrequency); saveSettings(); });
    $('#rpg-inject-depth').val(settings.injectDepth).on('change', function () { settings.injectDepth = Math.max(0, parseInt($(this).val()) || 0); $(this).val(settings.injectDepth); saveSettings(); updateContextInjection(); });
    $('#rpg-inject-context').prop('checked', settings.injectContext).on('change', function () { settings.injectContext = this.checked; saveSettings(); updateContextInjection(); });
    $('#rpg-per-chat').prop('checked', settings.perChatProfiles).on('change', function () {
        settings.perChatProfiles = this.checked;
        saveSettings();
        renderDynamicStats();
        updateContextInjection();
    });

    $('#rpg-temperature').val(settings.temperature).on('input', function () {
        const val = parseFloat($(this).val());
        $('#rpg-temp-val').text(val);
        settings.temperature = val;
        saveSettings();
    });
    $('#rpg-temp-val').text(settings.temperature);

    renderDynamicStats();
}

/* ============================================================
   STATUS RECONCILIATION
   The status block lives inside .mes_text, which SillyTavern rebuilds from scratch on swipes,
   edits, "continue", regex scripts and when older messages are printed lazily on scroll.
   Any of those detach the block while the data in msg.extra.rpg_status stays intact.
   A MutationObserver on #chat re-attaches every status a message has in its data but not in
   its DOM, which keeps rendering in sync without depending on any single event.
   ============================================================ */
let reconcileTimer = null;
function reconcileStatuses() {
    if (!settings.enabled) return;
    const chat = getContext().chat;
    if (!chat || !chat.length) return;
    document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
        const id = parseInt(el.getAttribute('mesid'), 10);
        if (isNaN(id)) return;
        const msg = chat[id];
        const data = msg && msg.extra && msg.extra.rpg_status;
        if (!data || typeof data !== 'object') return;
        Object.keys(data).forEach(charName => {
            if (!findStatusContainer(el, charName)) renderInlineStatus(id, charName, data[charName]);
        });
    });
}
function scheduleReconcile() { clearTimeout(reconcileTimer); reconcileTimer = setTimeout(reconcileStatuses, 150); }

let chatObserver = null;
function observeChat() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) { setTimeout(observeChat, 500); return; }   // ST hasn't built the chat pane yet
    if (chatObserver) chatObserver.disconnect();
    // childList only; re-attaching settles on the first pass, so the observer converges
    chatObserver = new MutationObserver(scheduleReconcile);
    chatObserver.observe(chatEl, { childList: true, subtree: true });
}

/* Group membership can change without a CHAT_CHANGED, so the stat editor's character list has
   to be rebuilt on group events as well. Rebuild only when the cast actually changed, otherwise
   redrawing would drop focus from a stat field being edited. */
let lastCastKey = '';
function refreshCastIfChanged(force) {
    const cast = getActiveCharacters().map(c => c.name).join('\u0001');
    if (!force && cast === lastCastKey) return;
    lastCastKey = cast;
    renderDynamicStats();
}

function restoreStatusesOnLoad() {
    if (!settings.enabled) return;
    const context = getContext();
    if (!context.chat) return;

    context.chat.forEach((msg, idx) => {
        if (msg.extra?.rpg_status) {
            for (const [charName, statsData] of Object.entries(msg.extra.rpg_status)) {
                renderInlineStatus(idx, charName, statsData);
            }
        }
    });
    updateContextInjection();
    scheduleReconcile();   // messages not yet printed are picked up by the observer
}

jQuery(() => {
    try {
        loadSettings();
        pruneOldStates();
        mountSettings();
        updateContextInjection();

        observeChat();

        eventSource.on(event_types.CHAT_CHANGED, () => {
            lastCastKey = '';            // force a rebuild of the character list for the new chat
            refreshCastIfChanged(true);
            restoreStatusesOnLoad();
        });

        // Adding or removing a group member does not fire CHAT_CHANGED; these events do.
        ['GROUP_UPDATED', 'GROUP_MEMBER_DRAFTED', 'CHARACTER_EDITED', 'CHARACTER_DELETED', 'CHARACTER_DUPLICATED']
            .forEach(k => { if (event_types[k]) eventSource.on(event_types[k], () => refreshCastIfChanged(false)); });

        // Fallback for builds that expose none of the group events above.
        $(document).on('click', '.rpg-status-settings .rpg-drawer-toggle', () => setTimeout(() => refreshCastIfChanged(false), 0));

        // Events that rebuild message bodies. MORE_MESSAGES_LOADED covers the lazy printing of
        // older messages on scroll, which is not otherwise announced.
        ['MORE_MESSAGES_LOADED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'USER_MESSAGE_RENDERED', 'GENERATION_ENDED', 'CHAT_LOADED']
            .forEach(k => { if (event_types[k]) eventSource.on(event_types[k], scheduleReconcile); });

        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
            if (!settings.enabled) return;
            const msg = getContext().chat[messageId];
            if (msg && !msg.is_user && !msg.is_system && msg.extra?.rpg_status?.[msg.name]) {
                renderInlineStatus(messageId, msg.name, msg.extra.rpg_status[msg.name]);
            }
            scheduleReconcile();
        });

        eventSource.on(event_types.MESSAGE_EDITED, (messageId) => {
            if (!settings.enabled) return;
            const msg = getContext().chat[messageId];
            if (msg && !msg.is_user && !msg.is_system && msg.extra?.rpg_status?.[msg.name]) {
                renderInlineStatus(messageId, msg.name, msg.extra.rpg_status[msg.name]);
            }
        });

        eventSource.on(event_types.MESSAGE_RECEIVED, async (messageId) => {
            const msg = getContext().chat[messageId];
            if (msg && !msg.is_user && !msg.is_system) {
                setTimeout(async () => await processCharacterStatus(messageId, msg.name, false), 50);
            }
        });

        eventSource.on(event_types.MESSAGE_SWIPED, async (messageId) => {
            const msg = getContext().chat[messageId];
            if (msg && !msg.is_user && !msg.is_system) {
                setTimeout(async () => await processCharacterStatus(messageId, msg.name, false), 50);
            }
        });

    } catch (e) {
        console.error("[RPG Status Bar] Fatal Initialization Error:", e);
    }
});
