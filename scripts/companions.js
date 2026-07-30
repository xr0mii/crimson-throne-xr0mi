// Universal companion cards for Foundry VTT v13+.
(function () {
  const MOD = "crimson-throne-xr0mi";
  const SETTING = "companionState";
  const TEMPLATE = `modules/${MOD}/templates/companions.html`;
  const SOCKET = `module.${MOD}`;
  const CT = globalThis.CrimsonThroneCompat;
  const BaseApplication = CT?.getTemplateApplicationBase?.();

  if (!BaseApplication) {
    console.warn(`[${MOD}] Companion system disabled: no compatible Application API found.`);
    return;
  }

  const DEFAULT_STATE = { version: 7, companions: [] };
  const ACTION_OPTIONS = [
    ["free", "Свободное действие"],
    ["1", "1 действие"],
    ["2", "2 действия"],
    ["3", "3 действия"],
    ["reaction", "Реакция"],
    ["passive", "Пассивная способность"]
  ];
  const FREQUENCY_OPTIONS = [
    ["atwill", "Без ограничений"],
    ["round", "Раз в раунд"],
    ["encounter", "За столкновение"],
    ["day", "В день"]
  ];
  const TRUST_OPTIONS = [
    [0, "Попутчик"],
    [1, "Союзник"],
    [2, "Доверенное лицо"]
  ];
  const TARGET_OPTIONS = [
    ["none", "Без автоматических целей"],
    ["one", "Одна выбранная цель"],
    ["many", "Все выбранные цели"]
  ];

  function clone(value) {
    return globalThis.foundry?.utils?.deepClone
      ? foundry.utils.deepClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function randomId() {
    return globalThis.foundry?.utils?.randomID?.(16)
      ?? globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 16)
      ?? Math.random().toString(36).slice(2, 18);
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, number(value, min)));
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function defaultAbility() {
    return {
      id: randomId(),
      name: "Новая способность",
      img: "icons/svg/aura.svg",
      actionType: "1",
      frequency: "round",
      maxUses: 1,
      used: 0,
      description: "",
      damageFormula: "",
      damageType: "piercing",
      automation: {
        targetMode: "none",
        effectUuids: [],
        effects: [],
        increaseConditions: [],
        decreaseConditions: [],
        tempHp: 0
      },
      exposeOnUse: true,
      memberId: "",
      minLivingMembers: 0,
      minTrust: 0,
      hideUntilUnlocked: false,
      showToPlayers: true,
      playerUsable: true,
      enabled: true
    };
  }

  function defaultMember(name = "Участник отряда") {
    return {
      id: randomId(),
      name,
      dead: false
    };
  }

  function defaultCompanion(actor) {
    return {
      id: randomId(),
      actorId: actor?.id ?? "",
      actorUuid: actor?.uuid ?? "",
      name: actor?.name ?? "Новый спутник",
      img: actor?.img ?? "icons/svg/mystery-man.svg",
      description: "",
      gmNotes: "",
      visible: true,
      exposed: false,
      threatPending: false,
      pendingThreatType: "",
      pendingWounds: 1,
      woundedThisRound: false,
      activated: false,
      evacuated: false,
      dead: false,
      casualtyPending: false,
      trust: 0,
      wounds: 0,
      maxWounds: 3,
      members: [],
      abilities: [defaultAbility()]
    };
  }

  function normalizeAbility(source) {
    const ability = Object.assign(defaultAbility(), source ?? {});
    ability.id = String(ability.id || randomId());
    ability.name = String(ability.name || "Способность");
    ability.img = String(ability.img || "icons/svg/aura.svg");
    ability.actionType = ACTION_OPTIONS.some(([value]) => value === String(ability.actionType)) ? String(ability.actionType) : "1";
    ability.frequency = FREQUENCY_OPTIONS.some(([value]) => value === ability.frequency) ? ability.frequency : "round";
    ability.maxUses = clamp(ability.maxUses, 1, 20);
    ability.used = clamp(ability.used, 0, ability.frequency === "atwill" ? 999 : ability.maxUses);
    ability.description = String(ability.description ?? "");
    const damage = parseDamageInput(source?.damageFormula ?? source?.formula ?? "", source?.damageType ?? ability.damageType);
    ability.damageFormula = damage.formula;
    ability.damageType = damage.type;
    delete ability.formula;
    const rawAutomation = source?.automation ?? {};
    const legacyEffectUuid = String(source?.effectUuid ?? "").trim();
    ability.automation = {
      targetMode: TARGET_OPTIONS.some(([value]) => value === rawAutomation.targetMode) ? rawAutomation.targetMode : "none",
      effectUuids: [...new Set([
        ...(Array.isArray(rawAutomation.effectUuids) ? rawAutomation.effectUuids : []),
        ...(legacyEffectUuid ? [legacyEffectUuid] : [])
      ].map((uuid) => String(uuid ?? "").trim()).filter(Boolean))],
      effects: Array.isArray(rawAutomation.effects) ? clone(rawAutomation.effects).filter((effect) => effect && typeof effect === "object") : [],
      increaseConditions: Array.isArray(rawAutomation.increaseConditions) ? clone(rawAutomation.increaseConditions) : [],
      decreaseConditions: Array.isArray(rawAutomation.decreaseConditions) ? clone(rawAutomation.decreaseConditions) : [],
      tempHp: clamp(rawAutomation.tempHp, 0, 999)
    };
    delete ability.effectUuid;
    ability.exposeOnUse = ability.exposeOnUse !== false;
    ability.memberId = String(ability.memberId ?? "");
    ability.minLivingMembers = clamp(ability.minLivingMembers, 0, 6);
    ability.minTrust = clamp(ability.minTrust, 0, 2);
    ability.hideUntilUnlocked = !!ability.hideUntilUnlocked;
    ability.showToPlayers = ability.showToPlayers !== false;
    ability.playerUsable = ability.playerUsable !== false;
    ability.enabled = ability.enabled !== false;
    return ability;
  }

  function normalizeCompanion(source) {
    const companion = Object.assign(defaultCompanion(null), source ?? {});
    companion.id = String(companion.id || randomId());
    companion.actorId = String(companion.actorId ?? "");
    companion.actorUuid = String(companion.actorUuid ?? "");
    companion.name = String(companion.name || "Спутник");
    companion.img = String(companion.img || "icons/svg/mystery-man.svg");
    companion.description = String(companion.description ?? "");
    companion.gmNotes = String(companion.gmNotes ?? "");
    companion.visible = companion.visible !== false;
    companion.exposed = !!companion.exposed;
    companion.pendingThreatType = ["collateral", "direct"].includes(source?.pendingThreatType) ? source.pendingThreatType : "";
    companion.threatPending = !!companion.pendingThreatType;
    companion.pendingWounds = clamp(source?.pendingWounds, 1, 2);
    companion.woundedThisRound = !!companion.woundedThisRound;
    companion.activated = !!companion.activated;
    companion.evacuated = !!companion.evacuated;
    companion.dead = !!companion.dead;
    companion.casualtyPending = !!companion.casualtyPending;
    companion.trust = clamp(companion.trust, 0, 2);
    companion.maxWounds = clamp(companion.maxWounds, 1, 6);
    companion.wounds = clamp(companion.wounds, 0, companion.maxWounds);
    companion.members = Array.isArray(source?.members) ? source.members.map((entry) => {
      const member = Object.assign(defaultMember(), entry ?? {});
      member.id = String(member.id || randomId());
      member.name = String(member.name || "Участник отряда");
      member.dead = !!member.dead;
      return member;
    }) : [];
    if (companion.members.length && companion.members.every((member) => member.dead)) companion.dead = true;
    companion.abilities = Array.isArray(source?.abilities) ? source.abilities.map(normalizeAbility) : [];
    return companion;
  }

  function normalizeState(source) {
    return {
      version: 7,
      companions: Array.isArray(source?.companions) ? source.companions.map(normalizeCompanion) : []
    };
  }

  function getState() {
    return normalizeState(game.settings.get(MOD, SETTING));
  }

  async function saveState(state) {
    return game.settings.set(MOD, SETTING, normalizeState(state));
  }

  let authorityQueue = Promise.resolve();
  function queueAuthority(operation) {
    authorityQueue = authorityQueue.then(operation, operation).catch((error) => {
      console.error(`[${MOD}] Companion operation failed`, error);
      ui.notifications?.error?.("Не удалось обновить состояние спутников. Подробности записаны в консоль.");
    });
    return authorityQueue;
  }

  function isResponsibleGM() {
    const activeGM = game.users.find((user) => user.active && user.isGM);
    return !!game.user?.isGM && (!activeGM || activeGM.id === game.user.id);
  }

  function actorSync(companion) {
    return game.actors.get(companion.actorId)
      ?? globalThis.fromUuidSync?.(companion.actorUuid)
      ?? null;
  }

  async function actorAsync(companion) {
    return game.actors.get(companion.actorId)
      ?? (companion.actorUuid ? await globalThis.fromUuid?.(companion.actorUuid) : null)
      ?? null;
  }

  async function actorFromDrop(event) {
    const nativeEvent = event?.originalEvent ?? event;
    let data;
    try {
      data = globalThis.TextEditor?.getDragEventData?.(nativeEvent)
        ?? JSON.parse(nativeEvent?.dataTransfer?.getData("text/plain") || "{}");
    } catch (_error) {
      return null;
    }
    let document = data?.uuid ? await fromUuid(data.uuid) : null;
    if (!document && data?.type === "Actor" && data?.id) document = game.actors.get(data.id);
    if (document?.documentName === "Token" || document?.constructor?.name === "TokenDocument") document = document.actor;
    return document?.documentName === "Actor" ? document : null;
  }

  async function itemFromDrop(event) {
    const nativeEvent = event?.originalEvent ?? event;
    let data;
    try {
      data = globalThis.TextEditor?.getDragEventData?.(nativeEvent)
        ?? JSON.parse(nativeEvent?.dataTransfer?.getData("text/plain") || "{}");
    } catch (_error) {
      return null;
    }
    const document = data?.uuid ? await globalThis.fromUuid?.(data.uuid) : null;
    return document?.documentName === "Item" ? document : null;
  }

  async function pickImage(current, callback) {
    const FilePickerClass = globalThis.foundry?.applications?.apps?.FilePicker?.implementation
      ?? globalThis.FilePicker?.implementation
      ?? globalThis.FilePicker
      ?? globalThis.CONFIG?.ux?.FilePicker;
    if (!FilePickerClass) return ui.notifications?.error?.("Файловый браузер Foundry недоступен.");
    const picker = new FilePickerClass({ type: "image", current: current || "", callback });
    if (typeof picker.browse === "function") return picker.browse();
    return picker.render(true);
  }

  function abilityLimit(ability) {
    if (ability.frequency === "atwill") return Infinity;
    if (ability.frequency === "round") return 1;
    return Math.max(1, number(ability.maxUses, 1));
  }

  function abilityAvailable(ability) {
    return ability.used < abilityLimit(ability);
  }

  function actionLabel(value) {
    return ACTION_OPTIONS.find(([key]) => key === String(value))?.[1] ?? "Действие";
  }

  function actionGlyph(value) {
    if (value === "free") return "◇";
    if (value === "reaction") return "↶";
    if (value === "passive") return "◆";
    return "◆".repeat(clamp(value, 1, 3));
  }

  function useLabel(ability) {
    if (ability.frequency === "atwill") return "Без ограничений";
    if (ability.frequency === "round") return abilityAvailable(ability) ? "Готово" : "Использовано в этом раунде";
    const label = ability.frequency === "day" ? "в день" : "за столкновение";
    return `${Math.max(0, ability.maxUses - ability.used)} из ${ability.maxUses} ${label}`;
  }

  function trustLabel(value) {
    return TRUST_OPTIONS.find(([rank]) => rank === number(value))?.[1] ?? TRUST_OPTIONS[0][1];
  }

  function trustOptions(selected) {
    return TRUST_OPTIONS.map(([value, label]) => ({ value, label, selected: value === number(selected) }));
  }

  function companionStatus(companion) {
    if (companion.dead) return { key: "dead", label: "Погиб", icon: "fa-skull" };
    if (companion.evacuated) return { key: "evacuated", label: "Эвакуирован", icon: "fa-person-walking-arrow-right" };
    if (companion.casualtyPending) return { key: "casualty", label: "Смертельная потеря", icon: "fa-skull-crossbones" };
    if (companion.wounds >= companion.maxWounds) return { key: "out", label: "Выведен из строя", icon: "fa-heart-crack" };
    if (companion.wounds > 0) return { key: "wounded", label: "Ранен", icon: "fa-droplet" };
    return { key: "ready", label: "Невредим", icon: "fa-shield-heart" };
  }

  function companionCanAct(companion) {
    return !companion.dead && !companion.evacuated && !companion.casualtyPending && companion.wounds < companion.maxWounds;
  }

  function damageTypes() {
    const configured = globalThis.CONFIG?.PF2E?.damageTypes ?? {};
    const preferred = ["bludgeoning", "piercing", "slashing", "healing"];
    const keys = [...preferred, ...Object.keys(configured).filter((key) => !preferred.includes(key) && key !== "untyped"), "untyped"];
    return [...new Set(keys.filter((key) => key in configured || ["bludgeoning", "piercing", "slashing", "healing", "untyped"].includes(key)))];
  }

  function parseDamageInput(value, selectedType = "piercing") {
    let formula = String(value ?? "").trim();
    let type = String(selectedType || "piercing");
    const inline = formula.match(/^@damage\[(.*)\](?:\{.*\})?$/i);
    if (inline) formula = inline[1].trim();
    const typed = formula.match(/^\{?\s*\(?(.+?)\)?\s*\[([a-z-]+)(?:,[^\]]+)?\]\s*\}?$/i);
    if (typed && damageTypes().includes(typed[2].toLowerCase())) {
      formula = typed[1].trim();
      type = typed[2].toLowerCase();
    }
    if (!damageTypes().includes(type)) type = "untyped";
    return { formula, type };
  }

  function damageRollFormula(ability) {
    const formula = String(ability.damageFormula ?? "").trim();
    return formula ? `(${formula})[${ability.damageType || "untyped"}]` : "";
  }

  function damageRollClass() {
    return globalThis.CONFIG?.Dice?.rolls?.find((RollClass) => RollClass.name === "DamageRoll")
      ?? globalThis.CONFIG?.Dice?.rolls?.find((RollClass) => /DamageRoll/.test(RollClass.name));
  }

  function validDamageFormula(ability) {
    const formula = damageRollFormula(ability);
    if (!formula) return true;
    const DamageRoll = damageRollClass();
    try {
      return !!DamageRoll && DamageRoll.validate(formula);
    } catch (_error) {
      return false;
    }
  }

  function damageTypeOptions(selectedType) {
    const configured = globalThis.CONFIG?.PF2E?.damageTypes ?? {};
    return damageTypes().map((value) => ({
      value,
      label: value === "healing" ? "Исцеление" : game.i18n.localize(configured[value] ?? value),
      selected: value === selectedType
    }));
  }

  function targetModeLabel(mode) {
    return TARGET_OPTIONS.find(([value]) => value === mode)?.[1] ?? TARGET_OPTIONS[0][1];
  }

  function selectedTargetUuids() {
    return [...(game.user?.targets ?? [])]
      .map((token) => token?.document?.uuid ?? token?.uuid)
      .filter(Boolean);
  }

  async function notifyUser(user, message, level = "warn") {
    if (!user) return;
    if (user.id === game.user?.id) return ui.notifications?.[level]?.(message);
    game.socket?.emit?.(SOCKET, {
      type: "companion-notify",
      recipientId: user.id,
      userId: game.user?.id,
      level,
      message
    });
  }

  async function resolveAutomationTargets(payload, ability, user) {
    const mode = ability.automation.targetMode;
    if (mode === "none") return [];
    const uuids = [...new Set(Array.isArray(payload?.targetUuids) ? payload.targetUuids.map(String) : [])];
    if ((mode === "one" && uuids.length !== 1) || (mode === "many" && uuids.length < 1)) {
      const message = mode === "one"
        ? `Для способности «${ability.name}» отметь ровно одну цель инструментом целей.`
        : `Для способности «${ability.name}» сначала отметь все затронутые цели.`;
      await notifyUser(user, message);
      return null;
    }
    const actors = [];
    for (const uuid of uuids) {
      const document = await globalThis.fromUuid?.(uuid);
      const actor = document?.documentName === "Actor" ? document : document?.actor;
      if (actor && !actors.some((entry) => entry.uuid === actor.uuid)) actors.push(actor);
    }
    if ((mode === "one" && actors.length !== 1) || (mode === "many" && actors.length < 1)) {
      await notifyUser(user, "Не удалось найти актёров выбранных целей. Обнови сцену и попробуй ещё раз.");
      return null;
    }
    return actors;
  }

  function customEffectSource(spec, ability, index) {
    const duration = spec?.duration ?? {};
    return {
      name: String(spec?.name || `${ability.name} — эффект`),
      type: "effect",
      img: String(spec?.img || ability.img || "icons/svg/aura.svg"),
      system: {
        description: { value: String(spec?.description || ability.description || ""), gm: "" },
        duration: {
          value: Math.max(1, number(duration.value, 1)),
          unit: ["rounds", "minutes", "hours", "days", "unlimited", "encounter"].includes(duration.unit) ? duration.unit : "rounds",
          expiry: ["turn-start", "turn-end", "round-end"].includes(duration.expiry) ? duration.expiry : "turn-start",
          sustained: false
        },
        fromSpell: false,
        level: { value: Math.max(1, number(spec?.level, 1)) },
        publication: { title: "Проклятие Багрового Трона — спутники", authors: "", license: "ORC", remaster: true },
        rules: Array.isArray(spec?.rules) ? clone(spec.rules) : [],
        start: { value: 0, initiative: null },
        tokenIcon: { show: spec?.tokenIcon !== false },
        traits: { rarity: "common", value: Array.isArray(spec?.traits) ? clone(spec.traits) : [] },
        slug: String(spec?.slug || `companion-${ability.id}-${index}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
      },
      flags: {}
    };
  }

  async function effectSources(ability) {
    const sources = [];
    for (const [index, uuid] of ability.automation.effectUuids.entries()) {
      const document = await globalThis.fromUuid?.(uuid);
      if (document?.documentName !== "Item" || document.type !== "effect") throw new Error(`Effect not found: ${uuid}`);
      const source = document.toObject();
      delete source._id;
      source.flags ??= {};
      source.flags[MOD] = { ...(source.flags[MOD] ?? {}), companionAutomationKey: `${ability.id}:uuid:${index}` };
      sources.push(source);
    }
    for (const [index, spec] of ability.automation.effects.entries()) {
      const source = customEffectSource(spec, ability, index);
      source.flags[MOD] = { companionAutomationKey: `${ability.id}:custom:${index}` };
      sources.push(source);
    }
    return sources;
  }

  async function applyAbilityAutomation(ability, targets) {
    if (!targets.length) return { targets: [], applied: [] };
    const sources = await effectSources(ability);
    const applied = [];
    for (const actor of targets) {
      if (sources.length) {
        const keys = new Set(sources.map((source) => source.flags?.[MOD]?.companionAutomationKey).filter(Boolean));
        const oldIds = actor.itemTypes?.effect
          ?.filter((effect) => keys.has(effect.getFlag?.(MOD, "companionAutomationKey")))
          .map((effect) => effect.id) ?? [];
        if (oldIds.length) await actor.deleteEmbeddedDocuments("Item", oldIds);
        await actor.createEmbeddedDocuments("Item", sources.map((source) => clone(source)));
        applied.push(`${sources.length} эфф.`);
      }
      for (const condition of ability.automation.increaseConditions) {
        const slug = String(condition?.slug ?? "").trim();
        if (!slug || typeof actor.increaseCondition !== "function") continue;
        await actor.increaseCondition(slug, {
          value: Math.max(1, number(condition.value, 1)),
          max: Math.max(1, number(condition.max, 99))
        });
        applied.push(slug);
      }
      for (const condition of ability.automation.decreaseConditions) {
        const slug = String(condition?.slug ?? "").trim();
        const steps = clamp(condition?.steps, 1, 10);
        if (!slug || typeof actor.decreaseCondition !== "function") continue;
        for (let step = 0; step < steps && actor.getCondition?.(slug); step += 1) await actor.decreaseCondition(slug);
        applied.push(`−${slug}`);
      }
      if (ability.automation.tempHp > 0) {
        const current = number(actor.system?.attributes?.hp?.temp, 0);
        if (ability.automation.tempHp > current) await actor.update({ "system.attributes.hp.temp": ability.automation.tempHp });
        applied.push(`${ability.automation.tempHp} врем. ОЗ`);
      }
    }
    return { targets: targets.map((actor) => actor.name), applied };
  }

  async function enriched(content, actor = null, secrets = false) {
    const source = String(content ?? "").replace(/@damage\[/gi, "@Damage[");
    return globalThis.TextEditor?.enrichHTML
      ? TextEditor.enrichHTML(source, {
          async: true,
          secrets,
          rollData: actor?.getRollData?.() ?? {},
          relativeTo: actor ?? undefined
        })
      : source;
  }

  async function prepareAbility(ability, companion, isGM, actor) {
    const prepared = clone(ability);
    const member = ability.memberId ? companion.members.find((entry) => entry.id === ability.memberId) : null;
    prepared.memberName = member?.name ?? "Весь отряд";
    prepared.memberAlive = !member?.dead;
    prepared.livingMembers = companion.members.filter((entry) => !entry.dead).length;
    prepared.meetsRoster = prepared.livingMembers >= ability.minLivingMembers;
    prepared.actionLabel = actionLabel(ability.actionType);
    prepared.actionGlyph = actionGlyph(ability.actionType);
    prepared.useLabel = useLabel(ability);
    prepared.available = abilityAvailable(ability);
    prepared.unlocked = companion.trust >= ability.minTrust;
    prepared.trustLabel = trustLabel(ability.minTrust);
    prepared.descriptionHtml = await enriched(ability.description, actor, isGM);
    prepared.isPassive = ability.actionType === "passive";
    prepared.canUse = companionCanAct(companion)
      && !companion.activated
      && ability.enabled
      && prepared.unlocked
      && prepared.memberAlive
      && prepared.meetsRoster
      && ability.actionType !== "passive"
      && abilityAvailable(ability)
      && (isGM || ability.playerUsable);
    if (!prepared.memberAlive) prepared.activationLabel = `${prepared.memberName} погиб`;
    else if (!prepared.meetsRoster) prepared.activationLabel = `Нужно живых: ${ability.minLivingMembers}`;
    else if (!prepared.unlocked) prepared.activationLabel = `Откроется: ${prepared.trustLabel}`;
    else if (!ability.playerUsable && !isGM) prepared.activationLabel = "Только мастер";
    else if (!companionCanAct(companion)) prepared.activationLabel = companionStatus(companion).label;
    else if (companion.activated) prepared.activationLabel = "Уже действовал";
    else if (!abilityAvailable(ability)) prepared.activationLabel = useLabel(ability);
    else prepared.activationLabel = "Активировать";
    prepared.actionOptions = ACTION_OPTIONS.map(([value, label]) => ({ value, label, selected: value === ability.actionType }));
    prepared.frequencyOptions = FREQUENCY_OPTIONS.map(([value, label]) => ({ value, label, selected: value === ability.frequency }));
    prepared.damageTypeOptions = damageTypeOptions(ability.damageType);
    prepared.targetOptions = TARGET_OPTIONS.map(([value, label]) => ({ value, label, selected: value === ability.automation.targetMode }));
    prepared.targetModeLabel = targetModeLabel(ability.automation.targetMode);
    prepared.requiresTargets = ability.automation.targetMode !== "none";
    prepared.targetInstruction = ability.automation.targetMode === "one" ? "одну цель" : "все цели способности";
    prepared.automationEffectCount = ability.automation.effectUuids.length + ability.automation.effects.length;
    prepared.automationEffectLabel = ability.automation.effectUuids.length
      ? (globalThis.fromUuidSync?.(ability.automation.effectUuids[0])?.name ?? "Эффект PF2e")
      : ability.automation.effects[0]?.name ?? "";
    prepared.hasAutomationEffect = prepared.automationEffectCount > 0;
    prepared.trustOptions = trustOptions(ability.minTrust);
    prepared.memberOptions = [
      { value: "", label: "Весь отряд", selected: !ability.memberId },
      ...companion.members.map((entry) => ({ value: entry.id, label: entry.name, selected: entry.id === ability.memberId }))
    ];
    return prepared;
  }

  async function prepareCompanion(companion, isGM) {
    const prepared = clone(companion);
    const actor = actorSync(companion);
    if (actor) {
      prepared.actorExists = true;
      prepared.actorName = actor.name;
      prepared.actorImg = actor.img;
    }
    const status = companionStatus(companion);
    prepared.statusKey = status.key;
    prepared.statusLabel = status.label;
    prepared.statusIcon = status.icon;
    prepared.activationUsed = companion.activated;
    prepared.activationLabel = companion.activated ? "Активация потрачена" : "Активация доступна";
    prepared.canProtect = companion.threatPending && !companion.dead && !companion.evacuated;
    prepared.threatPending = companion.threatPending;
    prepared.pendingThreatLabel = companion.pendingThreatType === "direct"
      ? (companion.pendingWounds === 2 ? "Особая атака" : "Прямая атака")
      : "Побочный эффект";
    prepared.pendingWounds = companion.pendingWounds;
    prepared.pendingWoundsLabel = companion.pendingWounds === 2 ? "2 ранения" : "1 ранение";
    prepared.directAttackActions = 1;
    prepared.directAttackGlyph = "◆";
    prepared.canCollateral = companion.exposed || companion.wounds >= companion.maxWounds;
    prepared.canEvacuate = !companion.dead && !companion.evacuated && companion.wounds >= companion.maxWounds;
    prepared.hasMembers = companion.members.length > 0;
    prepared.casualtyPending = companion.casualtyPending;
    prepared.aliveMembers = companion.members.filter((member) => !member.dead).length;
    prepared.members = companion.members.map((member) => ({ ...clone(member), statusLabel: member.dead ? "Погиб" : "Жив" }));
    prepared.trustLabel = trustLabel(companion.trust);
    prepared.trustOptions = trustOptions(companion.trust);
    prepared.descriptionHtml = await enriched(companion.description, actor, isGM);
    prepared.woundPips = Array.from({ length: companion.maxWounds }, (_entry, index) => ({ filled: index < companion.wounds }));
    const abilities = isGM
      ? companion.abilities
      : companion.abilities.filter((ability) => ability.enabled && ability.showToPlayers && !(ability.hideUntilUnlocked && companion.trust < ability.minTrust));
    prepared.abilities = await Promise.all(abilities.map((ability) => prepareAbility(ability, companion, isGM, actor)));
    return prepared;
  }

  async function addActorToState(actor) {
    if (!game.user?.isGM || !actor) return null;
    const state = getState();
    const existing = state.companions.find((companion) => companion.actorUuid && companion.actorUuid === actor.uuid);
    if (existing) return existing;
    const companion = defaultCompanion(actor);
    state.companions.push(companion);
    await saveState(state);
    return companion;
  }

  async function postAbility(companion, ability, user, automationResult = null) {
    const actor = await actorAsync(companion);
    const speaker = actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
    const description = await enriched(ability.description, actor, false);
    const exposure = ability.exposeOnUse ? "<p class=\"cp-chat__exposure\"><i class=\"fas fa-eye\"></i> Спутник остаётся под угрозой.</p>" : "";
    const automatedTargets = automationResult?.targets?.length
      ? `<p class="cp-chat__automation"><i class="fas ${automationResult.applied?.length ? "fa-wand-magic-sparkles" : "fa-bullseye"}"></i> ${automationResult.applied?.length ? "Эффекты применены" : "Выбранные цели"}: <strong>${automationResult.targets.map(escapeHtml).join(", ")}</strong>.</p>`
      : "";
    const content = `<div class="ct-companion-chat">
      <header><img src="${escapeHtml(companion.img)}" alt=""><div><span>Спутник · активирует ${escapeHtml(user.name)}</span><h3>${escapeHtml(ability.name)} <small>${escapeHtml(actionGlyph(ability.actionType))}</small></h3></div></header>
      <div class="cp-chat__body">${description || "<p>Способность применена.</p>"}</div>${automatedTargets}${exposure}
    </div>`;
    await ChatMessage.create({ speaker, content });
    const formula = damageRollFormula(ability);
    if (!formula) return;
    try {
      const DamageRoll = damageRollClass();
      if (!DamageRoll) throw new Error("PF2e DamageRoll is unavailable");
      const roll = await new DamageRoll(formula, actor?.getRollData?.() ?? {}).evaluate();
      await roll.toMessage({ speaker, flavor: `<strong>${escapeHtml(companion.name)}:</strong> ${escapeHtml(ability.name)}` });
    } catch (error) {
      console.error(`[${MOD}] Invalid companion damage formula: ${formula}`, error);
      ui.notifications?.warn?.(`Не удалось бросить урон способности «${ability.name}». Проверь формулу и тип урона.`);
    }
  }

  async function postCompanionEvent(companion, title, text, icon = "fa-triangle-exclamation") {
    const content = `<div class="ct-companion-chat">
      <header><img src="${escapeHtml(companion.img)}" alt=""><div><span>Спутник · давление боя</span><h3><i class="fas ${icon}"></i> ${escapeHtml(title)}</h3></div></header>
      <div class="cp-chat__body"><p>${text}</p></div>
    </div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker(), content });
  }

  async function announceCompanionHit(companionId, type, woundCount = 1) {
    if (!game.user?.isGM || !["collateral", "direct"].includes(type)) return false;
    const state = getState();
    const companion = state.companions.find((entry) => entry.id === companionId);
    if (!companion || companion.dead || companion.evacuated) return false;
    if (companion.casualtyPending) return ui.notifications?.warn?.("Сначала выбери погибшего участника отряда.");
    if (state.companions.some((entry) => entry.threatPending)) return ui.notifications?.info?.("Сначала разреши уже объявленную атаку на спутника.");
    if (companion.woundedThisRound) return ui.notifications?.info?.(`${companion.name} уже получил ранение в этом раунде.`);
    if (type === "collateral" && !companion.exposed && companion.wounds < companion.maxWounds) {
      return ui.notifications?.info?.("Безопасный спутник не получает побочный урон. Сначала он должен оказаться под угрозой.");
    }

    const pendingWounds = type === "direct" ? clamp(woundCount, 1, 2) : 1;
    companion.pendingThreatType = type;
    companion.pendingWounds = pendingWounds;
    companion.threatPending = true;
    await saveState(state);
    const title = type === "direct" ? `${pendingWounds === 2 ? "Особая атака" : "Прямая атака"} ◆` : "Побочный эффект";
    const detail = type === "direct"
      ? "Враг тратит 1 действие и напрямую атакует спутника."
      : "Спутника задевает уже применённый массовый эффект или опасность сцены.";
    await postCompanionEvent(companion, title, `${detail} <strong>${escapeHtml(companion.name)}</strong> получит ${pendingWounds === 2 ? "2 ранения" : "1 ранение"}, если герой не заслонит его собой.`, type === "direct" ? "fa-crosshairs" : "fa-burst");
    return true;
  }

  async function resolveCompanionHit(companionId) {
    if (!game.user?.isGM) return false;
    const state = getState();
    const companion = state.companions.find((entry) => entry.id === companionId);
    if (!companion?.threatPending || companion.dead || companion.evacuated) return false;
    const woundCount = companion.pendingWounds;
    companion.pendingThreatType = "";
    companion.pendingWounds = 1;
    companion.threatPending = false;

    if (companion.wounds >= companion.maxWounds) {
      const livingMembers = companion.members.filter((member) => !member.dead);
      if (livingMembers.length) {
        companion.casualtyPending = true;
        companion.woundedThisRound = true;
        await saveState(state);
        await postCompanionEvent(companion, "Смертельный удар", `Один из участников отряда <strong>${escapeHtml(companion.name)}</strong> погибает. Мастер выбирает погибшего в панели спутника.`, "fa-skull");
        return true;
      }
      companion.dead = true;
      companion.exposed = false;
      await saveState(state);
      await postCompanionEvent(companion, "Смертельный удар", `<strong>${escapeHtml(companion.name)}</strong> погибает, не успев выбраться из боя.`, "fa-skull");
      return true;
    }

    companion.wounds = clamp(companion.wounds + woundCount, 0, companion.maxWounds);
    companion.woundedThisRound = true;
    const out = companion.wounds >= companion.maxWounds;
    await saveState(state);
    await postCompanionEvent(companion, out ? "Выведен из строя" : "Ранение", out
      ? `<strong>${escapeHtml(companion.name)}</strong> получает ранение и выбывает из столкновения. Теперь его нужно эвакуировать.`
      : `<strong>${escapeHtml(companion.name)}</strong> получает ${woundCount === 2 ? "2 ранения" : "1 ранение"} и остаётся под угрозой.`, out ? "fa-heart-crack" : "fa-droplet");
    return true;
  }

  async function cancelCompanionHit(companionId) {
    if (!game.user?.isGM) return false;
    const state = getState();
    const companion = state.companions.find((entry) => entry.id === companionId);
    if (!companion?.threatPending) return false;
    companion.pendingThreatType = "";
    companion.pendingWounds = 1;
    companion.threatPending = false;
    await saveState(state);
    return true;
  }

  async function setMemberDead(companionId, memberId, dead = true) {
    if (!game.user?.isGM) return false;
    const state = getState();
    const companion = state.companions.find((entry) => entry.id === companionId);
    const member = companion?.members.find((entry) => entry.id === memberId);
    if (!companion || !member) return false;
    member.dead = !!dead;
    companion.casualtyPending = false;
    const alive = companion.members.filter((entry) => !entry.dead).length;
    companion.dead = alive === 0;
    if (dead) {
      companion.maxWounds = Math.max(1, alive);
      companion.wounds = companion.maxWounds;
    } else {
      companion.maxWounds = Math.max(1, alive);
      companion.wounds = Math.min(companion.wounds, Math.max(0, companion.maxWounds - 1));
    }
    await saveState(state);
    await postCompanionEvent(companion, dead ? "Потеря отряда" : "Возвращение", dead
      ? `<strong>${escapeHtml(member.name)}</strong> погибает. Связанная с ним способность становится недоступной.`
      : `<strong>${escapeHtml(member.name)}</strong> снова числится среди живых участников отряда.`, dead ? "fa-skull" : "fa-hand-holding-heart");
    return true;
  }

  function protectingActor() {
    return canvas?.tokens?.controlled?.find((token) => token.actor?.isOwner)?.actor
      ?? game.user?.character
      ?? null;
  }

  async function protectCompanion(payload, user) {
    const state = getState();
    const companion = state.companions.find((entry) => entry.id === payload?.companionId);
    const actor = payload?.actorUuid ? await globalThis.fromUuid?.(payload.actorUuid) : null;
    if (!companion || !companion.threatPending || companion.dead || companion.evacuated || !actor || !user?.active) return false;
    if (!user.isGM && !actor.testUserPermission?.(user, "OWNER")) return false;

    const preventedWounds = companion.pendingWounds;
    companion.threatPending = false;
    companion.pendingThreatType = "";
    companion.pendingWounds = 1;
    await saveState(state);
    const level = Math.max(1, number(actor.level ?? actor.system?.details?.level?.value, 1));
    const damage = level * 2 * preventedWounds;
    await postCompanionEvent(
      companion,
      "Заслонить собой",
      `<strong>${escapeHtml(actor.name)}</strong> тратит реакцию, закрывает собой <strong>${escapeHtml(companion.name)}</strong> и принимает ${damage} неослабляемого урона.`,
      "fa-shield"
    );
    try {
      const DamageRoll = damageRollClass();
      if (DamageRoll) {
        const roll = await new DamageRoll(`(${damage})[untyped]`, actor.getRollData?.() ?? {}).evaluate();
        await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `<strong>Заслонить собой:</strong> защита ${escapeHtml(companion.name)}` });
      }
    } catch (error) {
      console.warn(`[${MOD}] Could not create protection damage card`, error);
    }
    return true;
  }

  async function requestProtection(companionId) {
    const actor = protectingActor();
    if (!actor) return ui.notifications?.warn?.("Выбери свой токен или назначь персонажа пользователю.");
    const payload = { type: "companion-protect", companionId, actorUuid: actor.uuid, userId: game.user.id };
    if (game.user?.isGM) return queueAuthority(() => protectCompanion(payload, game.user));
    const gm = game.users.find((user) => user.active && user.isGM);
    if (!gm) return ui.notifications?.warn?.("Для защиты спутника нужен активный Мастер.");
    game.socket?.emit?.(SOCKET, payload);
    return true;
  }

  async function evacuateCompanion(payload, user) {
    const state = getState();
    const companion = state.companions.find((entry) => entry.id === payload?.companionId);
    if (!companion || companion.dead || companion.evacuated || companion.wounds < companion.maxWounds || !user?.active) return false;
    companion.evacuated = true;
    companion.exposed = false;
    companion.threatPending = false;
    companion.pendingThreatType = "";
    companion.pendingWounds = 1;
    await saveState(state);
    await postCompanionEvent(companion, "Эвакуация", `<strong>${escapeHtml(user.name)}</strong> тратит 2 действия и выводит <strong>${escapeHtml(companion.name)}</strong> из опасной зоны.`, "fa-person-walking-arrow-right");
    return true;
  }

  async function requestEvacuation(companionId) {
    const payload = { type: "companion-evacuate", companionId, userId: game.user.id };
    if (game.user?.isGM) return queueAuthority(() => evacuateCompanion(payload, game.user));
    const gm = game.users.find((user) => user.active && user.isGM);
    if (!gm) return ui.notifications?.warn?.("Для эвакуации спутника нужен активный Мастер.");
    game.socket?.emit?.(SOCKET, payload);
    return true;
  }

  async function useAbility(payload, user) {
    const state = getState();
    const companion = state.companions.find((entry) => entry.id === payload?.companionId);
    const ability = companion?.abilities.find((entry) => entry.id === payload?.abilityId);
    const member = ability?.memberId ? companion?.members.find((entry) => entry.id === ability.memberId) : null;
    const livingMembers = companion?.members.filter((entry) => !entry.dead).length ?? 0;
    if (!companion || !ability || !user?.active) return false;
    if (member?.dead || livingMembers < ability.minLivingMembers || !companionCanAct(companion) || companion.activated || !ability.enabled || companion.trust < ability.minTrust || ability.actionType === "passive" || !abilityAvailable(ability)) return false;
    if (!user.isGM && (!companion.visible || !ability.showToPlayers || !ability.playerUsable)) return false;
    if (!validDamageFormula(ability)) {
      ui.notifications?.warn?.(`У способности «${ability.name}» неверная формула урона.`);
      return false;
    }
    const targets = await resolveAutomationTargets(payload, ability, user);
    if (targets === null) return false;

    if (ability.frequency !== "atwill") ability.used += 1;
    companion.activated = true;
    if (ability.exposeOnUse) companion.exposed = true;
    await saveState(state);
    let automationResult = null;
    try {
      automationResult = await applyAbilityAutomation(ability, targets);
    } catch (error) {
      console.error(`[${MOD}] Companion automation failed for ${ability.name}`, error);
      await notifyUser(user, `Способность «${ability.name}» применена, но её автоматический эффект не удалось добавить.`, "error");
    }
    await postAbility(companion, ability, user, automationResult);
    return true;
  }

  async function requestAbility(companionId, abilityId) {
    const targetUuids = selectedTargetUuids();
    if (game.user?.isGM) return queueAuthority(() => useAbility({ companionId, abilityId, targetUuids }, game.user));
    const gm = game.users.find((user) => user.active && user.isGM);
    if (!gm) return ui.notifications?.warn?.("Для применения способности нужен активный Мастер.");
    game.socket?.emit?.(SOCKET, { type: "companion-use", companionId, abilityId, targetUuids, userId: game.user.id });
    return true;
  }

  async function resetResources(scope) {
    if (!game.user?.isGM) return;
    const state = getState();
    for (const companion of state.companions) {
      if (scope === "round" && companion.exposed && !companion.activated && !companion.threatPending) companion.exposed = false;
      companion.activated = false;
      if (["round", "encounter", "day"].includes(scope)) companion.woundedThisRound = false;
      for (const ability of companion.abilities) {
        if (scope === "round" && ability.frequency === "round") ability.used = 0;
        if (scope === "encounter" && ["round", "encounter"].includes(ability.frequency)) ability.used = 0;
        if (scope === "day") ability.used = 0;
      }
      if (["encounter", "day"].includes(scope)) {
        companion.exposed = false;
        companion.threatPending = false;
        companion.pendingThreatType = "";
        companion.pendingWounds = 1;
      }
    }
    await saveState(state);
  }

  function showToPlayers() {
    if (!game.user?.isGM) return;
    game.socket?.emit?.(SOCKET, { type: "companion-open", userId: game.user.id });
    ui.notifications?.info?.("Панель спутников открыта у активных игроков.");
  }

  function confirmDelete(message) {
    return globalThis.confirm(message);
  }

  class CompanionApp extends BaseApplication {
    constructor(options = {}) {
      super(options);
      this.selectedId = "";
    }

    static get DEFAULT_OPTIONS() {
      const options = CT.v2Options({
        id: "ct-companions",
        title: "Спутники",
        classes: ["ct-companion-app", "sheet"],
        width: 920,
        height: 780
      });
      options.window.controls = [{
        action: "showPlayers",
        icon: "fa-solid fa-users-viewfinder",
        label: "Показать игрокам",
        visible: !!game.user?.isGM
      }];
      options.actions = { showPlayers() { showToPlayers(); } };
      return options;
    }

    static get PARTS() { return CT.singleTemplatePart(TEMPLATE); }

    static get defaultOptions() {
      return CT.v1Options(super.defaultOptions, {
        id: "ct-companions",
        title: "Спутники",
        template: TEMPLATE,
        classes: ["ct-companion-app", "sheet"],
        width: 920,
        height: 780,
        resizable: true
      });
    }

    _getHeaderButtons() {
      const buttons = super._getHeaderButtons?.() ?? [];
      if (game.user?.isGM) buttons.unshift({
        label: "Показать игрокам",
        class: "cp-show-players",
        icon: "fas fa-users",
        onclick: showToPlayers
      });
      return buttons;
    }

    async _prepareContext(options) { return this.getData(options); }

    async _onRender(context, options) {
      await super._onRender?.(context, options);
      this.activateListeners(CT.asHtml(CT.part(this, ".ct-companions")));
    }

    async getData() {
      const state = getState();
      if (!state.companions.some((companion) => companion.id === this.selectedId)) this.selectedId = state.companions[0]?.id ?? "";
      const prepared = await Promise.all(state.companions.map((companion) => prepareCompanion(companion, !!game.user?.isGM)));
      prepared.forEach((companion) => { companion.isSelected = companion.id === this.selectedId; });
      const selected = prepared.find((companion) => companion.id === this.selectedId) ?? null;
      const visibleCompanions = prepared.filter((companion) => companion.visible);
      const selectedToken = canvas?.tokens?.controlled?.[0]?.actor;
      return {
        isGM: !!game.user?.isGM,
        companions: prepared,
        visibleCompanions,
        selected,
        hasCompanions: prepared.length > 0,
        hasVisibleCompanions: visibleCompanions.length > 0,
        selectedToken: selectedToken ? { id: selectedToken.id, name: selectedToken.name } : null
      };
    }

    activateListeners(html) {
      super.activateListeners?.(html);
      const root = html?.jquery ? html[0] : html?.[0] ?? html;
      if (root?.dataset?.ctCompanionsBound === "true") return;
      if (root?.dataset) root.dataset.ctCompanionsBound = "true";

      html.on("dragover", ".cp-dropzone", (event) => {
        event.preventDefault();
        event.currentTarget.classList.add("is-dragover");
      });
      html.on("dragleave", ".cp-dropzone", (event) => event.currentTarget.classList.remove("is-dragover"));
      html.on("drop", ".cp-dropzone", async (event) => {
        event.preventDefault();
        event.currentTarget.classList.remove("is-dragover");
        if (!game.user?.isGM) return;
        const actor = await actorFromDrop(event);
        if (!actor || !["character", "npc"].includes(actor.type)) return ui.notifications?.warn?.("Перетащи персонажа или NPC из вкладки актёров либо токен со сцены.");
        const companion = await addActorToState(actor);
        if (companion) {
          this.selectedId = companion.id;
          this.render();
        }
      });

      html.on("dragover", ".cp-effect-dropzone", (event) => {
        event.preventDefault();
        event.currentTarget.classList.add("is-dragover");
      });
      html.on("dragleave", ".cp-effect-dropzone", (event) => event.currentTarget.classList.remove("is-dragover"));
      html.on("drop", ".cp-effect-dropzone", async (event) => {
        event.preventDefault();
        event.currentTarget.classList.remove("is-dragover");
        if (!game.user?.isGM) return;
        const item = await itemFromDrop(event);
        if (!item || item.type !== "effect") return ui.notifications?.warn?.("Перетащи сюда предмет типа «Эффект» из библиотеки PF2e или листа актёра.");
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        const ability = companion?.abilities.find((entry) => entry.id === event.currentTarget.dataset.abilityId);
        if (!ability) return;
        ability.automation.effectUuids = [item.uuid];
        ability.automation.effects = [];
        if (ability.automation.targetMode === "none") ability.automation.targetMode = "one";
        await saveState(state);
      });

      html.on("click", ".cp-add-selected", async () => {
        if (!game.user?.isGM) return;
        const actor = canvas?.tokens?.controlled?.[0]?.actor;
        if (!actor) return ui.notifications?.warn?.("Сначала выбери токен спутника на сцене.");
        const companion = await addActorToState(actor);
        if (companion) {
          this.selectedId = companion.id;
          this.render();
        }
      });

      html.on("click", ".cp-select", (event) => {
        this.selectedId = event.currentTarget.dataset.companionId;
        this.render();
      });

      html.on("click", ".cp-pick-companion-image", async (event) => {
        if (!game.user?.isGM) return;
        const companionId = event.currentTarget.dataset.companionId;
        const companion = getState().companions.find((entry) => entry.id === companionId);
        if (!companion) return;
        await pickImage(companion.img, async (path) => {
          const state = getState();
          const current = state.companions.find((entry) => entry.id === companionId);
          if (!current || !path) return;
          current.img = path;
          await saveState(state);
        });
      });

      html.on("change", ".cp-companion-field", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (!companion) return;
        const field = event.currentTarget.dataset.field;
        if (!["name", "description", "gmNotes", "visible", "exposed", "evacuated", "dead", "maxWounds", "trust"].includes(field)) return;
        let value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
        if (field === "maxWounds") {
          value = clamp(value, 1, 6);
          companion.wounds = Math.min(companion.wounds, value);
        }
        if (field === "trust") value = clamp(value, 0, 2);
        companion[field] = value;
        await saveState(state);
      });

      html.on("click", ".cp-wound", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (!companion) return;
        companion.wounds = clamp(companion.wounds + number(event.currentTarget.dataset.delta), 0, companion.maxWounds);
        if (companion.wounds < companion.maxWounds) companion.dead = false;
        await saveState(state);
      });

      html.on("click", ".cp-member-death", (event) => queueAuthority(() => setMemberDead(
        event.currentTarget.dataset.companionId,
        event.currentTarget.dataset.memberId,
        event.currentTarget.dataset.dead === "true"
      )));

      html.on("click", ".cp-add-member", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (!companion) return;
        companion.members.push(defaultMember());
        companion.maxWounds = Math.max(companion.maxWounds, companion.members.filter((member) => !member.dead).length);
        await saveState(state);
      });

      html.on("change", ".cp-member-field", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        const member = companion?.members.find((entry) => entry.id === event.currentTarget.dataset.memberId);
        if (!member || event.currentTarget.dataset.field !== "name") return;
        member.name = String(event.currentTarget.value || "Участник отряда");
        await saveState(state);
      });

      html.on("click", ".cp-delete-member", async (event) => {
        if (!game.user?.isGM || !confirmDelete("Удалить участника из состава отряда?")) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (!companion) return;
        const memberId = event.currentTarget.dataset.memberId;
        companion.members = companion.members.filter((entry) => entry.id !== memberId);
        for (const ability of companion.abilities) if (ability.memberId === memberId) ability.memberId = "";
        await saveState(state);
      });

      html.on("click", ".cp-sync-actor", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        const actor = companion ? await actorAsync(companion) : null;
        if (!actor) return ui.notifications?.warn?.("Исходный актёр больше недоступен.");
        companion.name = actor.name;
        companion.img = actor.img;
        companion.actorId = actor.id;
        companion.actorUuid = actor.uuid;
        await saveState(state);
      });

      html.on("click", ".cp-open-actor", async (event) => {
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        const actor = companion ? await actorAsync(companion) : null;
        if (!actor) return ui.notifications?.warn?.("Исходный актёр больше недоступен.");
        actor.sheet?.render?.(true);
      });

      html.on("click", ".cp-delete-companion", async (event) => {
        if (!game.user?.isGM || !confirmDelete("Удалить спутника из панели? Сам актёр не будет удалён.")) return;
        const state = getState();
        const index = state.companions.findIndex((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (index < 0) return;
        state.companions.splice(index, 1);
        this.selectedId = state.companions[Math.min(index, state.companions.length - 1)]?.id ?? "";
        await saveState(state);
      });

      html.on("click", ".cp-add-ability", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (!companion) return;
        companion.abilities.push(defaultAbility());
        await saveState(state);
      });

      html.on("click", ".cp-pick-ability-image", async (event) => {
        if (!game.user?.isGM) return;
        const companionId = event.currentTarget.dataset.companionId;
        const abilityId = event.currentTarget.dataset.abilityId;
        const companion = getState().companions.find((entry) => entry.id === companionId);
        const ability = companion?.abilities.find((entry) => entry.id === abilityId);
        if (!ability) return;
        await pickImage(ability.img, async (path) => {
          const state = getState();
          const currentCompanion = state.companions.find((entry) => entry.id === companionId);
          const currentAbility = currentCompanion?.abilities.find((entry) => entry.id === abilityId);
          if (!currentAbility || !path) return;
          currentAbility.img = path;
          await saveState(state);
        });
      });

      html.on("change", ".cp-ability-field", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        const ability = companion?.abilities.find((entry) => entry.id === event.currentTarget.dataset.abilityId);
        if (!ability) return;
        const field = event.currentTarget.dataset.field;
        if (!["name", "actionType", "frequency", "maxUses", "description", "damageFormula", "damageType", "automation.targetMode", "exposeOnUse", "memberId", "minLivingMembers", "minTrust", "hideUntilUnlocked", "showToPlayers", "playerUsable", "enabled"].includes(field)) return;
        let value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
        if (field === "maxUses") value = clamp(value, 1, 20);
        if (field === "minLivingMembers") value = clamp(value, 0, 6);
        if (field === "minTrust") value = clamp(value, 0, 2);
        if (field === "damageFormula") {
          const damage = parseDamageInput(value, ability.damageType);
          ability.damageFormula = damage.formula;
          ability.damageType = damage.type;
        } else if (field === "automation.targetMode") ability.automation.targetMode = value;
        else ability[field] = value;
        if (["frequency", "maxUses"].includes(field)) ability.used = Math.min(ability.used, abilityLimit(ability));
        await saveState(state);
      });

      html.on("click", ".cp-remove-ability-effect", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        const ability = companion?.abilities.find((entry) => entry.id === event.currentTarget.dataset.abilityId);
        if (!ability) return;
        ability.automation.effectUuids = [];
        ability.automation.effects = [];
        await saveState(state);
      });

      html.on("click", ".cp-delete-ability", async (event) => {
        if (!game.user?.isGM || !confirmDelete("Удалить эту способность?")) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (!companion) return;
        companion.abilities = companion.abilities.filter((entry) => entry.id !== event.currentTarget.dataset.abilityId);
        await saveState(state);
      });

      html.on("click", ".cp-move-ability", async (event) => {
        if (!game.user?.isGM) return;
        const state = getState();
        const companion = state.companions.find((entry) => entry.id === event.currentTarget.dataset.companionId);
        if (!companion) return;
        const index = companion.abilities.findIndex((entry) => entry.id === event.currentTarget.dataset.abilityId);
        const target = index + number(event.currentTarget.dataset.delta);
        if (index < 0 || target < 0 || target >= companion.abilities.length) return;
        [companion.abilities[index], companion.abilities[target]] = [companion.abilities[target], companion.abilities[index]];
        await saveState(state);
      });

      html.on("click", ".cp-use-ability", (event) => requestAbility(event.currentTarget.dataset.companionId, event.currentTarget.dataset.abilityId));
      html.on("click", ".cp-announce-hit", (event) => queueAuthority(() => announceCompanionHit(event.currentTarget.dataset.companionId, event.currentTarget.dataset.hitType, event.currentTarget.dataset.wounds)));
      html.on("click", ".cp-resolve-hit", (event) => queueAuthority(() => resolveCompanionHit(event.currentTarget.dataset.companionId)));
      html.on("click", ".cp-cancel-hit", (event) => queueAuthority(() => cancelCompanionHit(event.currentTarget.dataset.companionId)));
      html.on("click", ".cp-protect", (event) => requestProtection(event.currentTarget.dataset.companionId));
      html.on("click", ".cp-evacuate", (event) => requestEvacuation(event.currentTarget.dataset.companionId));
      html.on("click", ".cp-reset-round", () => queueAuthority(() => resetResources("round")));
      html.on("click", ".cp-reset-encounter", () => queueAuthority(() => resetResources("encounter")));
      html.on("click", ".cp-reset-day", () => queueAuthority(() => resetResources("day")));
      html.on("click", ".cp-show-players", showToPlayers);
    }
  }

  let app;
  function openCompanions() {
    if (!app) app = new CompanionApp();
    app.render(true, { focus: true });
    return app;
  }

  function registerSettings() {
    if (game.settings.settings.has(`${MOD}.${SETTING}`)) return;
    game.settings.register(MOD, SETTING, {
      name: "Companion cards state",
      scope: "world",
      config: false,
      type: Object,
      default: clone(DEFAULT_STATE)
    });
  }

  function setupRuntime() {
    const runtimeKey = `${MOD}.companionsReady`;
    if (globalThis[runtimeKey]) return;
    globalThis[runtimeKey] = true;

    game.socket?.on?.(SOCKET, (payload) => {
      if (payload?.type === "companion-notify") {
        const sender = game.users.get(payload.userId);
        if (payload.recipientId === game.user?.id && sender?.isGM) ui.notifications?.[payload.level]?.(String(payload.message ?? ""));
        return;
      }
      if (payload?.type === "companion-open") {
        const sender = game.users.get(payload.userId);
        if (!game.user?.isGM && sender?.isGM) openCompanions();
        return;
      }
      if (!isResponsibleGM() || !["companion-use", "companion-protect", "companion-evacuate"].includes(payload?.type)) return;
      const user = game.users.get(payload.userId);
      if (!user) return;
      if (payload.type === "companion-use") queueAuthority(() => useAbility(payload, user));
      if (payload.type === "companion-protect") queueAuthority(() => protectCompanion(payload, user));
      if (payload.type === "companion-evacuate") queueAuthority(() => evacuateCompanion(payload, user));
    });

    const mod = game.modules.get(MOD);
    if (mod) {
      mod.api = mod.api || {};
      mod.api.openCompanions = openCompanions;
      mod.api.showCompanionsToPlayers = showToPlayers;
      mod.api.resetCompanionRound = () => queueAuthority(() => resetResources("round"));
      mod.api.resetCompanionEncounter = () => queueAuthority(() => resetResources("encounter"));
      mod.api.resetCompanionDay = () => queueAuthority(() => resetResources("day"));
      mod.api.announceCompanionHit = (companionId, type = "direct", wounds = 1) => queueAuthority(() => announceCompanionHit(companionId, type, wounds));
      mod.api.resolveCompanionHit = (companionId) => queueAuthority(() => resolveCompanionHit(companionId));
    }
  }

  if (game.ready) {
    registerSettings();
    setupRuntime();
  } else {
    Hooks.once("init", registerSettings);
    Hooks.once("ready", setupRuntime);
  }

  Hooks.on("getSceneControlButtons", (controls) => {
    const tool = {
      name: "ct-companions",
      title: "Спутники",
      icon: "fas fa-people-group",
      button: true,
      order: 90,
      onClick: openCompanions,
      onChange: () => openCompanions()
    };

    if (Array.isArray(controls)) {
      const tokenControls = controls.find((control) => control.name === "token" || control.name === "tokens");
      if (tokenControls?.tools && !tokenControls.tools.some((entry) => entry.name === tool.name)) tokenControls.tools.push(tool);
      return;
    }

    const tokenControls = controls?.tokens ?? controls?.token;
    if (!tokenControls?.tools) return;
    if (Array.isArray(tokenControls.tools)) {
      if (!tokenControls.tools.some((entry) => entry.name === tool.name)) tokenControls.tools.push(tool);
    } else {
      tokenControls.tools[tool.name] = tool;
    }
  });

  Hooks.on("combatStart", () => {
    if (isResponsibleGM()) queueAuthority(() => resetResources("encounter"));
  });

  Hooks.on("updateCombat", (_combat, changed) => {
    if (isResponsibleGM() && Object.prototype.hasOwnProperty.call(changed ?? {}, "round")) {
      queueAuthority(() => resetResources("round"));
    }
  });

  Hooks.on("controlToken", () => { if (app?.rendered && game.user?.isGM) app.render(); });
  Hooks.on("updateSetting", (setting) => {
    if (setting?.key === `${MOD}.${SETTING}` && app?.rendered) app.render();
  });
})();
