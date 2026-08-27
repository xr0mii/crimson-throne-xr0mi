// Dynamic Korvosa settlement profile for Foundry VTT v13/v14 and PF2e Remaster.
(function () {
  const MOD = "crimson-throne-xr0mi";
  const SETTING = "korvosaSettlementState";
  const SOCKET = `module.${MOD}`;
  const TEMPLATE = `modules/${MOD}/templates/korvosa-settlement.html`;
  const CT = globalThis.CrimsonThroneCompat;
  const BaseApplication = CT?.getTemplateApplicationBase?.();

  if (!BaseApplication) {
    console.warn(`[${MOD}] Korvosa settlement profile disabled: no compatible Application API found.`);
    return;
  }

  const PROFILES = {
    normal: {
      key: "normal",
      label: "Действующий город",
      tone: "stable",
      marketLevel: 11,
      reliableLevel: 9,
      earnIncomeLevel: 11,
      spellRank: 6,
      specialOrders: true,
      orderDelay: "2–7 дней, затем +2 дня за каждый уровень сверх рынка",
      diseaseCare: true,
      armsPermit: false,
      danger: "Обычная городская опасность",
      summary: "Торговый порт работает в полную силу; храмы, Университет и частные мастера принимают клиентов.",
      qualities: [
        ["fa-graduation-cap", "Магическая академия", "При изучении арканного заклинания наставник даёт +2 обстоятельственный бонус; необычные заклинания — по решению мастера."],
        ["fa-building-columns", "Священный центр", "Крупные храмы поддерживают обычные сакральные услуги вплоть до указанного ранга."],
        ["fa-ship", "Торговый порт", "Доступны спецзаказы, а обычные товары регулярно пополняются морем и караванами."],
        ["fa-wand-magic-sparkles", "Арканный рынок", "Акадамия и частные арканные лавки облегчают поиск магических формул и специалистов."]
      ]
    },
    unrest: {
      key: "unrest",
      label: "Напряжённость",
      tone: "unrest",
      marketLevel: 9,
      reliableLevel: 7,
      earnIncomeLevel: 8,
      spellRank: 4,
      specialOrders: true,
      orderDelay: "1–2 недели; только через надёжного посредника",
      diseaseCare: true,
      armsPermit: false,
      danger: "Очаги беспорядков и усиленные патрули",
      summary: "Большая часть города работает, но учреждения закрываются без предупреждения, а дорогие товары придерживают.",
      qualities: [
        ["fa-door-closed", "Частичные закрытия", "Акадамия не обслуживает посторонних; храмы и школы ограничивают доступ."],
        ["fa-face-frown", "Подавленность", "Работы меньше, покупатели осторожны, а торговцы не рискуют выставлять лучшие товары."],
        ["fa-user-secret", "Посредники", "Спецзаказ возможен, но требует времени, связей и обычной цены без гарантии анонимности."]
      ]
    },
    anarchy: {
      key: "anarchy",
      label: "Анархия",
      tone: "anarchy",
      marketLevel: 9,
      reliableLevel: 5,
      earnIncomeLevel: 5,
      spellRank: 4,
      specialOrders: false,
      orderDelay: "Спецзаказы не принимаются",
      diseaseCare: true,
      armsPermit: false,
      danger: "Погромы, пожары, мародёры и разрозненная стража",
      summary: "Поставки почти остановлены. На рынках остаются случайные запасы, но надёжно найти можно лишь простые товары.",
      qualities: [
        ["fa-fire", "Погромы", "Поиск товара верхнего уровня рынка означает риск, задержку и ограниченное количество."],
        ["fa-shop-slash", "Остановленные поставки", "Новые специальные заказы не принимаются, многие лавки заперты или разграблены."],
        ["fa-scale-unbalanced", "Нет единой власти", "Разрешение одной группы не защищает от другой; сделки совершаются на риск покупателей."]
      ]
    },
    plagued: {
      key: "plagued",
      label: "Мор",
      tone: "plagued",
      marketLevel: 9,
      reliableLevel: 6,
      earnIncomeLevel: 7,
      spellRank: 4,
      specialOrders: false,
      orderDelay: "Спецзаказы не принимаются",
      diseaseCare: false,
      armsPermit: false,
      danger: "Заражённые кварталы, карантин и истощённые лекари",
      summary: "Обычная торговля ещё теплится, но лечебные ресурсы исчерпаны, конфискованы или распределяются властями.",
      qualities: [
        ["fa-virus", "Кровавая вуаль", "Предметы и услуги, способные устранить болезнь, в открытой продаже отсутствуют."],
        ["fa-mask-face", "Карантин", "Перемещение товаров между кварталами замедлено; Старую Корвосу могут полностью отрезать."],
        ["fa-hand-holding-medical", "Истощённые храмы", "Обычные услуги доступны лишь до указанного ранга; сюжетные союзники считаются отдельно."]
      ]
    },
    martial: {
      key: "martial",
      label: "Военное положение",
      tone: "martial",
      marketLevel: 7,
      reliableLevel: 5,
      earnIncomeLevel: 6,
      spellRank: 2,
      specialOrders: false,
      orderDelay: "Частные спецзаказы запрещены",
      diseaseCare: true,
      armsPermit: true,
      danger: "Комендантский час, обыски и патрули Серых Дев",
      summary: "Государство контролирует ремесленников и поставки. Дорогие товары уходят армии, а вооружение продают только с разрешением.",
      qualities: [
        ["fa-moon", "Комендантский час", "С 18:00 до 06:00 улицы закрыты; ночные сделки считаются нелегальными."],
        ["fa-file-shield", "Разрешения", "Оружие, доспехи и щиты требуют разрешения властей либо доступа к чёрному рынку."],
        ["fa-boxes-packing", "Реквизиции", "Лучшие товары и услуги конфискуются для короны; спецзаказы для частных лиц не принимаются."]
      ]
    }
  };

  const BRIDGEFRONT_PROFILE = {
    key: "bridgefront",
    locationId: "bridgefront",
    name: "Бриджфронт",
    scopeLabel: "Район Старой Корвосы",
    label: "Карантин и кошмары",
    tone: "bridgefront",
    marketLevel: 6,
    reliableLevel: 3,
    earnIncomeLevel: 4,
    spellRank: 4,
    specialOrders: false,
    orderDelay: "Обычные поставщики не проходят карантин",
    diseaseCare: true,
    armsPermit: false,
    oldKorvosaClosed: true,
    partyLevelCeiling: true,
    barter: true,
    danger: "Карантин, преступность, Трепет и нарастающие кошмары",
    summary: "Бедный перенаселённый район отрезан от остальной Корвосы. Обычные товары ещё ходят по утренним рынкам, но монеты мало: сделки часто требуют обмена, услуги или знакомства.",
    categoryCaps: {
      occult: { marketLevel: 8, reliableLevel: 5, channel: "оккультного посредника" },
      disease: { marketLevel: 8, reliableLevel: 4, channel: "надёжного аптекаря" },
      contraband: { marketLevel: 9, reliableLevel: 6, channel: "подпольного торговца" }
    },
    qualities: [
      ["fa-handshake", "Бартер вместо монеты", "Часть цены можно заменить товаром, услугой или небольшим поручением — по решению мастера."],
      ["fa-moon", "Ночной рынок", "Обычные и подержанные товары соседствуют с гадателями, скупщиками и нелегальными посредниками."],
      ["fa-book-skull", "Оккультное подполье", "Редкие книги, ритуальные принадлежности и услуги находятся лучше обычного, но требуют нужного знакомства."],
      ["fa-flask-vial", "Лекарства и подделки", "Надёжные средства есть лишь у считаных мастеров; дешёвые чудо-снадобья часто оказываются мошенничеством."],
      ["fa-eye", "Трепет в избытке", "Местный наркотик доступнее прочей контрабанды, но любая сделка с ним незаконна и опасна."],
      ["fa-person-walking-arrow-right", "Изоляция", "Покупка за пределами района — не проверка рынка, а отдельная сцена преодоления карантина."]
    ],
    event: {
      id: "bridgefront-quarantine",
      public: "Бриджфронт отрезан карантином. Днём здесь торгуют самым необходимым, а редкости переходят из рук в руки через посредников и ночные рынки.",
      gm: "Профиль рассчитан на «Кошмары Бриджфронта» и группу 6–9 уровней. Кошмарная чума — сюжетная тайна: публичный рынок не объясняет её природу."
    }
  };

  const EVENTS = [
    { group: "Глава 1 · На краю анархии", id: "campaign-start", profile: "normal", label: "До смерти короля", public: "Корвоса живёт по привычному строгому распорядку.", gm: "Исходный профиль до выхода героев из Старой рыбальни." },
    { group: "Глава 1 · На краю анархии", id: "king-dead", profile: "anarchy", label: "Смерть Эодреда II", public: "В городе вспыхивают погромы; доки и караваны прекращают работу.", gm: "Первое переключение на Anarchy." },
    { group: "Глава 1 · На краю анархии", id: "brooch-audience", profile: "unrest", label: "Аудиенция у Илеосы", public: "Основные улицы вновь проходимы, но очаги насилия сохраняются.", gm: "При начале события с возвращением броши — Unrest." },
    { group: "Глава 1 · На краю анархии", id: "trinia-rumors", profile: "anarchy", label: "Слухи о Тринии Сабор", public: "Обвинения в цареубийстве вновь поднимают толпы.", gm: "Перед поиском Тринии — снова Anarchy." },
    { group: "Глава 1 · На краю анархии", id: "trinia-resolved", profile: "unrest", label: "После поисков Тринии", public: "Город затихает, хотя напряжение никуда не исчезло.", gm: "После разрешения события с Тринией — Unrest до начала мора." },
    { group: "Глава 2 · Семь дней до могилы", id: "infection", profile: "unrest", label: "Первые заражения", public: "После недолгой передышки в бедных кварталах появляются тревожные слухи.", gm: "До начала части Outbreak сохраняется Unrest." },
    { group: "Глава 2 · Семь дней до могилы", id: "outbreak", profile: "plagued", label: "Вспышка Кровавой вуали", public: "Эпидемия признана открыто; лечебные ресурсы исчезают с прилавков.", gm: "С начала части Outbreak — Plagued." },
    { group: "Глава 2 · Семь дней до могилы", id: "old-korvosa-quarantine", profile: "plagued", label: "Карантин Старой Корвосы", public: "Старая Корвоса отрезана; торговля через Пролив прекращена.", gm: "Plagued плюс полная недоступность рынка Старой Корвосы.", oldKorvosaClosed: true },
    { group: "Главы 3–4 · Власть Илеосы", id: "martial-law", profile: "martial", label: "Военное положение", public: "Серые Девы контролируют улицы, поставки и ремесленников.", gm: "Основной профиль после мора и в начале «Истории праха»." },
    { group: "Глава 4 · История праха", id: "deathhead-falls", profile: "unrest", label: "Падение Хранилища Мёртвой Головы", public: "Ресурсы короны истощены; рынки понемногу открываются.", gm: "Если операция успешна, военное положение временно заканчивается." },
    { group: "Глава 6 · Корона клыков", id: "rebellion-0-2", profile: "unrest", label: "Восстание: 0–2 ОВ", public: "Сопротивление скрывается, а город ждёт первого удара.", gm: "Unrest, если Хранилище уничтожено; иначе выберите вариант ниже." },
    { group: "Глава 6 · Корона клыков", id: "rebellion-0-2-vault", profile: "martial", label: "0–2 ОВ, Хранилище уцелело", public: "Корона по-прежнему полностью контролирует город.", gm: "Альтернативный профиль при провале операции в Хранилище." },
    { group: "Глава 6 · Корона клыков", id: "rebellion-3-5", profile: "martial", label: "Восстание: 3–5 ОВ", public: "Корона отвечает на точечные удары сопротивления новыми репрессиями.", gm: "По исходнику снова используется Martial Law." },
    { group: "Глава 6 · Корона клыков", id: "rebellion-6-7", profile: "anarchy", label: "Восстание: 6–7 ОВ", public: "На улицах идут бои; районы переходят из рук в руки.", gm: "Открытое восстание — Anarchy." },
    { group: "Глава 6 · Корона клыков", id: "rebellion-8", profile: "normal", label: "Восстание: 8+ ОВ", public: "Силы Илеосы вытеснены; город возвращается к нормальной жизни.", gm: "До возвращения Илеосы используется обычный профиль." },
    { group: "После кампании", id: "ileosa-defeated", profile: "normal", label: "Илеоса побеждена", public: "Корвоса свободна и начинает долгую работу по восстановлению.", gm: "Базовый рынок восстановлен; правителей и угрозы мастер обновляет по итогам кампании." }
  ];

  const EVENT_MAP = Object.fromEntries(EVENTS.map((entry) => [entry.id, entry]));
  const DEFAULT_STATE = { version: 3, locationId: "korvosa", bridgefrontUnlocked: false, eventId: "campaign-start", overrides: {}, bridgefrontOverrides: {} };
  const DEFAULT_QUERY = { name: "", img: "", level: 0, rarity: "common", category: "general", district: "korvosa", partyLevel: 1, priceGp: 0, marketMode: "normal" };

  const CATEGORY_OPTIONS = [
    ["general", "Обычный товар"], ["arms", "Оружие, доспех или щит"],
    ["magic", "Магический предмет"], ["consumable", "Расходуемый предмет"],
    ["occult", "Оккультный товар или услуга"], ["contraband", "Контрабанда или Трепет"],
    ["disease", "Лечение или устранение болезни"], ["essentials", "Еда и предметы первой необходимости"]
  ];
  const RARITY_OPTIONS = [["common", "обычный"], ["uncommon", "необычный"], ["rare", "редкий"], ["unique", "уникальный"]];
  const DISTRICT_OPTIONS = [["korvosa", "Корвоса (материк)"], ["old-korvosa", "Старая Корвоса"]];
  const MARKET_MODES = {
    normal: { label: "Обычный", icon: "fa-scale-balanced", buy: 1, sell: 0.5, note: "Обычная сделка: полная цена при покупке и половина цены при продаже." },
    demand: { label: "Популярный", icon: "fa-arrow-trend-up", buy: 1.1, sell: 0.6, note: "Высокий спрос: торговец поднимает цену, но и сам платит больше обычного." },
    surplus: { label: "Избыток", icon: "fa-boxes-stacked", buy: 0.9, sell: 0.4, note: "Товара много: его продают со скидкой, но выкупают неохотно." },
    shortage: { label: "Дефицит", icon: "fa-triangle-exclamation", buy: 1.25, sell: 0.75, note: "Редкий найденный экземпляр стоит дороже; желающий продать такой товар получает повышенную цену." }
  };

  const clone = (value) => globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value));
  const optionList = (entries, current) => entries.map(([value, label]) => ({ value, label, selected: value === current }));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function currentPartyLevel() {
    const levels = (game.actors ?? [])
      .filter((actor) => actor?.type === "character" && actor?.hasPlayerOwner)
      .map((actor) => Number(actor?.level ?? actor?.system?.details?.level?.value ?? 0))
      .filter(Number.isFinite);
    return clamp(levels.length ? Math.max(...levels) : 1, 1, 20);
  }

  function priceToCopper(value) {
    if (Number.isFinite(Number(value))) return Math.max(0, Math.round(Number(value) * 100));
    if (!value || typeof value !== "object") return 0;
    return Math.max(0, Math.round(
      Number(value.pp ?? 0) * 1000 + Number(value.gp ?? 0) * 100 + Number(value.sp ?? 0) * 10 + Number(value.cp ?? 0)
    ));
  }

  function formatCoins(copper) {
    let remaining = Math.max(0, Math.round(copper));
    const pp = Math.floor(remaining / 1000); remaining %= 1000;
    const gp = Math.floor(remaining / 100); remaining %= 100;
    const sp = Math.floor(remaining / 10); const cp = remaining % 10;
    const parts = [];
    if (pp) parts.push(`${pp} пм`);
    if (gp) parts.push(`${gp} зм`);
    if (sp) parts.push(`${sp} см`);
    if (cp || !parts.length) parts.push(`${cp} мм`);
    return parts.join(" ");
  }

  function withMarketMode(result, query) {
    const mode = MARKET_MODES[query.marketMode] ?? MARKET_MODES.normal;
    const baseCopper = Math.max(0, Math.round(Number(query.priceGp ?? 0) * 100));
    result.notes ??= [];
    if (query.marketMode !== "normal") result.notes.push(mode.note);
    if (query.marketMode === "shortage" && !["blocked", "conditional"].includes(result.tone)) {
      result.tone = "scarce";
      result.icon = "fa-triangle-exclamation";
      result.title = "Дефицитный товар";
    }
    result.market = {
      label: mode.label,
      tradable: result.tone !== "blocked",
      hasPrice: baseCopper > 0,
      buyPercent: `${Math.round(mode.buy * 100)}%`,
      sellPercent: `${Math.round(mode.sell * 100)}%`,
      buyPrice: formatCoins(baseCopper * mode.buy),
      sellPrice: formatCoins(baseCopper * mode.sell)
    };
    return result;
  }

  function normalizeState(raw) {
    const state = { ...clone(DEFAULT_STATE), ...(raw ?? {}) };
    if (!EVENT_MAP[state.eventId]) state.eventId = DEFAULT_STATE.eventId;
    if (!["korvosa", "bridgefront"].includes(state.locationId)) state.locationId = DEFAULT_STATE.locationId;
    state.version = 3;
    state.bridgefrontUnlocked = state.bridgefrontUnlocked === true;
    state.overrides = state.overrides && typeof state.overrides === "object" ? state.overrides : {};
    state.bridgefrontOverrides = state.bridgefrontOverrides && typeof state.bridgefrontOverrides === "object" ? state.bridgefrontOverrides : {};
    return state;
  }

  function stateVisibleToUser(raw) {
    const state = normalizeState(raw);
    if (!game.user?.isGM && !state.bridgefrontUnlocked) state.locationId = "korvosa";
    return state;
  }

  function currentProfile(state) {
    const isBridgefront = state.locationId === "bridgefront";
    const event = isBridgefront ? clone(BRIDGEFRONT_PROFILE.event) : (EVENT_MAP[state.eventId] ?? EVENTS[0]);
    const base = isBridgefront ? clone(BRIDGEFRONT_PROFILE) : clone(PROFILES[event.profile]);
    const overrides = isBridgefront ? (state.bridgefrontOverrides ?? {}) : (state.overrides ?? {});
    for (const key of ["marketLevel", "reliableLevel", "earnIncomeLevel", "spellRank"]) {
      if (Number.isFinite(Number(overrides[key]))) base[key] = clamp(overrides[key], 0, key === "spellRank" ? 10 : 20);
    }
    if (typeof overrides.specialOrders === "boolean") base.specialOrders = overrides.specialOrders;
    base.oldKorvosaClosed = typeof overrides.oldKorvosaClosed === "boolean" ? overrides.oldKorvosaClosed : (isBridgefront ? true : !!event.oldKorvosaClosed);
    base.reliableLevel = Math.min(base.reliableLevel, base.marketLevel);
    return {
      name: isBridgefront ? "Бриджфронт" : "Корвоса",
      scopeLabel: isBridgefront ? "Район Старой Корвосы" : "Поселение 11",
      locationId: isBridgefront ? "bridgefront" : "korvosa",
      ...base,
      event
    };
  }

  function inferCategory(item) {
    if (["weapon", "armor", "shield"].includes(item?.type)) return "arms";
    const slug = String(item?.slug ?? item?.system?.slug ?? item?.name ?? "").toLowerCase();
    const traits = new Set(item?.system?.traits?.value ?? []);
    if (/shiver|трепет/.test(slug)) return "contraband";
    if (/disease|болез|affliction|недуг|cleanse-affliction/.test(slug)) return "disease";
    if (item?.type === "consumable") return "consumable";
    if (traits.has("occult")) return "occult";
    if (traits.has("magical") || traits.has("arcane") || traits.has("divine") || traits.has("primal")) return "magic";
    return "general";
  }

  function evaluate(query, profile) {
    const level = clamp(query.level, 0, 20);
    const partyLevel = clamp(query.partyLevel, 1, 20);
    const categoryCap = profile.categoryCaps?.[query.category] ?? {};
    const listedMarketLevel = clamp(categoryCap.marketLevel ?? profile.marketLevel, 0, 20);
    const marketLevel = profile.partyLevelCeiling ? Math.min(listedMarketLevel, partyLevel + 1) : listedMarketLevel;
    const reliableLevel = Math.min(clamp(categoryCap.reliableLevel ?? profile.reliableLevel, 0, 20), marketLevel);
    if (!query.name && level === 0) return null;
    const notes = [];
    let tone = "available";
    let title = "Доступен";
    let lead = `Обычный предмет ${level}-го уровня можно купить по указанной цене.`;

    if (["rare", "unique"].includes(query.rarity)) {
      return withMarketMode({ tone: "blocked", icon: "fa-lock", title: "Не находится в открытой продаже", lead: "Редкие и уникальные предметы появляются только по решению мастера или как часть сюжета.", notes: ["Уровень города сам по себе не даёт доступ к такой редкости."] }, query);
    }
    if (profile.locationId !== "bridgefront" && query.district === "old-korvosa" && profile.oldKorvosaClosed) {
      return withMarketMode({ tone: "blocked", icon: "fa-bridge-lock", title: "Рынок отрезан карантином", lead: "Легально купить или доставить товар в Старую Корвосу сейчас нельзя.", notes: ["Контрабанда — отдельная сцена или услуга, а не обычная покупка."] }, query);
    }
    if (query.category === "disease" && !profile.diseaseCare) {
      return withMarketMode({ tone: "blocked", icon: "fa-prescription-bottle-medical", title: "Лечение исчерпано", lead: "Предметы и публичные услуги, способные устранить болезнь, отсутствуют в открытом доступе.", notes: ["Помощь сюжетного союзника или найденный запас не считается рыночной покупкой."] }, query);
    }

    if (level <= reliableLevel) {
      title = "Есть в продаже";
      lead = `Обычный предмет ${level}-го уровня можно найти без отдельной сцены.`;
    } else if (level <= marketLevel) {
      tone = "scarce";
      title = "Дефицитный товар";
      lead = `Предмет входит в предел этого рынка (${marketLevel}), но относится к его редкому верхнему ассортименту.`;
      notes.push("Потребуются 1d4 часа поисков; в наличии обычно один экземпляр или одна партия расходников.");
    } else if (profile.specialOrders && level <= clamp(query.partyLevel, 1, 20)) {
      tone = "order";
      title = "Только спецзаказ";
      lead = `Уровень предмета выше текущего предела рынка (${marketLevel}), но влиятельный персонаж может заказать его под себя.`;
      notes.push(`Срок: ${profile.orderDelay}. Мастер вправе потребовать посредника или задаток.`);
    } else {
      const partyNote = profile.partyLevelCeiling && listedMarketLevel > marketLevel ? ` Для группы ${partyLevel}-го уровня локальный предел сейчас снижен до ${marketLevel}.` : "";
      return withMarketMode({ tone: "blocked", icon: "fa-ban", title: "Сейчас недоступен", lead: `Текущий предел этого рынка — ${marketLevel}-й уровень.${partyNote} Надёжные спецзаказы ${profile.specialOrders ? "не покрывают уровень персонажа" : "не работают"}.`, notes: ["Предмет можно найти как сокровище, получить через союзника или изготовить по правилам Craft."] }, query);
    }

    if (profile.locationId === "bridgefront" && categoryCap.channel) {
      tone = "conditional";
      title = `Через ${categoryCap.channel}`;
      notes.unshift(`Открытая лавка не гарантируется: нужен доступ к ${categoryCap.channel}.`);
    }

    if (query.rarity === "uncommon") {
      tone = "conditional";
      title = "Требуется доступ";
      notes.unshift("Необычный предмет продаётся только персонажу с подходящим Access или с разрешения мастера.");
    }
    if (query.category === "arms" && profile.armsPermit) {
      tone = "conditional";
      title = "Требуется разрешение властей";
      notes.unshift("Без разрешения Серых Дев покупка становится нелегальной и проходит через чёрный рынок.");
    }
    if (query.category === "essentials" && ["anarchy", "plagued"].includes(profile.key)) {
      tone = "scarce";
      title = "Выдаётся ограниченно";
      notes.unshift("Запасы первой необходимости нормируются; крупная закупка привлекает внимание или требует отдельной поставки.");
    }
    if (profile.barter) notes.push("В Бриджфронте часть цены можно отыграть бартером или услугой; денежный эквивалент остаётся тем же.");
    const levelGap = level - partyLevel;
    if (levelGap >= 2) {
      tone = "conditional";
      title = "Доступен городу, но слишком силён для группы";
      notes.unshift(`Предмет на ${levelGap} ур. выше покупателя. Такая покупка возможна, но может нарушить ожидаемую прогрессию сокровищ; требуется отдельное решение мастера.`);
    } else if (levelGap === 1) {
      notes.unshift("Предмет на 1 уровень выше покупателя: это допустимо, но его стоит учитывать в сокровищах и бюджете ближайшего уровня.");
    }
    return withMarketMode({ tone, icon: tone === "available" ? "fa-circle-check" : tone === "scarce" ? "fa-hourglass-half" : tone === "order" ? "fa-truck-fast" : "fa-key", title, lead, notes }, query);
  }

  async function droppedItem(event) {
    const nativeEvent = event?.originalEvent ?? event;
    let data;
    try {
      data = globalThis.TextEditor?.getDragEventData?.(nativeEvent) ?? JSON.parse(nativeEvent?.dataTransfer?.getData("text/plain") || "{}");
    } catch (_error) { return null; }
    const document = data?.uuid ? await globalThis.fromUuid?.(data.uuid) : null;
    return document?.documentName === "Item" ? document : null;
  }

  function groupEvents(selectedId) {
    const groups = [];
    for (const event of EVENTS) {
      let group = groups.at(-1);
      if (!group || group.label !== event.group) groups.push(group = { label: event.group, options: [] });
      group.options.push({ value: event.id, label: event.label, selected: event.id === selectedId });
    }
    return groups;
  }

  function publicChat(profile) {
    const closed = profile.locationId === "korvosa" && profile.oldKorvosaClosed ? "<p><strong>Старая Корвоса:</strong> рынок отрезан.</p>" : "";
    const local = profile.locationId === "bridgefront" ? "<p><strong>Особые каналы:</strong> оккультные товары, лекарства и контрабанда проверяются отдельно. Возможен бартер.</p>" : "";
    return `<div class="ct-korvosa-chat"><h3>${profile.name} · ${profile.label}</h3><p>${profile.event.public}</p><p><strong>Рынок:</strong> до ${profile.marketLevel}-го уровня; без поисков — до ${profile.reliableLevel}-го. <strong>Услуги:</strong> заклинания до ${profile.spellRank}-го ранга. <strong>Заработок:</strong> задачи до ${profile.earnIncomeLevel}-го уровня.</p>${closed}${local}<p><em>Базовая цена задаёт денежный эквивалент; обстановка меняет наличие, сроки, способ оплаты и легальность сделки.</em></p></div>`;
  }

  class KorvosaSettlementApp extends BaseApplication {
    constructor(options = {}) {
      super(options);
      this.query = { ...clone(DEFAULT_QUERY), partyLevel: currentPartyLevel() };
      this.locationId = null;
    }

    static get DEFAULT_OPTIONS() {
      const options = CT.v2Options({ id: "ct-korvosa-settlement", title: "Рынки Корвосы", classes: ["ct-korvosa-settlement-app", "sheet"], width: 940, height: 820 });
      options.window.controls = [{ action: "showPlayers", icon: "fa-solid fa-users-viewfinder", label: "Показать игрокам", visible: !!game.user?.isGM }];
      options.actions = { showPlayers() { showToPlayers(); } };
      return options;
    }
    static get PARTS() { return CT.singleTemplatePart(TEMPLATE); }
    static get defaultOptions() {
      return CT.v1Options(super.defaultOptions, { id: "ct-korvosa-settlement", title: "Рынки Корвосы", template: TEMPLATE, classes: ["ct-korvosa-settlement-app", "sheet"], width: 940, height: 820, resizable: true });
    }
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons?.() ?? [];
      if (game.user?.isGM) buttons.unshift({ label: "Показать игрокам", class: "ks-show-players", icon: "fas fa-users", onclick: showToPlayers });
      return buttons;
    }
    async _prepareContext(options) { return this.getData(options); }
    async _onRender(context, options) {
      await super._onRender?.(context, options);
      this.activateListeners(CT.asHtml(CT.part(this, ".ks-shell")));
    }
    getData() {
      const state = stateVisibleToUser(game.settings.get(MOD, SETTING));
      const canSeeBridgefront = !!game.user?.isGM || state.bridgefrontUnlocked;
      if (this.locationId === "bridgefront" && !canSeeBridgefront) this.locationId = null;
      if (this.locationId) state.locationId = this.locationId;
      const profile = currentProfile(state);
      const isBridgefront = state.locationId === "bridgefront";
      const overrides = isBridgefront ? (state.bridgefrontOverrides ?? {}) : (state.overrides ?? {});
      const displayEvent = game.user?.isGM ? profile.event : { public: profile.event.public };
      return {
        isGM: !!game.user?.isGM,
        isKorvosa: !isBridgefront,
        isBridgefront,
        canSeeBridgefront,
        state,
        profile: {
          ...profile,
          event: displayEvent,
          qualities: profile.qualities.map(([icon, title, text]) => ({ icon, title, text })),
          ordersLabel: profile.specialOrders ? "доступны" : "закрыты",
          oldKorvosaLabel: profile.oldKorvosaClosed ? "отрезана" : "доступна"
        },
        eventGroups: game.user?.isGM ? groupEvents(state.eventId) : [],
        hasOverrides: Object.keys(overrides).length > 0,
        query: this.query,
        rarityOptions: optionList(RARITY_OPTIONS, this.query.rarity),
        categoryOptions: optionList(CATEGORY_OPTIONS, this.query.category),
        districtOptions: optionList(DISTRICT_OPTIONS, this.query.district),
        marketModes: Object.entries(MARKET_MODES).map(([value, mode]) => ({ value, ...mode, selected: value === this.query.marketMode })),
        result: evaluate(this.query, profile)
      };
    }
    activateListeners(html) {
      super.activateListeners?.(html);
      const root = html?.jquery ? html[0] : html?.[0] ?? html;
      if (root?.dataset?.ksBound === "true") return;
      if (root?.dataset) root.dataset.ksBound = "true";

      html.on("change", ".ks-event-select", async (event) => {
        if (!game.user?.isGM) return;
        const state = normalizeState(game.settings.get(MOD, SETTING));
        state.eventId = event.currentTarget.value;
        state.overrides = {};
        await game.settings.set(MOD, SETTING, state);
      });
      html.on("click", ".ks-location-tab", async (event) => {
        const locationId = event.currentTarget.dataset.location;
        if (!["korvosa", "bridgefront"].includes(locationId)) return;
        const state = normalizeState(game.settings.get(MOD, SETTING));
        if (locationId === "bridgefront" && !game.user?.isGM && !state.bridgefrontUnlocked) return;
        this.locationId = locationId;
        state.locationId = locationId;
        this.query.district = locationId === "bridgefront" ? "bridgefront" : "korvosa";
        if (game.user?.isGM && normalizeState(game.settings.get(MOD, SETTING)).locationId !== locationId) await game.settings.set(MOD, SETTING, state);
        else this.render();
      });
      html.on("change", ".ks-bridgefront-visibility", async (event) => {
        if (!game.user?.isGM) return;
        const state = normalizeState(game.settings.get(MOD, SETTING));
        state.bridgefrontUnlocked = !!event.currentTarget.checked;
        await game.settings.set(MOD, SETTING, state);
      });
      html.on("change", ".ks-override", async (event) => {
        if (!game.user?.isGM) return;
        const state = normalizeState(game.settings.get(MOD, SETTING));
        const input = event.currentTarget;
        const key = input.dataset.key;
        const overrideKey = state.locationId === "bridgefront" ? "bridgefrontOverrides" : "overrides";
        state[overrideKey][key] = input.type === "checkbox" ? !!input.checked : clamp(input.value, 0, key === "spellRank" ? 10 : 20);
        await game.settings.set(MOD, SETTING, state);
      });
      html.on("click", ".ks-reset-overrides", async () => {
        if (!game.user?.isGM) return;
        const state = normalizeState(game.settings.get(MOD, SETTING));
        if (state.locationId === "bridgefront") state.bridgefrontOverrides = {};
        else state.overrides = {};
        await game.settings.set(MOD, SETTING, state);
      });
      html.on("change", ".ks-query-field", (event) => {
        const input = event.currentTarget;
        const key = input.dataset.key;
        if (["level", "partyLevel"].includes(key)) this.query[key] = clamp(input.value, key === "partyLevel" ? 1 : 0, 20);
        else if (key === "priceGp") this.query[key] = Math.max(0, Number(input.value) || 0);
        else this.query[key] = input.value;
        this.render();
      });
      html.on("dragover", ".ks-dropzone", (event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragover"); });
      html.on("dragleave", ".ks-dropzone", (event) => event.currentTarget.classList.remove("is-dragover"));
      html.on("drop", ".ks-dropzone", async (event) => {
        event.preventDefault();
        event.currentTarget.classList.remove("is-dragover");
        const item = await droppedItem(event);
        if (!item) return ui.notifications?.warn?.("Перетащите сюда предмет из листа или библиотеки.");
        this.query = {
          ...this.query,
          name: item.name,
          img: item.img,
          level: clamp(item.system?.level?.value, 0, 20),
          rarity: item.system?.traits?.rarity ?? "common",
          category: inferCategory(item),
          priceGp: priceToCopper(item.system?.price?.value) / 100
        };
        this.render();
      });
      html.on("click", ".ks-clear-item", () => { this.query = { ...clone(DEFAULT_QUERY), partyLevel: currentPartyLevel() }; this.render(); });
      html.on("click", ".ks-sync-party-level", () => { this.query.partyLevel = currentPartyLevel(); this.render(); });
      html.on("click", ".ks-post-chat", () => {
        if (!game.user?.isGM) return;
        ChatMessage.create({ content: publicChat(currentProfile(normalizeState(game.settings.get(MOD, SETTING)))), speaker: ChatMessage.getSpeaker() });
      });
      html.on("click", ".ks-show-players", showToPlayers);
    }
  }

  let app;
  function openKorvosaSettlement() {
    if (!app) app = new KorvosaSettlementApp();
    app.render(true, { focus: true });
    return app;
  }
  function showToPlayers() {
    if (!game.user?.isGM) return;
    const state = normalizeState(game.settings.get(MOD, SETTING));
    if (state.locationId === "bridgefront" && !state.bridgefrontUnlocked) {
      ui.notifications?.warn?.("Сначала включите «Показывать вкладку Бриджфронта игрокам».");
      return;
    }
    game.socket?.emit?.(SOCKET, { type: "korvosa-settlement-open", userId: game.user.id });
    ui.notifications?.info?.("Текущий профиль рынка открыт у активных игроков.");
  }
  function registerSettings() {
    if (game.settings.settings.has(`${MOD}.${SETTING}`)) return;
    game.settings.register(MOD, SETTING, { name: "Korvosa settlement state", scope: "world", config: false, type: Object, default: clone(DEFAULT_STATE) });
  }
  function setupRuntime() {
    game.socket?.on?.(SOCKET, (payload) => {
      if (payload?.type !== "korvosa-settlement-open") return;
      const sender = game.users.get(payload.userId);
      if (!game.user?.isGM && sender?.isGM) openKorvosaSettlement();
    });
    const mod = game.modules.get(MOD);
    if (mod) {
      mod.api = mod.api || {};
      mod.api.openKorvosaSettlement = openKorvosaSettlement;
      mod.api.showKorvosaSettlementToPlayers = showToPlayers;
      mod.api.getKorvosaSettlementProfile = () => currentProfile(stateVisibleToUser(game.settings.get(MOD, SETTING)));
      mod.api.evaluateKorvosaMarket = (query = {}) => evaluate({ ...clone(DEFAULT_QUERY), ...query }, currentProfile(stateVisibleToUser(game.settings.get(MOD, SETTING))));
    }
  }

  if (game.ready) { registerSettings(); setupRuntime(); }
  else { Hooks.once("init", registerSettings); Hooks.once("ready", setupRuntime); }

  Hooks.on("getSceneControlButtons", (controls) => {
    const tool = { name: "ct-korvosa-settlement", title: "Состояние Корвосы", icon: "fas fa-city", button: true, order: 91, onClick: openKorvosaSettlement, onChange: () => openKorvosaSettlement() };
    if (Array.isArray(controls)) {
      const tokenControls = controls.find((control) => control.name === "token" || control.name === "tokens");
      if (tokenControls?.tools && !tokenControls.tools.some((entry) => entry.name === tool.name)) tokenControls.tools.push(tool);
      return;
    }
    const tokenControls = controls?.tokens ?? controls?.token;
    if (!tokenControls?.tools) return;
    if (Array.isArray(tokenControls.tools)) {
      if (!tokenControls.tools.some((entry) => entry.name === tool.name)) tokenControls.tools.push(tool);
    } else tokenControls.tools[tool.name] = tool;
  });
  Hooks.on("updateSetting", (setting) => { if (setting?.key === `${MOD}.${SETTING}` && app?.rendered) app.render(); });
})();
