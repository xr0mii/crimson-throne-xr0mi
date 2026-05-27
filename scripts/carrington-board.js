// Madame Carrington communication helper for Foundry VTT v13+
(function(){
  const MOD = "crimson-throne-xr0mi";

  const PRESETS = [
    "Вы пришли вопрошать живых или мёртвых?",
    "Ядовитые сети паука оплели спящие разумы осознанных.",
    "Трепет — мерзкое сновидческое зелье Ночного рынка.",
    "Его душу похитила кривая ведьма культа, ищущая ключ.",
    "Он пытался продать мне большой дневник веры Дезны и ключ из драгоценного металла.",
    "Цена была непомерной, и он отправился искать другого покупателя."
  ];

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.innerText = String(value ?? "");
    return div.innerHTML;
  }

  function removeOverlay(element) {
    if (!element) return;
    if (element._ctCarringtonTimer) window.clearInterval(element._ctCarringtonTimer);
    if (element._ctCarringtonTimeout) window.clearTimeout(element._ctCarringtonTimeout);
    element.classList.add("is-removing");
    window.setTimeout(() => element.remove(), 180);
  }

  function typeMessage(element, text, speed) {
    const chars = [...String(text ?? "")];
    let index = 0;
    element.textContent = "";

    return window.setInterval(() => {
      element.textContent += chars[index] ?? "";
      index += 1;
      if (index >= chars.length) {
        window.clearInterval(element.closest(".ct-carrington-overlay")?._ctCarringtonTimer);
      }
    }, Number(speed) || 45);
  }

  function showSceneMessage({ message, duration = 18000, speed = 45 } = {}) {
    const text = String(message ?? "").trim();
    if (!text) return;

    document.querySelectorAll(".ct-carrington-overlay").forEach(removeOverlay);

    const overlay = document.createElement("div");
    overlay.className = "ct-carrington-overlay";
    overlay.innerHTML = `
      <button type="button" class="ct-carrington-overlay__close" title="Закрыть">
        <i class="fas fa-times"></i>
      </button>
      <div class="ct-carrington-overlay__board">
        <div class="ct-carrington-overlay__title">Говорящая доска мадам Каррингтон</div>
        <div class="ct-carrington-overlay__message" aria-live="polite"></div>
      </div>`;

    overlay.querySelector(".ct-carrington-overlay__close")?.addEventListener("click", () => removeOverlay(overlay));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) removeOverlay(overlay);
    });

    document.body.append(overlay);
    const messageElement = overlay.querySelector(".ct-carrington-overlay__message");
    overlay._ctCarringtonTimer = typeMessage(messageElement, text, speed);
    const timeout = Number(duration) || 0;
    if (timeout > 0) overlay._ctCarringtonTimeout = window.setTimeout(() => removeOverlay(overlay), timeout);
  }

  async function sendCarringtonMessage({ message, duration = 18000, speed = 45 } = {}) {
    const text = String(message ?? "").trim();
    if (!text) {
      ui.notifications?.warn?.("Введите сообщение мадам Каррингтон.");
      return null;
    }

    showSceneMessage({ message: text, duration, speed });
    game.socket?.emit?.(`module.${MOD}`, {
      type: "carrington-message",
      message: text,
      duration: Number(duration) || 0,
      speed: Number(speed) || 45
    });
    return null;
  }

  class CarringtonBoardApp extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "ct-carrington-board",
        title: "Доска мадам Каррингтон",
        template: `modules/${MOD}/templates/carrington-board.html`,
        classes: ["ct-carrington-app", "sheet"],
        width: 430,
        height: "auto",
        resizable: true
      });
    }

    getData() {
      return { presets: PRESETS };
    }

    activateListeners(html) {
      super.activateListeners(html);

      html.on("change", ".ct-carrington-preset", (event) => {
        const value = event.currentTarget.value ?? "";
        if (!value) return;
        html.find(".ct-carrington-message").val(value);
      });

      html.on("click", ".ct-carrington-send", async (event) => {
        event.preventDefault();
        const message = html.find(".ct-carrington-message").val();
        const duration = html.find(".ct-carrington-duration").val();
        const speed = html.find(".ct-carrington-speed").val();
        await sendCarringtonMessage({ message, duration, speed });
      });
    }
  }

  let app;
  function openCarringtonBoard() {
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Доска мадам Каррингтон доступна только Мастеру.");
      return null;
    }
    if (!app) app = new CarringtonBoardApp();
    app.render(true, { focus: true });
    return app;
  }

  function injectChatButton(_app, html) {
    if (!game.user?.isGM) return;

    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelector) return;
    if (root.querySelector(".ct-carrington-chat-control")) return;

    const controls = root.querySelector("#chat-controls") ?? root.querySelector(".chat-controls");
    if (!controls) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ct-carrington-chat-control";
    button.title = "Доска мадам Каррингтон";
    button.innerHTML = '<i class="fas fa-moon"></i>';
    button.addEventListener("click", openCarringtonBoard);
    controls.append(button);
  }

  Hooks.once("ready", () => {
    game.socket?.on?.(`module.${MOD}`, (payload) => {
      if (payload?.type !== "carrington-message") return;
      if (game.user?.isGM) return;
      showSceneMessage({ message: payload.message, duration: payload.duration, speed: payload.speed });
    });

    const mod = game.modules.get(MOD);
    if (mod) {
      mod.api = mod.api || {};
      mod.api.openCarringtonBoard = openCarringtonBoard;
      mod.api.sendCarringtonMessage = sendCarringtonMessage;
      mod.api.showCarringtonMessage = showSceneMessage;
    }
  });

  Hooks.on("renderChatLog", injectChatButton);
})();
