// ==== CRIMSON THRONE - JOURNAL SCRIPT =====================================
(function () {
  const MODULE_ID = "crimson-throne-xr0mi";
  const WRAP_CSS = "ct-wrapper";
  const DOC_CSS = "ct-doc";
  const SHEET_NAME = "CtJournalSheet";

  /** Включать стиль для всех журналов (true) или по флагу/паку/листу (false). */
  const APPLY_TO_ALL = false;
  const PACK_IDS = ["crimson-throne-xr0mi.crimson-throne-ru"];

  const JournalEntryDocument = foundry?.documents?.JournalEntry ?? globalThis.JournalEntry;
  const JournalEntryPageDocument = foundry?.documents?.JournalEntryPage ?? globalThis.JournalEntryPage;
  const BaseJournalSheet =
    foundry?.applications?.sheets?.journal?.JournalEntrySheet ??
    globalThis.JournalEntrySheet ??
    globalThis.JournalSheet;
  const SheetConfig =
    foundry?.applications?.apps?.DocumentSheetConfig ??
    globalThis.DocumentSheetConfig;

  function asElement(html) {
    return globalThis.CrimsonThroneCompat?.asElement?.(html)
      ?? (html instanceof HTMLElement ? html : html?.[0]);
  }

  function appRoot(app, html) {
    const element = asElement(html) ?? asElement(app?.element) ?? app?.element;
    if (!element?.closest) return element;
    return element.closest(".application, .window-app, .app") ?? element;
  }

  function isJournalEntry(entry) {
    if (!entry) return false;
    if (JournalEntryDocument && entry instanceof JournalEntryDocument) return true;
    return entry.documentName === "JournalEntry";
  }

  function getEntry(app) {
    const document = app?.document ?? app?.object;
    if (isJournalEntry(document)) return document;
    if (JournalEntryPageDocument && document instanceof JournalEntryPageDocument) return document.parent;
    if (document?.documentName === "JournalEntryPage") return document.parent;
    return null;
  }

  function isPageEditor(app) {
    const document = app?.document ?? app?.object;
    if (JournalEntryPageDocument && document instanceof JournalEntryPageDocument) return true;
    return document?.documentName === "JournalEntryPage";
  }

  function sourceMatchesPack(sourceId) {
    if (typeof sourceId !== "string") return false;
    return PACK_IDS.some((packId) => sourceId.startsWith(`Compendium.${packId}.`));
  }

  function isFromOurPacks(entry) {
    try {
      if (!entry) return false;
      if (entry.pack && PACK_IDS.includes(entry.pack)) return true;
      return sourceMatchesPack(entry.flags?.core?.sourceId ?? entry._stats?.compendiumSource);
    } catch (_e) {
      return false;
    }
  }

  function isOurSheet(app) {
    return app?.constructor?.name === SHEET_NAME || (CtJournalSheet && app instanceof CtJournalSheet);
  }

  function shouldApplyStyle(app, entry) {
    if (!entry) return false;
    if (APPLY_TO_ALL) return true;
    return isOurSheet(app) || entry.getFlag?.(MODULE_ID, "useCtStyle") === true || isFromOurPacks(entry);
  }

  function addContentClasses(root) {
    const selectors = [
      ".journal-entry-content",
      ".journal-entry-pages",
      ".journal-page-content",
      ".journal-entry-page"
    ];

    for (const selector of selectors) {
      root.querySelectorAll?.(selector).forEach((element) => element.classList.add(DOC_CSS));
    }

    classifyHandouts(root);
  }

  const HANDOUT_RULES = [
    { className: "ct-treasure", pattern: /сокровищ|treasure/i },
    { className: "ct-award", pattern: /награда|награду|award|xp/i },
    { className: "ct-encounter", pattern: /существ|существо|противник|столкновен|бой/i },
    { className: "ct-hazard", pattern: /опасност|ловушк|наваждени|руна|обвал|hazard|trap/i },
    { className: "ct-clue", pattern: /улик|след|подсказк|информац/i },
    { className: "ct-check", pattern: /проверк|кc|кс|сложност|dc/i },
    { className: "ct-development", pattern: /развити|последств|событ/i }
  ];

  function classifyHandouts(root) {
    root.querySelectorAll?.(".ct-handout").forEach((block) => {
      const heading = block.querySelector("h1,h2,h3,h4,h5,h6")?.textContent ?? "";
      const source = heading.trim() || (block.textContent ?? "").trim().slice(0, 180);
      if (!source) return;

      for (const rule of HANDOUT_RULES) {
        if (block.classList.contains(rule.className)) continue;
        if (rule.pattern.test(source)) block.classList.add(rule.className);
      }
    });
  }

  function applyCtStyle(app, html) {
    if (isPageEditor(app)) return;

    const entry = getEntry(app);
    if (!shouldApplyStyle(app, entry)) return;

    const root = appRoot(app, html);
    if (!root?.classList) return;

    root.classList.add(WRAP_CSS, "journal-sheet");
    addContentClasses(root);
    centerIfOffscreen(app);
  }

  function centerIfOffscreen(app) {
    try {
      const pos = app.position ?? {};
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = pos.width ?? 900;
      const h = pos.height ?? 700;
      const left = pos.left ?? 0;
      const top = pos.top ?? 0;

      const tooRight = left > vw - 120 || left < 0;
      const tooLow = top > vh - 80 || top < 0;

      if (tooRight || tooLow) {
        app.setPosition?.({
          left: Math.max((vw - w) / 2, 20),
          top: Math.max((vh - h) / 2, 20)
        });
      }
    } catch (_e) {
      /* no-op */
    }
  }

  let CtJournalSheet = null;
  if (BaseJournalSheet) {
    CtJournalSheet = class CtJournalSheet extends BaseJournalSheet {
      async _onRender(...args) {
        await super._onRender?.(...args);
        applyCtStyle(this, this.element);
      }

      async _render(...args) {
        await super._render?.(...args);
        applyCtStyle(this, this.element);
      }
    };
  }

  Hooks.on("renderJournalSheet", applyCtStyle);
  Hooks.on("renderJournalEntrySheet", applyCtStyle);
  Hooks.on("renderJournalEntryPageSheet", (pageApp, html) => {
    const sheet = pageApp.document?.parent?.sheet;
    if (sheet?.element) applyCtStyle(sheet, sheet.element);
  });

  Hooks.once("init", () => {
    if (!CtJournalSheet || !SheetConfig || !JournalEntryDocument) {
      console.warn(`[${MODULE_ID}] Journal theme sheet registration skipped: API unavailable.`);
      return;
    }

    try {
      SheetConfig.registerSheet(JournalEntryDocument, MODULE_ID, CtJournalSheet, {
        label: "Тема \"Багряный Трон\"",
        makeDefault: false,
        canConfigure: true,
        canBeDefault: true
      });
    } catch (error) {
      console.warn(`[${MODULE_ID}] Journal theme sheet registration failed.`, error);
    }
  });

  Hooks.on("preCreateJournalEntry", (document, data) => {
    try {
      const sourceId =
        data?.flags?.core?.sourceId ??
        document?._source?.flags?.core?.sourceId ??
        document?.flags?.core?.sourceId;
      if (!sourceMatchesPack(sourceId)) return;

      document.updateSource?.({ [`flags.${MODULE_ID}.useCtStyle`]: true });
      if (data) {
        data.flags ??= {};
        data.flags[MODULE_ID] ??= {};
        data.flags[MODULE_ID].useCtStyle = true;
      }
    } catch (_e) {
      /* no-op */
    }
  });
})();
