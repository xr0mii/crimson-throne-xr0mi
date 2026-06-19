// Harrow Points Tracker for Foundry VTT v13+
// Encapsulated to avoid global name collisions
(function(){
  const MOD = "crimson-throne-xr0mi";
  const FLAG_KEY = "harrowPoints";
  const CT = globalThis.CrimsonThroneCompat;
  const BaseApplication = CT?.getTemplateApplicationBase?.();

  if (!BaseApplication) {
    console.warn(`[${MOD}] Harrow tracker disabled: no compatible Application API found.`);
    return;
  }

  class HarrowTracker extends BaseApplication {
    static get DEFAULT_OPTIONS() {
      return CT.v2Options({
        id: "harrow-tracker",
        title: "Очки Харроу",
        classes: ["harrow-tracker", "sheet"],
        width: 420
      });
    }

    static get PARTS() {
      return CT.singleTemplatePart(`modules/${MOD}/templates/harrow-tracker.html`);
    }

    static get defaultOptions() {
      return CT.v1Options(super.defaultOptions, {
        id: "harrow-tracker",
        title: "Очки Харроу",
        template: `modules/${MOD}/templates/harrow-tracker.html`,
        classes: ["harrow-tracker", "sheet"],
        width: 420,
        height: "auto",
        resizable: true
      });
    }

    get isGM() { return game.user?.isGM; }

    async _prepareContext(options) {
      return this.getData(options);
    }

    async _onRender(context, options) {
      await super._onRender?.(context, options);
      this.activateListeners(CT.asHtml(CT.part(this, ".harrow-tracker")));
    }

    getData() {
      const currentUser = game.user;
      let actors = [];
      try {
        if (this.isGM) {
          actors = game.actors?.filter(a => a?.type === "character" && a?.hasPlayerOwner) ?? [];
        } else {
          const pc = currentUser?.character;
          actors = pc ? [pc] : [];
        }
      } catch (_e) { actors = []; }

      const rows = actors.map(a => ({
        id: a.id,
        name: a.name,
        owner: a.isOwner,
        points: Number(a.getFlag(MOD, FLAG_KEY)) || 0
      })).sort((a,b) => a.name.localeCompare(b.name, game.i18n.lang));

      return { rows, isGM: this.isGM };
    }

    activateListeners(html) {
      super.activateListeners?.(html);

      const setBusy = (busy)=> html.find("button, input").prop("disabled", !!busy);

      html.on("click", ".hp-inc, .hp-dec, .hp-reset", async (ev) => {
        ev.preventDefault();
        const btn = ev.currentTarget;
        const tr = btn.closest("tr");
        const actorId = tr?.dataset?.actorId;
        const actor = game.actors?.get(actorId);
        if (!actor) return;
        if (!actor.isOwner && !game.user.isGM) return ui.notifications?.warn?.("Нет прав изменять этого персонажа");
        const curr = Number(actor.getFlag(MOD, FLAG_KEY)) || 0;
        let next = curr;
        if (btn.classList.contains("hp-inc")) next = curr + 1;
        else if (btn.classList.contains("hp-dec")) next = Math.max(0, curr - 1);
        else if (btn.classList.contains("hp-reset")) next = 0;
        try {
          setBusy(true);
          await actor.setFlag(MOD, FLAG_KEY, next);
        } finally { setBusy(false); }
        this.render();
      });

      html.on("change", ".hp-input", async (ev) => {
        const inp = ev.currentTarget;
        const tr = inp.closest("tr");
        const actorId = tr?.dataset?.actorId;
        const actor = game.actors?.get(actorId);
        if (!actor) return;
        if (!actor.isOwner && !game.user.isGM) return ui.notifications?.warn?.("Нет прав изменять этого персонажа");
        let val = Number.parseInt(inp.value, 10);
        if (!Number.isFinite(val) || val < 0) val = 0;
        await actor.setFlag(MOD, FLAG_KEY, val);
        this.render();
      });
    }
  }

  let _harrowApp;
  function toggleHarrowTracker() {
    if (!_harrowApp) _harrowApp = new HarrowTracker();
    _harrowApp.render(true, { focus: true });
  }

  function injectActorSheetButton(app, html) {
    try {
      if (!app?.actor && !app?.document) return;
      const actor = app.actor ?? app.document;
      if (actor?.type !== "character") return;

      const root = CT.asElement(html) ?? CT.asElement(app.element) ?? app.element;
      const frame = root?.closest?.(".application, .window-app, .app") ?? root;
      if (!frame?.querySelector || frame.querySelector(".harrow-open")) return;

      const header = frame.querySelector(".window-header");
      if (!header) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "header-control harrow-open";
      button.title = "Очки Харроу";
      button.innerHTML = '<i class="fas fa-swatchbook"></i>';
      button.addEventListener("click", (event) => {
        event.preventDefault();
        toggleHarrowTracker();
      });
      header.append(button);
    } catch (_e) { /* no-op */ }
  }

  // Button in Actor sheet header
  Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
    try {
      buttons.unshift({
        label: "Очки Харроу",
        class: "harrow-open",
        icon: "fas fa-swatchbook",
        onclick: () => toggleHarrowTracker()
      });
    } catch (_e) { /* no-op */ }
  });

  Hooks.on("renderActorSheet", injectActorSheetButton);
  Hooks.on("renderActorSheetPF2e", injectActorSheetButton);
  Hooks.on("renderCharacterSheetPF2e", injectActorSheetButton);

  // (По запросу) — удалил кнопку в HUD токена

  Hooks.once("ready", () => {
    try {
      const mod = game.modules.get(MOD);
      if (mod) {
        mod.api = mod.api || {};
        mod.api.openHarrow = toggleHarrowTracker;
      }
      // Ensure scene controls rebuild after our hook is registered
      ui.controls?.initialize(true);
    } catch (_e) { /* no-op */ }
  });

  Hooks.on("updateActor", (_actor, diff) => {
    if (!_harrowApp?.rendered) return;
    if (diff?.flags?.[MOD]?.[FLAG_KEY] !== undefined) _harrowApp.render();
  });
})();
