// ==== CRIMSON THRONE — JOURNAL SCRIPT =====================================

const MODULE_ID = "crimson-throne-xr0mi";
const WRAP_CSS  = "ct-wrapper";
const DOC_CSS   = "ct-doc";

/** Включать стиль для всех журналов (true) или по флагу/паку (false) */
const APPLY_TO_ALL = true;
/** Если APPLY_TO_ALL = false, то можно ограничить по компендию: */
const PACK_ID = "crimson-throne-xr0mi.crimson-throne-ru";

function applyCtStyle(app, html) {
  const entry = app.object ?? app.document;
  if (!(entry instanceof JournalEntry)) return;

  // Решаем, применять ли стиль
  let enable = APPLY_TO_ALL;
  if (!APPLY_TO_ALL) {
    enable = entry.pack === PACK_ID || entry.getFlag(MODULE_ID, "useCtStyle") === true;
  }
  if (!enable) return;

  // Классы-метки для CSS
  html.addClass(WRAP_CSS);
  html.find(".journal-entry-content, .journal-entry-pages").addClass(DOC_CSS);

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
