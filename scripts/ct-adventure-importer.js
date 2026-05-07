// ==== CRIMSON THRONE - ADVENTURE IMPORTER THEME ============================
(function () {
  const CTA_MODULE_ID = "crimson-throne-xr0mi";
  const CTA_PACK_IDS = ["crimson-throne-xr0mi.crimson-throne-ru"];
  const CTA_SHEET_NAME = "CtAdventureImporter";
  const CTA_SHEET_CLASS = `${CTA_MODULE_ID}.${CTA_SHEET_NAME}`;

  const CTA_AdventureImporterBase =
    foundry?.applications?.sheets?.AdventureImporter ?? globalThis.AdventureImporter;
  const CTA_SheetConfig =
    foundry?.applications?.apps?.DocumentSheetConfig ?? globalThis.DocumentSheetConfig;
  const CTA_AdventureDocument =
    foundry?.documents?.Adventure ?? globalThis.Adventure;

  function sourceMatchesPack(sourceId) {
    if (typeof sourceId !== "string") return false;
    return CTA_PACK_IDS.some((packId) => sourceId.startsWith(`Compendium.${packId}.`));
  }

  function getAdventureSourceId(adventureLike) {
    return (
      adventureLike?.flags?.core?.sourceId ??
      adventureLike?._stats?.compendiumSource ??
      null
    );
  }

  function isOurAdventure(adventureLike) {
    if (!adventureLike) return false;
    if (adventureLike.pack && CTA_PACK_IDS.includes(adventureLike.pack)) return true;
    return sourceMatchesPack(getAdventureSourceId(adventureLike));
  }

  function asRootElement(app, html) {
    if (html?.[0] instanceof HTMLElement) return html[0];
    if (html instanceof HTMLElement) return html;
    if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
    if (app?.element instanceof HTMLElement) return app.element;
    return null;
  }

  function addImporterClasses(app, html) {
    const adventure = app?.document ?? app?.object ?? null;
    if (!isOurAdventure(adventure)) return;

    const root = asRootElement(app, html);
    if (!root) return;

    root.classList.add("ct-wrapper", "ct-adventure-importer");
  }

  let CtAdventureImporter = null;
  if (CTA_AdventureImporterBase) {
    CtAdventureImporter = class CtAdventureImporter extends CTA_AdventureImporterBase {
      static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(
          super.DEFAULT_OPTIONS,
          { classes: ["ct-wrapper", "ct-adventure-importer"] },
          { inplace: false }
        );
      }

      _initializeApplicationOptions(options) {
        const appOptions = super._initializeApplicationOptions(options);
        appOptions.classes ??= [];
        if (!appOptions.classes.includes("ct-wrapper")) appOptions.classes.push("ct-wrapper");
        if (!appOptions.classes.includes("ct-adventure-importer")) appOptions.classes.push("ct-adventure-importer");
        return appOptions;
      }
    };
  }

  Hooks.once("init", () => {
    if (!CtAdventureImporter || !CTA_SheetConfig || !CTA_AdventureDocument) {
      console.warn(`[${CTA_MODULE_ID}] Adventure importer theme init skipped: API unavailable.`);
      return;
    }

    CTA_SheetConfig.registerSheet(CTA_AdventureDocument, CTA_MODULE_ID, CtAdventureImporter, {
      label: "Crimson Throne Importer",
      makeDefault: false,
      canConfigure: true,
      canBeDefault: true
    });
    console.log(`[${CTA_MODULE_ID}] Adventure importer sheet registered.`);
  });

  Hooks.on("preCreateAdventure", (_document, data) => {
    if (!isOurAdventure(data)) return;
    data.flags ??= {};
    data.flags.core ??= {};
    data.flags.core.sheetClass = CTA_SHEET_CLASS;
  });

  Hooks.once("ready", async () => {
    if (!game.user?.isGM) return;
    if (!CtAdventureImporter || !CTA_SheetConfig || !CTA_AdventureDocument) return;

    const updates = [];
    const adventures = game.adventures ?? [];
    for (const adventure of adventures) {
      if (!isOurAdventure(adventure)) continue;
      if (adventure.flags?.core?.sheetClass === CTA_SHEET_CLASS) continue;
      updates.push({ _id: adventure.id, "flags.core.sheetClass": CTA_SHEET_CLASS });
    }

    if (updates.length) await CTA_AdventureDocument.updateDocuments(updates);
  });

  Hooks.on("renderAdventureImporter", addImporterClasses);
  Hooks.on("renderAdventureImporterV1", addImporterClasses);
  Hooks.on("renderAdventureImporterV2", addImporterClasses);
})();
