# RPG Equipment & Durability

A SillyTavern extension that gives the player a worn **outfit** across six slots, each with a **durability** bar that wears down as the story goes on and eventually **breaks**. The current outfit (and its condition) is quietly injected into the prompt each turn, so the character can *see* what you're wearing — a torn coat, broken boots, a drawn sword.

> Design principle: **the extension is the source of truth, the chat is just the narrator.** Durability is computed by the extension on a fixed schedule — the model never does the math, it only reads a short state note. Part of the RPG suite: it exposes `window.RPG.equipment` (RPG Vitals reads it for armor/attack) and can pull repair materials from `window.RPG.inventory`.

**Version 1.9.4**

---

## ✨ Features

- 🧥 **Six slots** — Head · Top · Bottom · Boots · Accessory · Weapon — on a "case-file / dossier" card.
- 📉 **Durability** — each piece has a bar (current / max) and a state word: *good → worn → tattered → BROKEN*. A broken item stays equipped (shown as damaged) so the scene can react.
- ⚙️ **Deterministic decay** — every *N* messages each piece loses durability; at 0 it breaks. No AI guesswork.
- 🩹 **Field patch** — an improvised, low-chance repair (success % is a setting) to avoid hitting 0 in a pinch.
- 🛠️ **Edit mode** — full manual control: repair to full, clear a slot, or add an item by hand.
- 👕 **Auto-outfit from the character description** — one button dresses the player in setting-appropriate gear based on their persona.
- ⚔️🛡️ **Stats** — armor pieces mitigate incoming damage and a weapon adds attack; these feed RPG Vitals when present.
- 🧠 **Context injection** — a compact note like `[{{user}}'s outfit — Top: Leather coat (worn); Boots: Boots (BROKEN). {{char}} can see this.]`.
- 🎒 **Inventory-aware** — repair using materials from the RPG Inventory module if it's installed.
- 🌍 **Bilingual (RU / EN)**; state saved per chat.

## 📦 Install

Copy the `RPG-Equipment-Durability` folder into your third-party extensions folder (e.g. `SillyTavern/data/<user>/extensions/`), reload, and enable it in **Extensions → RPG Equipment (Outfit & Durability)**.

## ⚙️ Setup

1. Tick **Enable Equipment** and pick a **Language**.
2. Fill in an OpenAI-compatible **URL / API Key / Model** (default `google/gemma-4-31b-it`) — used for auto-outfit and the optional wear/equip AI checks.
3. Tune **Durability drops every (messages)** and **Durability lost each time** (large interval = gentle game), the **field-patch success chance**, and the **injection depth**.

A shirt button appears on the right side to open the panel.

## 🧠 How it works

Every *N* messages each equipped piece loses durability; at 0 it breaks (stays equipped, shown broken). With **AI wear** on, the model reads the latest scene and reports damage to the *specific* garment the scene hit, which the extension applies to the right slot. The current outfit is injected each turn so the character narrates around it (a broken helm, a torn cloak). If armor stats are on, worn pieces reduce incoming HP damage in RPG Vitals and the weapon sets your attack.

**Auto-outfit** reads the player's own description and fills only the slots the description actually supports — empty slots are left empty (it won't invent a "none" placeholder).

## 🔌 Cross-extension bridge

Exposes `window.RPG.equipment`: `isEnabled()`, `list()`, `repairable()`, `repair(slot, amount)`, plus armor/attack totals consumed by RPG Vitals. Reads `window.RPG.inventory` to repair with backpack materials when that module is present.

## 🩺 Troubleshooting

- **Empty slots were getting filled with "нет".** Fixed in 1.9.3 — auto-outfit now leaves unsupported slots empty and skips "none"-type answers (and clears a previously auto-added placeholder on the next scan).
- **Setting a starting durability did nothing (item was always 100%).** Fixed in 1.9.4 — the manual add form now has a separate **Durability** field (current) next to **Max**; leave it blank for a fresh full item, or enter e.g. 30 for a worn one.
- **The chat says my coat tore but the bar didn't move.** Turn on AI wear, or just fix the number in Edit mode — the tracker is the source of truth.
- **Auto-outfit/AI checks do nothing.** They need a working URL / key / model.