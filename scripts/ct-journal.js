// ==== CRIMSON THRONE — JOURNAL SCRIPT =====================================

const MODULE_ID = "crimson-throne-xr0mi";
const WRAP_CSS  = "ct-wrapper";
const DOC_CSS   = "ct-doc";

/** Включать стиль для всех журналов (true) или по флагу/паку (false) */
const APPLY_TO_ALL = false;
/** Если APPLY_TO_ALL = false, то можно ограничить по компендию: */
const PACK_IDS = [
  "crimson-throne-xr0mi.crimson-throne-ru"
];

function isFromOurPacks(entry) {
  try {
    if (!entry) return false;
    if (entry.pack && PACK_IDS.includes(entry.pack)) return true;
    const src = entry.flags?.core?.sourceId;
    if (typeof src === "string") {
      // Compendium.<moduleId>.<packId>.<uuid>
      return PACK_IDS.some(pid => src.startsWith(`Compendium.${pid}.`));
    }
  } catch (_e) { /* no-op */ }
  return false;
}

function applyCtStyle(app, html) {
  const entry = app.object ?? app.document;
  if (!(entry instanceof JournalEntry)) return;

  // Решаем, применять ли стиль
  let enable = APPLY_TO_ALL;
  const isOurSheet = app?.constructor?.name === "CtJournalSheet";
  if (!APPLY_TO_ALL) {
    enable = isOurSheet || entry.getFlag(MODULE_ID, "useCtStyle") === true;
  }
  if (!enable) return;

  // Классы-метки для CSS
  html.addClass(WRAP_CSS);
  html.find(".journal-entry-content, .journal-entry-pages, .journal-page-content").addClass(DOC_CSS);

  // Если окно улетело за край (из-за запомненной позиции), мягко центрируем
  centerIfOffscreen(app);
}

function centerIfOffscreen(app) {
  try {
    const pos = app.position ?? {};
    const vw = window.innerWidth, vh = window.innerHeight;
    const w  = pos.width  ?? 900;
    const h  = pos.height ?? 700;
    const L  = pos.left ?? 0;
    const T  = pos.top  ?? 0;

    const tooRight = L > vw - 120 || L < 0;
    const tooLow   = T > vh - 80  || T < 0;

    if (tooRight || tooLow) {
      app.setPosition({
        left: Math.max((vw - w) / 2, 20),
        top:  Math.max((vh - h) / 2, 20)
      });
    }
  } catch (_e) { /* no-op */ }
}

// Подключаемся к рендерам листов журнала
Hooks.on("renderJournalSheet", applyCtStyle);
Hooks.on("renderJournalEntrySheet", applyCtStyle);

// Для v13: когда рендерится страница, применим стиль и к родительскому окну
Hooks.on("renderJournalEntryPageSheet", (pageApp) => {
  const je = pageApp.document?.parent;
  const sheet = je?.sheet;
  if (sheet?.element?.length) applyCtStyle(sheet, sheet.element);
});

// ----- Регистрация собственного Journal Sheet и автоприменение для наших журналов -----
class CtJournalSheet extends JournalSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    opts.sheetConfig = true; // показывать кнопку «Бланк»
    return opts;
  }

  async _render(force, options) {
    await super._render(force, options);
    try { applyCtStyle(this, this.element); } catch (_e) { /* no-op */ }
  }
}

Hooks.once("init", () => {
  try {
    DocumentSheetConfig.registerSheet(JournalEntry, MODULE_ID, CtJournalSheet, {
      label: () => "Тема \"Алый Трон\"",
      makeDefault: false
    });
  } catch (_e) { /* no-op */ }
});

// Автовыбор нашего шита при импорте из компендия приключения
Hooks.on("preCreateJournalEntry", (_doc, data) => {
  try {
    const src = data?.flags?.core?.sourceId;
    if (!src) return;
    const matches = PACK_IDS.some(pid => typeof src === "string" && src.startsWith(`Compendium.${pid}.`));
    if (!matches) return;
    data.flags = data.flags ?? {};
    data.flags.core = data.flags.core ?? {};
    data.flags.core.sheetClass = `${MODULE_ID}.CtJournalSheet`;
  } catch (_e) { /* no-op */ }
});

// Переключатель темы в кнопках заголовка листа журнала (v13)
// (UI toggle removed — используем стандартный выбор «Бланк»)

// Контекстное меню в директории журналов: включить/выключить тему
// (Контекстное меню отключено — используем стандартный выбор «Бланк»)
