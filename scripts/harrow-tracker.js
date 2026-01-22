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

  Hooks.on("getSceneControlButtons", (controls) => {
    try {
      // v13 provides an object of groups; add our tool into the tokens group if available
      const addTool = (groupName, toolName, tool) => {
        const grp = controls?.[groupName];
        if (!grp) return false;
        grp.tools = grp.tools || {};
        grp.tools[toolName] = tool;
        return true;
      };

      addTool("tokens", "harrowTracker", {
        name: "harrowTracker",
        order: 100,
        title: "Очки Харроу",
        icon: "fa-solid fa-swatchbook",
        button: true,
        visible: game.user?.isGM ?? true,
        onClick: () => toggleHarrowTracker()
      });

      // Dedicated GM-only group to ensure visibility in the left toolbar
      controls.harrow = controls.harrow || {
        name: "harrow",
        order: 11,
        title: "Очки Харроу",
        icon: "fa-solid fa-swatchbook",
        layer: "tokens",
        visible: game.user?.isGM ?? true,
        tools: {},
        activeTool: "open"
      };
      controls.harrow.tools.open = {
        name: "open",
        order: 1,
        title: "Открыть трекер",
        icon: "fa-solid fa-arrow-up-right-from-square",
        button: true,
        onClick: () => toggleHarrowTracker()
      };
    } catch (e) { console.error("[crimson-throne-xr0mi] getSceneControlButtons error", e); }
  });

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

  // Supported way to add a chat command
  Hooks.on("chatMessage", (_log, message, _data) => {
    try {
      if (String(message).trim().toLowerCase() === "/harrow") { toggleHarrowTracker(); return false; }
    } catch (_e) {}
    return true;
  });

  Hooks.on("updateActor", (_actor, diff) => {
    if (!_harrowApp?.rendered) return;
    if (diff?.flags?.[MOD]?.[FLAG_KEY] !== undefined) _harrowApp.render();
  });
})();
