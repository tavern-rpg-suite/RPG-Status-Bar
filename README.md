# RPG Status Bar

A SillyTavern extension that shows an **inline status bar under each character message** — health, mana, stamina, mood, trust, arousal… whatever stats you define. An AI Game Master reads the recent story and updates the values periodically, with animated bars, trend arrows, critical-state warnings, and a one-line summary that can be injected back into the prompt so the model stays aware of the character's condition.

**Version 1.4.0**

---

## ✨ Features

- 📊 **Inline stat bars** under character messages, in a smooth collapsible accordion.
- 🎯 **Any stats you want** — per-character stat sets with custom names, colors and AI descriptions.
- 🧙 **Presets** — Fantasy (health/mana/stamina), Survival (satiety/hydration/warmth), Romance (trust/attraction/mood).
- ✨ **AI stat designer** — one click and the AI reads the character card and invents 4 custom stats (name, color, description, starting value) that fit that character.
- 🤖 **AI-updated** — a strict "GM calculator" adjusts values from the last messages every N turns (or on demand via **Recalculate**).
- 🎨 **Color by value** — bars go green → gold → red as a value drops; plus ▲/▼ trend arrows and a pulsing **critical** state.
- 🧠 **Context injection** — a short state summary is fed into the system prompt so the model plays the condition.
- 🗂️ **Per-character or per-chat** — keep one persistent status per character, or give every chat its own independent state.
- 💾 **Export / import** per character, and a **Reset character** button.
- 🌍 **Bilingual UI (RU / EN)** — one-click switch; the AI summary language follows it too.
- 👥 **Group chats** — each speaking character gets and shows its own status.

## 📦 Install

Copy the `RPG Status Bar` folder into:

```
SillyTavern/data/<user>/extensions/
```

Reload SillyTavern and enable it in **Extensions → RPG Status Bar**.

## ⚙️ Setup

1. Enable **RPG Status Bar**.
2. Pick **Interface language** (English / Русский).
3. Fill in **API Settings** — URL / API key / model (OpenAI-compatible; default `google/gemma-4-31b-it`). A cheap, fast model at low temperature works well here.
4. Choose **how often** to update (every N messages) and whether to **inject** the summary.
5. Under **Stat configuration**, pick a preset or build your own stats per character.

## 📊 Stats & how updates work

Each stat has a name, a color, and a description that tells the AI what moves it. Every N character messages (or when you press **Recalculate** on a bar) the extension sends the last few messages to the model, which returns new 0–100 values and a one-sentence summary. Snapshots are stored per message in the chat, so scrolling back shows the status at that point.

**Generate 4 stats (AI)** reads the selected character's card (description / personality / scenario) and designs four fitting stats automatically — a great starting point you can then tweak. It replaces the current stats and uses your configured model and interface language.

**Color by value** is best for "higher = better" stats (health, stamina): the bar shifts green/gold/red with the number. Leave it off for stats where a fixed semantic color is clearer.

## 🗂️ Per-character vs per-chat

By default a character's status is **global** — the same Health follows them into every chat. Turn on **"Separate status for each chat"** to give every chat its own independent values (a new chat starts fresh instead of continuing old HP). The stat *setup* is seeded from the character's global template, so you don't reconfigure stats each time.

**Reset character** restores the current character's values to a fresh baseline (per-chat: reseeds from the template; global: full values + cleared summary).

## 💾 Export / import

In **Stat configuration**, pick a character and use **Export current character** to save a `.json` with the full profile (stat setup + current values + summary). **Import profile** applies a file onto the character selected in the dropdown. Files with multiple profiles are merged. Handy for moving setups between machines or sharing a character's stat sheet.

## 👥 Group chats

Fully supported: the status is computed and rendered **per speaking character**, the editor lets you pick any group member, and the injected summary lists everyone present. Members are matched by avatar, index, or name.

## 🧩 Notes

- Stat keys are sent to the AI verbatim; keep names concise.
- Past message snapshots keep the language they were generated in; new ones follow the current language.
- CSS is namespaced (`rpg-*`); nothing global is touched.

## 🩺 Troubleshooting

- **The status block disappears from a message.** Fixed in 1.4.0. The block lives inside `.mes_text`, which SillyTavern rebuilds on swipes, edits, "continue", regex scripts and when older messages are printed lazily on scroll (`MORE_MESSAGES_LOADED`, which was not being listened for). A `MutationObserver` on `#chat` re-attaches any status a message has in its data but not in its DOM. Only the rendering was affected; the stored values were never lost.
- **A character added to a group appears under "Edit stats for:" only after a reload.** Fixed in 1.4.0. The list was rebuilt on `CHAT_CHANGED` only, which editing a group roster does not fire. It now also listens to `GROUP_UPDATED` / `GROUP_MEMBER_DRAFTED`, and rebuilds only when the cast actually changed so that focus is not dropped from a field being edited.
- **Characters whose name contains an apostrophe do not render.** Fixed in 1.4.0. The container was resolved with an attribute selector, which is invalid for such names and aborted the render.
