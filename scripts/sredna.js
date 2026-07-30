// Sredna minigame for Foundry VTT v13+ and PF2e.
(function () {
  const MOD = "crimson-throne-xr0mi";
  const SETTING = "srednaState";
  const TEMPLATE = `modules/${MOD}/templates/sredna.html`;
  const CT = globalThis.CrimsonThroneCompat;
  const BaseApplication = CT?.getTemplateApplicationBase?.();

  if (!BaseApplication) {
    console.warn(`[${MOD}] Sredna disabled: no compatible Application API found.`);
    return;
  }

  const participant = (side) => ({
    side,
    actorId: "",
    name: side === 0 ? "Первый участник" : "Второй участник",
    img: "icons/svg/mystery-man.svg",
    stats: { intimidation: 0, will: 10, athletics: 0, fortitude: 0, fortitudeDC: 10 },
    pressure: 0,
    raging: false,
    choice: "",
    choiceLocked: false
  });

  const emptyPending = () => ({ kind: "", required: [false, false], results: [null, null] });
  const DEFAULT_STATE = {
    version: 2,
    status: "setup",
    stage: "",
    round: 0,
    baseEnduranceDC: 24,
    participants: [participant(0), participant(1)],
    pending: emptyPending(),
    log: [],
    result: null
  };
  let authorityQueue = Promise.resolve();
  const inFlightRolls = new Set();

  function queueAuthority(task) {
    const result = authorityQueue.then(task);
    authorityQueue = result.catch((error) => console.error(`[${MOD}] Sredna action failed`, error));
    return authorityQueue;
  }

  const DEGREE = {
    criticalSuccess: "критический успех",
    success: "успех",
    failure: "провал",
    criticalFailure: "критический провал"
  };

  const ROLL_LABEL = {
    intimidation: "Запугивание",
    athletics: "Атлетика",
    fortitude: "Стойкость"
  };

  const clone = (value) => foundry.utils.deepClone(value);

  function number(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.innerText = String(value ?? "");
    return div.innerHTML;
  }

  function actorStats(actor) {
    const intimidation = number(actor?.skills?.intimidation?.mod, actor?.system?.skills?.intimidation?.mod, actor?.system?.skills?.intimidation?.base);
    const athletics = number(actor?.skills?.athletics?.mod, actor?.system?.skills?.athletics?.mod, actor?.system?.skills?.athletics?.base);
    const fortitude = number(actor?.saves?.fortitude?.mod, actor?.system?.saves?.fortitude?.mod, actor?.system?.saves?.fortitude?.value);
    const will = number(actor?.saves?.will?.mod, actor?.system?.saves?.will?.mod, actor?.system?.saves?.will?.value);
    return { intimidation, will: will + 10, athletics, fortitude, fortitudeDC: fortitude + 10 };
  }

  function hasRageAbility(actor) {
    return !!actor?.items?.some((item) => {
      const name = String(item.name ?? "").trim();
      const slug = String(item.system?.slug ?? item.slug ?? "").trim();
      return /^(ярость|rage)$/i.test(name) || /^(rage|barbarian-rage)$/i.test(slug);
    });
  }

  function actorParticipant(actor, side) {
    return { ...participant(side), actorId: actor.id, name: actor.name, img: actor.img, stats: actorStats(actor) };
  }

  function normalizeState(raw) {
    const isLegacy = !!raw && raw.version !== 2;
    const state = foundry.utils.mergeObject(clone(DEFAULT_STATE), raw ?? {}, { inplace: false, overwrite: true });
    state.version = 2;
    delete state.challengeMode;
    delete state.forcedKrojunRage;
    if (state.result) {
      delete state.result.respect;
      delete state.result.xp;
    }
    state.participants = [0, 1].map((side) => foundry.utils.mergeObject(participant(side), state.participants?.[side] ?? {}, { inplace: false, overwrite: true }));
    state.pending = foundry.utils.mergeObject(emptyPending(), state.pending ?? {}, { inplace: false, overwrite: true });
    state.pending.required = [!!state.pending.required?.[0], !!state.pending.required?.[1]];
    state.pending.results = [state.pending.results?.[0] ?? null, state.pending.results?.[1] ?? null];
    state.log = Array.isArray(state.log) ? state.log.slice(0, 40) : [];
    if (isLegacy) {
      state.status = "setup";
      state.stage = "";
      state.round = 0;
      state.pending = emptyPending();
      state.result = null;
      state.log = [];
      state.participants.forEach((entry) => Object.assign(entry, { pressure: 0, raging: false, choice: "", choiceLocked: false }));
    }
    return state;
  }

  const getState = () => normalizeState(game.settings.get(MOD, SETTING));
  const saveState = async (state) => game.settings.set(MOD, SETTING, normalizeState(state));

  function addLog(state, title, text, tone = "neutral") {
    state.log.unshift({ id: foundry.utils.randomID(), round: state.round, title, text, tone });
    state.log = state.log.slice(0, 40);
  }

  function degreeFromRoll(die, modifier, dc) {
    const total = number(die) + number(modifier);
    let rank = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
    if (die === 20) rank = Math.min(3, rank + 1);
    if (die === 1) rank = Math.max(0, rank - 1);
    return { die, modifier, total, dc, degree: ["criticalFailure", "failure", "success", "criticalSuccess"][rank] };
  }

  function pressureFromCheck(state, side, check) {
    const self = state.participants[side];
    const foe = state.participants[1 - side];
    if (check.degree === "criticalSuccess") self.pressure += 2;
    if (check.degree === "success") self.pressure += 1;
    if (check.degree === "failure") foe.pressure += 1;
    if (check.degree === "criticalFailure") foe.pressure += 2;
  }

  function canControlParticipant(user, state, side) {
    if (user?.isGM) return true;
    const actor = game.actors.get(state.participants[side]?.actorId);
    return !!actor?.testUserPermission?.(user, "OWNER");
  }

  async function postPublic(state, title, paragraphs, { pressure = true } = {}) {
    const pressureText = state.participants.map((entry) => `<strong>${escapeHtml(entry.name)}</strong>: ${entry.pressure}`).join(" · ");
    const footer = pressure ? `<p class="ct-sredna-chat__pressure">Очки давления — ${pressureText}</p>` : "";
    await ChatMessage.create({
      content: `<div class="ct-sredna-chat"><h3>${escapeHtml(title)}</h3>${paragraphs.map((text) => `<p>${text}</p>`).join("")}${footer}</div>`,
      speaker: ChatMessage.getSpeaker()
    });
  }

  function setPending(state, kind, required = [true, true]) {
    state.stage = kind;
    state.pending = { kind, required: [!!required[0], !!required[1]], results: [null, null] };
  }

  function outcome(state, winnerSide, reason) {
    state.status = "finished";
    state.stage = "";
    state.pending = emptyPending();
    state.result = { winnerSide, winnerName: winnerSide === null ? "Ничья" : state.participants[winnerSide].name, reason };
    addLog(state, winnerSide === null ? "Ничья" : `Победа: ${state.participants[winnerSide].name}`, reason, winnerSide === null ? "draw" : "win");
  }

  function checksReady(state) {
    return [0, 1].every((side) => !state.pending.required[side] || !!state.pending.results[side]);
  }

  function narrativeCheck(entry, label, check) {
    return `<strong>${escapeHtml(entry.name)}</strong>: ${label} — ${DEGREE[check.degree]}.`;
  }

  async function resolveIntimidation(state) {
    const checks = [
      degreeFromRoll(state.pending.results[0].die, state.participants[0].stats.intimidation, state.participants[1].stats.will),
      degreeFromRoll(state.pending.results[1].die, state.participants[1].stats.intimidation, state.participants[0].stats.will)
    ];
    checks.forEach((check, side) => pressureFromCheck(state, side, check));
    const paragraphs = checks.map((check, side) => narrativeCheck(state.participants[side], "давление взглядом", check));
    const resolvedRound = state.round;
    addLog(state, `${resolvedRound}-й вдох`, paragraphs.map((text) => text.replace(/<[^>]+>/g, "")).join(" "));
    if (resolvedRound >= 3) {
      state.status = "pulling";
      state.round = 4;
      state.stage = "choices";
      state.pending = emptyPending();
      addLog(state, "Три вдоха миновали", "Теперь можно рвануть петлю или упереться.", "turn");
    } else {
      state.round += 1;
      setPending(state, "intimidation");
    }
    await saveState(state);
    await postPublic(state, `Средна: ${resolvedRound}-й вдох`, paragraphs);
  }

  async function resolveAthletics(state) {
    const paragraphs = [];
    for (const side of [0, 1]) {
      if (!state.pending.required[side]) continue;
      const foe = state.participants[1 - side];
      const dc = foe.stats.fortitudeDC + (foe.choice === "dig" ? 2 : 0);
      const check = degreeFromRoll(state.pending.results[side].die, state.participants[side].stats.athletics, dc);
      pressureFromCheck(state, side, check);
      paragraphs.push(narrativeCheck(state.participants[side], "рывок", check));
    }
    addLog(state, `Рывки, раунд ${state.round}`, paragraphs.map((text) => text.replace(/<[^>]+>/g, "")).join(" "));
    setPending(state, "fortitude");
    await saveState(state);
    await postPublic(state, `Средна: рывок`, paragraphs);
  }

  async function resolveFortitude(state) {
    const checks = [0, 1].map((side) => {
      const bonus = state.participants[side].choice === "dig" ? 2 : 0;
      return degreeFromRoll(state.pending.results[side].die, state.participants[side].stats.fortitude + bonus, state.baseEnduranceDC + state.participants[1 - side].pressure);
    });
    const failed = checks.map((check) => ["failure", "criticalFailure"].includes(check.degree));
    const paragraphs = checks.map((check, side) => `<strong>${escapeHtml(state.participants[side].name)}</strong> ${failed[side] ? "не выдерживает натяжения" : "удерживает петлю"}.`);
    const resolvedRound = state.round;
    if (failed[0] && failed[1]) outcome(state, null, "Оба участника не выдержали натяжения петли.");
    else if (failed[0]) outcome(state, 1, `${state.participants[0].name} не выдерживает и склоняет голову.`);
    else if (failed[1]) outcome(state, 0, `${state.participants[1].name} не выдерживает и склоняет голову.`);
    else {
      addLog(state, `Раунд ${resolvedRound}`, paragraphs.map((text) => text.replace(/<[^>]+>/g, "")).join(" "));
      state.round += 1;
      state.stage = "choices";
      state.pending = emptyPending();
      state.participants.forEach((entry) => { entry.choice = ""; entry.choiceLocked = false; });
    }
    await saveState(state);
    if (state.result) paragraphs.push(`<strong>${escapeHtml(state.result.winnerName)}</strong>. ${escapeHtml(state.result.reason)}`);
    await postPublic(state, `Средна: раунд ${resolvedRound}`, paragraphs);
  }

  async function submitRoll(payload, user) {
    const side = number(payload?.side);
    const kind = String(payload?.kind ?? "");
    const die = number(payload?.die);
    const state = getState();
    if (![0, 1].includes(side) || die < 1 || die > 20) return false;
    if (!canControlParticipant(user, state, side) || state.pending.kind !== kind || !state.pending.required[side] || state.pending.results[side]) return false;
    state.pending.results[side] = { die, userId: user.id };
    await saveState(state);
    if (!checksReady(state)) return true;
    if (kind === "intimidation") await resolveIntimidation(getState());
    if (kind === "athletics") await resolveAthletics(getState());
    if (kind === "fortitude") await resolveFortitude(getState());
    return true;
  }

  async function makePersonalRoll(side, kind) {
    const rollKey = `${side}:${kind}`;
    if (inFlightRolls.has(rollKey)) return;
    const state = getState();
    if (!canControlParticipant(game.user, state, side) || state.pending.kind !== kind || !state.pending.required[side] || state.pending.results[side]) return;
    inFlightRolls.add(rollKey);
    try {
      const entry = state.participants[side];
      const actor = game.actors.get(entry.actorId);
      let modifier = number(entry.stats[kind]);
      if (kind === "fortitude" && entry.choice === "dig") modifier += 2;
      const roll = await new Roll("1d20 + @modifier", { modifier }).evaluate({ async: true });
      const die = number(roll.dice?.[0]?.results?.find((result) => result.active !== false)?.result);
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `<h3>Средна: ${ROLL_LABEL[kind]}</h3><p>Личный бросок участника.</p>`
      });
      const payload = { side, kind, die };
      if (game.user?.isGM) await queueAuthority(() => submitRoll(payload, game.user));
      else game.socket?.emit?.(`module.${MOD}`, { type: "sredna-roll", payload, userId: game.user.id });
    } finally {
      inFlightRolls.delete(rollKey);
    }
  }

  async function playerAction(action, payload, user) {
    const side = number(payload?.side);
    const state = getState();
    if (![0, 1].includes(side) || !canControlParticipant(user, state, side)) return false;

    if (action === "choice") {
      if (state.stage !== "choices" || state.participants[side].choiceLocked || !["tug", "dig"].includes(payload.choice)) return false;
      state.participants[side].choice = payload.choice;
      state.participants[side].choiceLocked = true;
      await saveState(state);
      return true;
    }

    if (action === "rage") {
      const actor = game.actors.get(state.participants[side].actorId);
      if (!["breaths", "pulling"].includes(state.status) || state.participants[side].raging || !hasRageAbility(actor)) return false;
      state.participants[side].raging = true;
      state.participants[side].pressure += 1;
      addLog(state, `${state.participants[side].name} впадает в Ярость`, "+1 Очко давления.", "rage");
      await saveState(state);
      await postPublic(state, "Ярость", [`<strong>${escapeHtml(state.participants[side].name)}</strong> получает 1 Очко давления.`]);
      return true;
    }

    if (action === "yield") {
      if (!["breaths", "pulling"].includes(state.status)) return false;
      outcome(state, 1 - side, `${state.participants[side].name} добровольно склоняет голову.`);
      await saveState(state);
      await postPublic(state, "Средна окончена", [`<strong>${escapeHtml(state.result.winnerName)}</strong> побеждает. ${escapeHtml(state.result.reason)}`]);
      return true;
    }
    return false;
  }

  async function requestAction(action, payload) {
    if (game.user?.isGM) return queueAuthority(() => playerAction(action, payload, game.user));
    game.socket?.emit?.(`module.${MOD}`, { type: "sredna-action", action, payload, userId: game.user.id });
    return true;
  }

  async function actorFromDrop(event) {
    const nativeEvent = event?.originalEvent ?? event;
    let data;
    try {
      data = globalThis.TextEditor?.getDragEventData?.(nativeEvent) ?? JSON.parse(nativeEvent?.dataTransfer?.getData("text/plain") || "{}");
    } catch (_error) { return null; }
    let document = data?.uuid ? await fromUuid(data.uuid) : null;
    if (!document && data?.type === "Actor" && data?.id) document = game.actors.get(data.id);
    if (document?.documentName === "Token") document = document.actor;
    return document?.documentName === "Actor" ? document : null;
  }

  function showSrednaToPlayers() {
    if (!game.user?.isGM) return;
    game.socket?.emit?.(`module.${MOD}`, { type: "sredna-open", userId: game.user.id });
    ui.notifications?.info?.("Окно средны открыто у активных игроков.");
  }

  class SrednaApp extends BaseApplication {
    static get DEFAULT_OPTIONS() {
      const options = CT.v2Options({ id: "ct-sredna", title: "Средна — испытание силы и воли", classes: ["ct-sredna-app", "sheet"], width: 780, height: 780 });
      options.window.controls = [{
        action: "showPlayers",
        icon: "fa-solid fa-users-viewfinder",
        label: "Показать игрокам",
        visible: !!game.user?.isGM
      }];
      options.actions = {
        showPlayers() { showSrednaToPlayers(); }
      };
      return options;
    }
    static get PARTS() { return CT.singleTemplatePart(TEMPLATE); }
    static get defaultOptions() {
      return CT.v1Options(super.defaultOptions, { id: "ct-sredna", title: "Средна — испытание силы и воли", template: TEMPLATE, classes: ["ct-sredna-app", "sheet"], width: 780, height: 780, resizable: true });
    }
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons?.() ?? [];
      if (game.user?.isGM) buttons.unshift({ label: "Показать игрокам", class: "sr-show-players", icon: "fas fa-users", onclick: showSrednaToPlayers });
      return buttons;
    }
    async _prepareContext(options) { return this.getData(options); }
    async _onRender(context, options) {
      await super._onRender?.(context, options);
      this.activateListeners(CT.asHtml(CT.part(this, ".ct-sredna")));
    }

    getData() {
      const state = getState();
      const participants = state.participants.map((entry, side) => {
        const actor = game.actors.get(entry.actorId);
        const canControl = canControlParticipant(game.user, state, side);
        const rollRequired = !!state.pending.required[side];
        const rollSubmitted = !!state.pending.results[side];
        return {
          ...entry,
          isLeft: side === 0,
          assigned: !!entry.actorId,
          canControl,
          choiceMade: !!entry.choiceLocked,
          canRage: state.status !== "setup" && state.status !== "finished" && !entry.raging && hasRageAbility(actor) && canControl,
          rollRequired,
          rollSubmitted,
          canRoll: rollRequired && !rollSubmitted && canControl,
          rollKind: state.pending.kind,
          rollLabel: ROLL_LABEL[state.pending.kind] ?? "проверку"
        };
      });
      return {
        state,
        participants,
        isGM: !!game.user?.isGM,
        isSetup: state.status === "setup",
        isBreath: state.status === "breaths",
        isPulling: state.status === "pulling",
        isChoices: state.stage === "choices",
        isAthletics: state.stage === "athletics",
        isFortitude: state.stage === "fortitude",
        isFinished: state.status === "finished",
        bothLocked: participants.every((entry) => entry.choiceMade),
        selectedToken: canvas?.tokens?.controlled?.[0]?.actor ? { id: canvas.tokens.controlled[0].actor.id, name: canvas.tokens.controlled[0].actor.name } : null
      };
    }

    activateListeners(html) {
      super.activateListeners?.(html);
      const root = html?.jquery ? html[0] : html?.[0] ?? html;
      if (root?.dataset?.ctSrednaBound === "true") return;
      if (root?.dataset) root.dataset.ctSrednaBound = "true";

      html.on("dragover", ".sr-dropzone", (event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragover"); });
      html.on("dragleave", ".sr-dropzone", (event) => event.currentTarget.classList.remove("is-dragover"));
      html.on("drop", ".sr-dropzone", async (event) => {
        event.preventDefault();
        event.currentTarget.classList.remove("is-dragover");
        if (!game.user?.isGM) return ui.notifications?.warn?.("Участников средны назначает Мастер.");
        const side = number(event.currentTarget.dataset.side);
        const actor = await actorFromDrop(event);
        if (!actor || !["character", "npc"].includes(actor.type)) return ui.notifications?.warn?.("Перетащи персонажа или NPC из вкладки актёров либо токен со сцены.");
        const state = getState();
        state.participants[side] = actorParticipant(actor, side);
        await saveState(state);
      });

      html.on("change", ".sr-stat", async (event) => {
        if (!game.user?.isGM) return;
        const side = number(event.currentTarget.dataset.side);
        const stat = event.currentTarget.dataset.stat;
        const state = getState();
        state.participants[side].stats[stat] = number(event.currentTarget.value);
        if (stat === "fortitude") state.participants[side].stats.fortitudeDC = number(event.currentTarget.value) + 10;
        await saveState(state);
      });

      html.on("change", ".sr-base-dc", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        state.baseEnduranceDC = Math.max(10, number(event.currentTarget.value));
        await saveState(state);
      });

      html.on("click", ".sr-use-token", async (event) => {
        if (!game.user?.isGM) return;
        const actor = canvas?.tokens?.controlled?.[0]?.actor;
        if (!actor) return ui.notifications?.warn?.("Сначала выбери токен участника на сцене.");
        const state = getState();
        state.participants[number(event.currentTarget.dataset.side)] = actorParticipant(actor, number(event.currentTarget.dataset.side));
        await saveState(state);
      });

      html.on("click", ".sr-clear-actor", async (event) => {
        if (!game.user?.isGM) return;
        const side = number(event.currentTarget.dataset.side);
        const state = getState();
        state.participants[side] = participant(side);
        await saveState(state);
      });

      html.on("click", ".sr-start", async () => {
        if (!game.user?.isGM) return;
        const state = getState();
        if (state.participants.some((entry) => !entry.actorId)) return ui.notifications?.warn?.("Назначь обоих участников средны.");
        state.status = "breaths";
        state.round = 1;
        state.result = null;
        state.log = [];
        state.participants.forEach((entry) => Object.assign(entry, { pressure: 0, raging: false, choice: "", choiceLocked: false }));
        setPending(state, "intimidation");
        addLog(state, "Петля затянута", "Участники встречаются взглядами. Начинаются три вдоха.");
        await saveState(state);
        await postPublic(state, "Средна начинается", [`<strong>${escapeHtml(state.participants[0].name)}</strong> против <strong>${escapeHtml(state.participants[1].name)}</strong>.`, "Три вдоха нельзя тянуть петлю: только взгляд, угрозы и терпение."], { pressure: false });
      });

      html.on("click", ".sr-choice", (event) => requestAction("choice", { side: number(event.currentTarget.dataset.side), choice: event.currentTarget.dataset.choice }));
      html.on("click", ".sr-rage", (event) => requestAction("rage", { side: number(event.currentTarget.dataset.side) }));
      html.on("click", ".sr-yield", (event) => requestAction("yield", { side: number(event.currentTarget.dataset.side) }));
      html.on("click", ".sr-roll", (event) => makePersonalRoll(number(event.currentTarget.dataset.side), event.currentTarget.dataset.kind));

      html.on("click", ".sr-unlock", async (event) => {
        if (!game.user?.isGM) return;
        const side = number(event.currentTarget.dataset.side);
        const state = getState();
        if (state.participants.every((entry) => entry.choiceLocked)) return;
        state.participants[side].choice = "";
        state.participants[side].choiceLocked = false;
        await saveState(state);
      });

      html.on("click", ".sr-reveal", async () => {
        if (!game.user?.isGM) return;
        const state = getState();
        if (state.stage !== "choices" || !state.participants.every((entry) => entry.choiceLocked)) return;
        const choices = state.participants.map((entry) => entry.choice === "tug" ? "Рывок" : "Упереться");
        const paragraphs = [`Выбор вскрыт: <strong>${escapeHtml(state.participants[0].name)}</strong> — ${choices[0]}; <strong>${escapeHtml(state.participants[1].name)}</strong> — ${choices[1]}.`];
        const tug = state.participants.map((entry) => entry.choice === "tug");
        if (!tug[0] && !tug[1]) {
          state.participants.forEach((entry) => entry.pressure += 1);
          paragraphs.push("Оба участника упёрлись: каждый получает 1 Очко давления.");
          setPending(state, "fortitude");
        } else setPending(state, "athletics", tug);
        addLog(state, `Выбор, раунд ${state.round}`, paragraphs.map((text) => text.replace(/<[^>]+>/g, "")).join(" "), "turn");
        await saveState(state);
        await postPublic(state, `Средна: раунд ${state.round}`, paragraphs);
      });

      html.on("click", ".sr-reset", async () => {
        if (!game.user?.isGM) return;
        const previous = getState();
        const next = clone(DEFAULT_STATE);
        next.participants = previous.participants.map((entry, side) => ({ ...participant(side), actorId: entry.actorId, name: entry.name, img: entry.img, stats: clone(entry.stats) }));
        next.baseEnduranceDC = previous.baseEnduranceDC;
        await saveState(next);
      });

      html.on("click", ".sr-post-rules", () => ChatMessage.create({
        content: `<div class="ct-sredna-chat"><h3>Средна: краткие правила</h3><p><strong>Вдохи 1–3:</strong> каждый участник лично бросает Запугивание. Результат сравнивается с Волей соперника, но его СЛ остаётся тайной.</p><p><strong>С 4-го раунда:</strong> оба тайно выбирают Рывок или Упереться. Совершающий Рывок лично бросает Атлетику; затем оба лично бросают Стойкость, чтобы удержать петлю.</p><p><strong>Упереться:</strong> +2 к защите от Рывка и к проверке выдержки этого раунда. Если упёрлись оба, каждый получает 1 Очко давления.</p></div>`,
        speaker: ChatMessage.getSpeaker()
      }));
    }
  }

  let app;
  function openSredna() {
    if (!app) app = new SrednaApp();
    app.render(true, { focus: true });
    return app;
  }

  function isResponsibleGM() {
    const activeGM = game.users.find((user) => user.active && user.isGM);
    return !!game.user?.isGM && (!activeGM || activeGM.id === game.user.id);
  }

  Hooks.once("init", () => game.settings.register(MOD, SETTING, { name: "Sredna state", scope: "world", config: false, type: Object, default: clone(DEFAULT_STATE) }));

  Hooks.once("ready", () => {
    game.socket?.on?.(`module.${MOD}`, (payload) => {
      if (payload?.type === "sredna-open") {
        const sender = game.users.get(payload.userId);
        if (!game.user?.isGM && sender?.isGM) openSredna();
        return;
      }
      if (!isResponsibleGM()) return;
      queueAuthority(async () => {
        const user = game.users.get(payload?.userId);
        if (!user) return;
        if (payload.type === "sredna-action") await playerAction(payload.action, payload.payload, user);
        if (payload.type === "sredna-roll") await submitRoll(payload.payload, user);
      });
    });
    const mod = game.modules.get(MOD);
    if (mod) {
      mod.api = mod.api || {};
      mod.api.openSredna = openSredna;
    }
  });

  Hooks.on("controlToken", () => { if (app?.rendered) app.render(); });
  Hooks.on("updateSetting", (setting) => { if (setting?.key === `${MOD}.${SETTING}` && app?.rendered) app.render(); });
})();
