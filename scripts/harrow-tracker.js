// Harrow Points Tracker for Foundry VTT v13+
// Encapsulated to avoid global name collisions
(function(){
  const MOD = "crimson-throne-xr0mi";
  const FLAG_KEY = "harrowPoints";

  class HarrowTracker extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
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
      super.activateListeners(html);

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
