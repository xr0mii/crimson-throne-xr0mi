// Blood Pig minigame helper for Foundry VTT v13+
(function(){
  const MOD = "crimson-throne-xr0mi";
  const SETTING = "bloodPigState";
  const VICTORY_SOUND = `modules/${MOD}/assets/sounds/final-fantasy-vii-victory-fanfare-hq-cut_ym0q870.mp3`;
  const CT = globalThis.CrimsonThroneCompat;
  const BaseApplication = CT?.getTemplateApplicationBase?.();

  if (!BaseApplication) {
    console.warn(`[${MOD}] Blood Pig helper disabled: no compatible Application API found.`);
    return;
  }

  const DEFAULT_STATE = {
    targetScore: 3,
    pcScore: 0,
    emperorScore: 0,
    pigSide: "c4a",
    pigStatus: "В клетке C4a",
    carrier: "",
    carrierTokenId: "",
    pigTokenId: "",
    pigTokenSceneId: "",
    locations: {
      c4a: null,
      c4e: null
    },
    restrained: false,
    victoryPlayed: false
  };

  const SQUIRM = {
    1: {
      title: "Обмяк",
      text: "Поросёнок ничего не делает и просто безвольно висит в руках персонажа."
    },
    2: {
      title: "Извивается",
      text: "Несущий должен успешно пройти проверку Атлетики со СЛ 15, иначе роняет поросёнка."
    },
    3: {
      title: "Визжит",
      text: "Шум вызывает у императора и толпы громкий дружный хохот."
    },
    4: {
      title: "Кусается",
      text: "Поросёнок совершает Удар укусом ближнего боя с бонусом +8 против того, кто его несёт, нанося 1d4+1 колющего урона при успехе."
    },
    5: {
      title: "Лягается",
      text: "Несущий должен успешно пройти проверку Акробатики со СЛ 15, иначе роняет поросёнка."
    },
    6: {
      title: "Паникует",
      text: "Примените результаты визга, укуса, извивания и пинка одновременно."
    }
  };

  function targetScore(value) {
    return Math.min(5, Math.max(1, Number(value) || 3));
  }

  function clampScore(value, target = 5) {
    return Math.min(targetScore(target), Math.max(0, Number(value) || 0));
  }

  function victoryTeam(state) {
    if (state.pcScore >= state.targetScore) return "pc";
    if (state.emperorScore >= state.targetScore) return "emperor";
    return "";
  }

  function victoryLabel(team) {
    return team === "pc" ? "героев" : "Шинглснайпов";
  }

  const CARD_CONTENT = {
    retrieve: `<div class="ct-blood-pig-card">
      <h3>Достать поросёнка <span class="action-glyph">2</span></h3>
      <p><strong>Признаки:</strong> атака, воздействие, Атлетика, навык</p>
      <p><strong>Требования:</strong> вы рядом с закрытой клеткой, в которой есть поросёнок, и у вас свободна хотя бы одна рука.</p>
      <p>Вы открываете клетку и немедленно пытаетесь схватить поросёнка. Совершите @Check[type:athletics|dc:15]{проверку Атлетики со СЛ 15}. Эта активность неделима и не может быть Заготовлена. До её завершения другие существа не могут взаимодействовать с поросёнком.</p>
      <p><strong>Критический успех:</strong> вы достаёте и сдерживаете поросёнка; до конца вашего следующего хода он считается обмякшим.</p>
      <p><strong>Успех:</strong> вы достаёте и удерживаете поросёнка до начала своего следующего хода.</p>
      <p><strong>Провал:</strong> клетка открыта, но поросёнок остаётся внутри. Теперь его можно схватить отдельным действием.</p>
      <p><strong>Критический провал:</strong> поросёнок вырывается из клетки, падает рядом с ней ничком и начинает убегать.</p>
    </div>`,
    grab: `<div class="ct-blood-pig-card">
      <h3>Схватить поросёнка <span class="action-glyph">1</span></h3>
      <p><strong>Признаки:</strong> атака, Атлетика, навык</p>
      <p><strong>Требования:</strong> у вас есть хотя бы одна свободная рука.</p>
      <p>Схватите поросёнка на поле, в открытой клетке или удержите уже пойманного. Совершите @Check[type:athletics|dc:15]{проверку Атлетики со СЛ 15}.</p>
      <p><strong>Критический успех:</strong> вы сдерживаете поросёнка; до конца вашего следующего хода он считается обмякшим.</p>
      <p><strong>Успех:</strong> вы удерживаете поросёнка до начала своего следующего хода.</p>
      <p><strong>Провал:</strong> вы не хватаете поросёнка. Если вы пытались продлить удержание, он вырывается.</p>
    </div>`,
    throw: `<div class="ct-blood-pig-card">
      <h3>Бросить поросёнка <span class="action-glyph">1</span></h3>
      <p><strong>Признаки:</strong> атака, Атлетика, навык</p>
      <p><strong>Требования:</strong> вы удерживаете или сдерживаете поросёнка.</p>
      <p>СЛ равна 15 на расстоянии до 10 футов и увеличивается на 1 за каждые следующие 5 футов. Отпустить поросёнка в соседнюю яму можно без проверки.</p>
      <p>@Check[type:athletics|dc:15]{До 10 футов — СЛ 15} · @Check[type:athletics|dc:16]{15 футов — СЛ 16} · @Check[type:athletics|dc:17]{20 футов — СЛ 17}</p>
      <p><strong>Успех:</strong> вы бросаете поросёнка в выбранную цель. Цель может попытаться поймать его реакцией.</p>
      <p><strong>Провал:</strong> поросёнок падает на землю и получает состояние ничком.</p>
      <p><strong>Критический провал:</strong> поросёнок падает и на инициативе 0 бежит от ближайшего человека со скоростью 30 футов.</p>
    </div>`,
    catch: `<div class="ct-blood-pig-card">
      <h3>Поймать поросёнка <span class="action-glyph">5</span></h3>
      <p><strong>Признаки:</strong> Атлетика, навык</p>
      <p><strong>Триггер:</strong> вы стали целью брошенного поросёнка или он пролетает через занимаемую вами клетку.</p>
      <p><strong>Требования:</strong> у вас свободна рука; вы можете Отпустить удерживаемый предмет как часть реакции.</p>
      <p>@Check[type:athletics|dc:11]{СЛ 11}, чтобы поймать направленный вам бросок. Для перехвата используйте @Check[type:athletics|dc:24]{СЛ 24}.</p>
      <p><strong>Успех:</strong> вы ловите и удерживаете поросёнка до начала своего следующего хода.</p>
      <p><strong>Провал:</strong> поросёнок падает на землю и получает состояние ничком.</p>
      <p><strong>Критический провал:</strong> поросёнок падает и начинает убегать.</p>
    </div>`,
    steal: `<div class="ct-blood-pig-card">
      <h3>Украсть поросёнка <span class="action-glyph">1</span></h3>
      <p><strong>Признаки:</strong> атака, Атлетика, навык</p>
      <p><strong>Требования:</strong> у вас есть свободная рука, а соседнее существо удерживает поросёнка.</p>
      <p>Попытайтесь @Check[athletics|against:reflex]{Обезоружить} носителя. В отличие от обычного Обезоруживания, поросёнок переходит к вам уже при успехе.</p>
      <p><strong>Критический успех:</strong> вы выхватываете и сдерживаете поросёнка; до конца вашего следующего хода он считается обмякшим.</p>
      <p><strong>Успех:</strong> вы выхватываете и удерживаете поросёнка, затем немедленно определяете его брыкание.</p>
      <p><strong>Провал:</strong> носитель сохраняет поросёнка.</p>
      <p><strong>Критический провал:</strong> вы застигнуты врасплох до начала своего следующего хода.</p>
    </div>`,
    squirm: `<div class="ct-blood-pig-card">
      <h3>Брыкающийся поросёнок</h3><table>
        <tr><th>d6</th><th>Результат</th></tr>
        <tr><td>1</td><td><strong>Обмяк:</strong> ничего не делает.</td></tr>
        <tr><td>2</td><td><strong>Извивается:</strong> @Check[type:athletics|dc:15]{Атлетика СЛ 15} или уронить.</td></tr>
        <tr><td>3</td><td><strong>Визжит:</strong> толпа смеётся.</td></tr>
        <tr><td>4</td><td><strong>Кусается:</strong> +8 Удар укусом, 1d4+1 колющего урона.</td></tr>
        <tr><td>5</td><td><strong>Лягается:</strong> @Check[type:acrobatics|dc:15]{Акробатика СЛ 15} или уронить.</td></tr>
        <tr><td>6</td><td><strong>Паникует:</strong> визг, укус, извивание и пинок одновременно.</td></tr>
      </table>
    </div>`,
    rules: `<div class="ct-blood-pig-card">
      <h3>Кровавый кабан: краткие правила</h3>
      <p><strong>Цель:</strong> первой набрать заданное Мастером число очков.</p>
      <p><strong>Очко:</strong> поместить поросёнка в яму своей команды. Яма героев: C4f. Яма Шинглснайпов: C4b.</p>
      <p><strong>Нельзя:</strong> оружие и заклинания. За нарушение противники получают 1 очко.</p>
      <p><strong>Клетка:</strong> достать поросёнка можно только неделимой активностью за 2 действия; её нельзя Заготовить.</p>
      <p><strong>Уронить:</strong> при получении урона пройдите Атлетику: СЛ 10 + полученный урон.</p>
      <p><strong>Передача:</strong> Взаимодействие соседнему союзнику; получатель тратит реакцию.</p>
    </div>`
  };

  function cloneState(state) {
    const cloned = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_STATE), state ?? {}, { inplace: false });
    cloned.targetScore = targetScore(cloned.targetScore);
    cloned.pcScore = clampScore(cloned.pcScore, cloned.targetScore);
    cloned.emperorScore = clampScore(cloned.emperorScore, cloned.targetScore);
    return cloned;
  }

  async function getState() {
    return cloneState(game.settings.get(MOD, SETTING));
  }

  async function setState(patch) {
    const current = await getState();
    const next = foundry.utils.mergeObject(current, patch, { inplace: false });
    next.targetScore = targetScore(next.targetScore);
    next.pcScore = clampScore(next.pcScore, next.targetScore);
    next.emperorScore = clampScore(next.emperorScore, next.targetScore);
    await game.settings.set(MOD, SETTING, next);
    return next;
  }

  async function post(content, speaker = {}) {
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker(speaker),
      content
    });
  }

  async function playVictorySound() {
    try {
      const AudioHelperClass = globalThis.AudioHelper ?? foundry?.audio?.AudioHelper;
      if (AudioHelperClass?.play) {
        await AudioHelperClass.play({ src: VICTORY_SOUND, volume: 0.8, autoplay: true, loop: false }, true);
      } else {
        const audio = new Audio(VICTORY_SOUND);
        audio.volume = 0.8;
        await audio.play();
      }
    } catch (error) {
      console.warn(`${MOD} | Не удалось проиграть победный звук`, error);
    }
  }

  async function handleVictory(state) {
    const team = victoryTeam(state);
    if (!team || state.victoryPlayed) return state;

    state.victoryPlayed = true;
    await game.settings.set(MOD, SETTING, state);
    await playVictorySound();
    await post(`<h3>Кровавый кабан</h3><p><strong>Победа ${victoryLabel(team)}!</strong></p>`, currentSpeaker(state));
    return state;
  }

  function selectedToken() {
    return canvas?.tokens?.controlled?.[0] ?? null;
  }

  function tokenData(token) {
    if (!token) return null;
    return {
      id: token.document?.id ?? token.id,
      name: token.name,
      img: token.document?.texture?.src || token.actor?.img || token.document?.img || "",
      scene: canvas?.scene?.name ?? ""
    };
  }

  function carrierToken(state) {
    if (!state?.carrierTokenId) return null;
    return canvas?.tokens?.placeables?.find(t => (t.document?.id ?? t.id) === state.carrierTokenId) ?? null;
  }

  function pigToken(state) {
    if (!state?.pigTokenId) return null;
    if (state.pigTokenSceneId && canvas?.scene?.id && state.pigTokenSceneId !== canvas.scene.id) return null;
    return canvas?.tokens?.placeables?.find(t => (t.document?.id ?? t.id) === state.pigTokenId) ?? null;
  }

  function currentSpeaker(state) {
    const token = selectedToken() ?? carrierToken(state);
    return token ? { token: token.document ?? token } : {};
  }

  function tokenPosition(token) {
    if (!token?.document || !canvas?.scene) return null;
    return {
      sceneId: canvas.scene.id,
      x: token.document.x,
      y: token.document.y
    };
  }

  function centeredOnTokenPosition(pig, target) {
    const gridSize = canvas?.grid?.size ?? 0;
    const pigWidth = Number(pig?.document?.width) || 1;
    const pigHeight = Number(pig?.document?.height) || 1;
    const targetWidth = Number(target?.document?.width) || 1;
    const targetHeight = Number(target?.document?.height) || 1;
    return {
      x: target.document.x + ((targetWidth - pigWidth) * gridSize / 2),
      y: target.document.y + ((targetHeight - pigHeight) * gridSize / 2)
    };
  }

  async function movePigToToken(state, target) {
    const pig = pigToken(state);
    if (!pig) {
      ui.notifications?.warn?.("Сначала назначь токен поросёнка.");
      return false;
    }
    if (!target) {
      ui.notifications?.warn?.("Нет целевого токена.");
      return false;
    }
    await pig.document.update(centeredOnTokenPosition(pig, target));
    return true;
  }

  async function movePigToLocation(state, key) {
    const pig = pigToken(state);
    if (!pig) {
      ui.notifications?.warn?.("Сначала назначь токен поросёнка.");
      return false;
    }
    const location = state.locations?.[key];
    if (!location) {
      ui.notifications?.warn?.(`Сначала запомни позицию ${key.toUpperCase()}.`);
      return false;
    }
    if (location.sceneId !== canvas?.scene?.id) {
      ui.notifications?.warn?.(`Позиция ${key.toUpperCase()} сохранена для другой сцены.`);
      return false;
    }
    await pig.document.update({ x: location.x, y: location.y });
    return true;
  }

  async function setPigCondition(state, slug, active, { warn = false } = {}) {
    const pig = pigToken(state);
    const actor = pig?.actor;
    if (!actor) {
      if (warn) ui.notifications?.warn?.("Сначала назначь токен поросёнка.");
      return false;
    }
    if (typeof actor.hasCondition !== "function" || typeof actor.increaseCondition !== "function" || typeof actor.decreaseCondition !== "function") {
      if (warn) ui.notifications?.warn?.("PF2e-состояния недоступны для этого токена.");
      return false;
    }

    const hasCondition = !!actor.hasCondition(slug);
    if (active && !hasCondition) await actor.increaseCondition(slug);
    if (!active && hasCondition) await actor.decreaseCondition(slug, { forceRemove: true });
    return true;
  }

  async function syncPigConditions(state, { prone = null, restrained = null, warn = false } = {}) {
    if (restrained === true) await setPigCondition(state, "prone", false, { warn });
    if (prone !== null) await setPigCondition(state, "prone", !!prone, { warn });
    if (restrained !== null) await setPigCondition(state, "restrained", !!restrained, { warn });
  }

  function showBloodPigToPlayers() {
    if (!game.user?.isGM) return;
    game.socket?.emit?.(`module.${MOD}`, { type: "blood-pig-open", userId: game.user.id });
    ui.notifications?.info?.("Окно «Кровавого кабана» открыто у активных игроков.");
  }

  class BloodPigApp extends BaseApplication {
    static get DEFAULT_OPTIONS() {
      const options = CT.v2Options({
        id: "ct-blood-pig",
        title: "Кровавый кабан",
        classes: ["blood-pig-app", "sheet"],
        width: 560
      });
      options.window.controls = [{ action: "showPlayers", icon: "fa-solid fa-users-viewfinder", label: "Показать игрокам", visible: !!game.user?.isGM }];
      options.actions = { showPlayers() { showBloodPigToPlayers(); } };
      return options;
    }

    static get PARTS() {
      return CT.singleTemplatePart(`modules/${MOD}/templates/blood-pig.html`);
    }

    static get defaultOptions() {
      return CT.v1Options(super.defaultOptions, {
        id: "ct-blood-pig",
        title: "Кровавый кабан",
        template: `modules/${MOD}/templates/blood-pig.html`,
        classes: ["blood-pig-app", "sheet"],
        width: 560,
        height: "auto",
        resizable: true
      });
    }

    _getHeaderButtons() {
      const buttons = super._getHeaderButtons?.() ?? [];
      if (game.user?.isGM) buttons.unshift({ label: "Показать игрокам", class: "bp-show-players", icon: "fas fa-users", onclick: showBloodPigToPlayers });
      return buttons;
    }

    async _prepareContext(options) {
      return this.getData(options);
    }

    async _onRender(context, options) {
      await super._onRender?.(context, options);
      this.activateListeners(CT.asHtml(CT.part(this, ".blood-pig")));
    }

    async getData() {
      const state = await getState();
      const currentPigToken = pigToken(state);
      const controlled = selectedToken();
      const controlledId = controlled?.document?.id ?? controlled?.id ?? "";
      return {
        state,
        isGM: !!game.user?.isGM,
        targetIsThree: state.targetScore === 3,
        targetIsFive: state.targetScore === 5,
        selectedToken: tokenData(controlled),
        pigToken: tokenData(currentPigToken),
        canSquirm: !!game.user?.isGM || (!!controlledId && controlledId === state.carrierTokenId && !!controlled?.actor?.testUserPermission?.(game.user, "OWNER")),
        hasC4a: !!state.locations?.c4a,
        hasC4e: !!state.locations?.c4e,
        pcWon: state.pcScore >= state.targetScore,
        emperorWon: state.emperorScore >= state.targetScore,
        winner: state.pcScore >= state.targetScore ? "победа героев" : state.emperorScore >= state.targetScore ? "победа Шинглснайпов" : ""
      };
    }

    activateListeners(html) {
      super.activateListeners?.(html);
      const root = html?.jquery ? html[0] : html?.[0] ?? html;
      if (root?.dataset?.ctBloodPigBound === "true") return;
      if (root?.dataset) root.dataset.ctBloodPigBound = "true";

      html.on("change", ".bp-state-field", async (ev) => {
        const field = ev.currentTarget.dataset.field;
        if (!field) return;
        const value = ev.currentTarget.value ?? "";
        const patch = { [field]: value };
        if (field === "carrier") {
          patch.carrierTokenId = "";
          patch.pigStatus = value.trim() ? `У ${value.trim()}` : "На поле";
          if (!value.trim()) patch.restrained = false;
        }
        const state = await setState(patch);
        if (field === "carrier") {
          if (value.trim()) await syncPigConditions(state, { prone: false });
          else await syncPigConditions(state, { prone: false, restrained: false });
        }
        this.render();
      });

      html.on("change", ".bp-state-check", async (ev) => {
        const field = ev.currentTarget.dataset.field;
        if (!field) return;
        const checked = !!ev.currentTarget.checked;
        const state = await setState({ [field]: checked });
        if (field === "restrained") await syncPigConditions(state, { restrained: checked, warn: true });
        this.render();
      });

      html.on("click", "[data-pig-side]", async (ev) => {
        const pigSide = ev.currentTarget.dataset.pigSide;
        const state = await setState({ pigSide, pigStatus: `В клетке ${pigSide.toUpperCase()}`, carrier: "", carrierTokenId: "", restrained: false });
        await syncPigConditions(state, { prone: false, restrained: false });
        await movePigToLocation(state, pigSide);
        this.render();
      });

      html.on("click", ".bp-score", async (ev) => {
        const team = ev.currentTarget.dataset.team;
        const delta = Number(ev.currentTarget.dataset.delta) || 0;
        const state = await getState();
        if (team === "pc") state.pcScore = clampScore(state.pcScore + delta, state.targetScore);
        if (team === "emperor") state.emperorScore = clampScore(state.emperorScore + delta, state.targetScore);
        if (!victoryTeam(state)) state.victoryPlayed = false;
        await game.settings.set(MOD, SETTING, state);
        await handleVictory(state);
        this.render();
      });

      html.on("change", ".bp-target-score", async (ev) => {
        if (!game.user?.isGM) return;
        const state = await getState();
        state.targetScore = targetScore(ev.currentTarget.value);
        state.pcScore = clampScore(state.pcScore, state.targetScore);
        state.emperorScore = clampScore(state.emperorScore, state.targetScore);
        state.victoryPlayed = false;
        await game.settings.set(MOD, SETTING, state);
        this.render();
      });

      html.on("click", ".bp-sudden-death", async () => {
        if (!game.user?.isGM) return;
        const state = await getState();
        const tiedScore = Math.max(0, state.targetScore - 1);
        state.pcScore = tiedScore;
        state.emperorScore = tiedScore;
        state.victoryPlayed = false;
        await game.settings.set(MOD, SETTING, state);
        await post(`<h3>Кровавый кабан: решающий поросёнок</h3><p>Счёт равный. Следующий поросёнок решит исход партии!</p>`, currentSpeaker(state));
        this.render();
      });

      html.on("click", ".bp-score-goal", async (ev) => {
        const team = ev.currentTarget.dataset.team;
        const state = await getState();
        if (team === "pc") {
          state.pcScore = clampScore(state.pcScore + 1, state.targetScore);
          state.pigSide = "c4a";
          state.pigStatus = "Новый поросёнок в клетке C4a";
          await post(`<h3>Кровавый кабан</h3><p><strong>Очко героям!</strong> Новый поросёнок появляется в клетке C4a.</p>`, currentSpeaker(state));
        } else {
          state.emperorScore = clampScore(state.emperorScore + 1, state.targetScore);
          state.pigSide = "c4e";
          state.pigStatus = "Новый поросёнок в клетке C4e";
          await post(`<h3>Кровавый кабан</h3><p><strong>Очко Шинглснайпам!</strong> Новый поросёнок появляется в клетке C4e.</p>`, currentSpeaker(state));
        }
        state.carrier = "";
        state.carrierTokenId = "";
        state.restrained = false;
        await game.settings.set(MOD, SETTING, state);
        await syncPigConditions(state, { prone: false, restrained: false });
        await movePigToLocation(state, state.pigSide);
        await handleVictory(state);
        this.render();
      });

      html.on("click", ".bp-flip", async () => {
        const roll = await new Roll("1d2").evaluate({ async: true });
        const pigSide = roll.total === 1 ? "c4a" : "c4e";
        const sideText = roll.total === 1 ? "орёл" : "решка";
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker(currentSpeaker(await getState())),
          flavor: `<h3>Кровавый кабан: начало игры</h3><p>Выпадает <strong>${sideText}</strong>. Поросёнок появляется в клетке <strong>${pigSide.toUpperCase()}</strong>.</p>`
        });
        const state = await setState({ pigSide, pigStatus: `В клетке ${pigSide.toUpperCase()}`, carrier: "", carrierTokenId: "", restrained: false });
        await syncPigConditions(state, { prone: false, restrained: false });
        await movePigToLocation(state, pigSide);
        this.render();
      });

      html.on("click", ".bp-squirm", async () => {
        const state = await getState();
        let total = 1;
        let roll = null;
        if (!state.restrained) {
          roll = await new Roll("1d6").evaluate({ async: true });
          total = roll.total;
        }
        const result = SQUIRM[total];
        const prefix = state.restrained ? "<p><em>Поросёнок сдерживаем: результат считается 1.</em></p>" : "";
        const holder = state.carrier ? `<p><strong>Носитель:</strong> ${state.carrier}</p>` : "";
        const content = `<h3>Брыкающийся поросёнок: ${total}. ${result.title}</h3>${holder}${prefix}<p>${result.text}</p>`;
        if (roll) await roll.toMessage({ speaker: ChatMessage.getSpeaker(currentSpeaker(state)), flavor: content });
        else await post(content, currentSpeaker(state));
      });

      html.on("click", ".bp-clear-carrier", async () => {
        const state = await setState({ carrier: "", carrierTokenId: "", restrained: false, pigStatus: "На поле" });
        await syncPigConditions(state, { prone: false, restrained: false });
        this.render();
      });

      html.on("click", ".bp-set-carrier", async () => {
        const token = selectedToken();
        if (!token) return ui.notifications?.warn?.("Сначала выбери токен на сцене.");
        const state = await setState({
          carrier: token.name,
          carrierTokenId: token.document?.id ?? token.id,
          pigStatus: `У ${token.name}`,
          restrained: false
        });
        await syncPigConditions(state, { prone: false, restrained: false });
        await movePigToToken(state, token);
        this.render();
      });

      html.on("click", ".bp-drop-to-field", async () => {
        const before = await getState();
        const token = selectedToken() ?? carrierToken(before);
        const state = await setState({
          carrier: "",
          carrierTokenId: "",
          restrained: false,
          pigStatus: "На поле, ничком"
        });
        if (token) await movePigToToken(state, token);
        await syncPigConditions(state, { prone: true, restrained: false, warn: true });
        await post(`<h3>Кровавый кабан</h3><p>Поросёнок падает на поле и получает состояние ничком.</p>`, currentSpeaker(state));
        this.render();
      });

      html.on("click", ".bp-set-pig-token", async () => {
        const token = selectedToken();
        if (!token) return ui.notifications?.warn?.("Сначала выбери токен поросёнка на сцене.");
        const previous = await getState();
        const wasProne = previous.pigStatus?.includes("ничком") ?? false;
        const state = await setState({
          pigTokenId: token.document?.id ?? token.id,
          pigTokenSceneId: canvas?.scene?.id ?? "",
          pigStatus: `Токен поросёнка: ${token.name}`
        });
        await syncPigConditions(state, { restrained: state.restrained, prone: wasProne });
        this.render();
      });

      html.on("click", ".bp-remember-location", async (ev) => {
        const key = ev.currentTarget.dataset.location;
        const token = pigToken(await getState()) ?? selectedToken();
        const position = tokenPosition(token);
        if (!key || !position) return ui.notifications?.warn?.("Выбери токен или назначь токен поросёнка, чтобы запомнить позицию.");
        const state = await getState();
        state.locations = state.locations ?? {};
        state.locations[key] = position;
        await game.settings.set(MOD, SETTING, state);
        this.render();
      });

      html.on("click", ".bp-post-card", async (ev) => {
        const card = ev.currentTarget.dataset.card;
        const content = CARD_CONTENT[card];
        if (content) await post(content, currentSpeaker(await getState()));
      });

      html.on("click", ".bp-reset-game", async () => {
        const state = await getState();
        await syncPigConditions(state, { prone: false, restrained: false });
        const next = foundry.utils.deepClone(DEFAULT_STATE);
        next.targetScore = state.targetScore;
        next.pigTokenId = state.pigTokenId;
        next.pigTokenSceneId = state.pigTokenSceneId;
        next.locations = foundry.utils.deepClone(state.locations ?? DEFAULT_STATE.locations);
        await game.settings.set(MOD, SETTING, next);
        this.render();
      });
    }
  }

  let app;
  function openBloodPig() {
    if (!app) app = new BloodPigApp();
    app.render(true, { focus: true });
    return app;
  }

  Hooks.once("init", () => {
    game.settings.register(MOD, SETTING, {
      name: "Blood Pig state",
      scope: "world",
      config: false,
      type: Object,
      default: foundry.utils.deepClone(DEFAULT_STATE)
    });
  });

  Hooks.once("ready", () => {
    game.socket?.on?.(`module.${MOD}`, (payload) => {
      if (payload?.type !== "blood-pig-open") return;
      const sender = game.users.get(payload.userId);
      if (!game.user?.isGM && sender?.isGM) openBloodPig();
    });
    const mod = game.modules.get(MOD);
    if (mod) {
      mod.api = mod.api || {};
      mod.api.openBloodPig = openBloodPig;
    }
  });

  Hooks.on("controlToken", () => {
    if (app?.rendered) app.render();
  });

  Hooks.on("updateSetting", (setting) => {
    if (!game.user?.isGM && setting?.key === `${MOD}.${SETTING}` && app?.rendered) app.render();
  });
})();
