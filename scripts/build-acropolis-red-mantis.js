const fs = require("fs");
const path = require("path");
const { ClassicLevel } = require("classic-level");

const [
  sourcePath,
  spellPackPath,
  equipmentPackPath,
  spellTranslationPath,
  equipmentTranslationPath,
  outputDirectory,
] = process.argv.slice(2);

if (
  ![
    sourcePath,
    spellPackPath,
    equipmentPackPath,
    spellTranslationPath,
    equipmentTranslationPath,
    outputDirectory,
  ].every(Boolean)
) {
  throw new Error("Missing input or output path.");
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const spellTranslations = JSON.parse(fs.readFileSync(spellTranslationPath, "utf8")).entries;
const equipmentTranslations = JSON.parse(fs.readFileSync(equipmentTranslationPath, "utf8")).entries;

const publication = {
  title: "Проклятие Багряного Трона — конверсия PF2e Remaster",
  authors: "xr0mi",
  license: "ORC",
  remaster: true,
};

function setPath(object, dottedPath, value) {
  const parts = dottedPath.split(".");
  const last = parts.pop();
  let cursor = object;
  for (const part of parts) {
    cursor[part] ??= {};
    cursor = cursor[part];
  }
  cursor[last] = value;
}

function applyTranslation(item, entry) {
  if (!entry) return item;
  item.name = (entry.name || item.name).replace(/\(\*\)$/, "").trim();
  if (entry.description) item.system.description.value = entry.description;

  const mappings = {
    requirements: "system.requirements",
    range: "system.range.value",
    target: "system.target.value",
    duration: "system.duration.value",
    cost: "system.cost.value",
    time: "system.time.value",
  };
  for (const [key, destination] of Object.entries(mappings)) {
    if (entry[key] !== undefined) setPath(item, destination, entry[key]);
  }

  return item;
}

function actionItem({ id, name, img, actionType = "action", actions = 1, traits = [], description }) {
  return {
    _id: id,
    name,
    type: "action",
    img,
    system: {
      description: { value: description, gm: "" },
      traits: { value: traits, otherTags: [] },
      rules: [],
      slug: null,
      actionType: { value: actionType },
      actions: { value: actions },
      deathNote: false,
      publication: clone(publication),
      _migration: { version: 0.959, previous: null },
      category: null,
    },
    effects: [],
    folder: null,
    sort: 0,
    flags: {},
    ownership: { default: 0 },
  };
}

function effectItem({ id, name, img, duration, rules, description = "" }) {
  return {
    _id: id,
    name,
    type: "effect",
    img,
    system: {
      description: { value: description, gm: "" },
      publication: clone(publication),
      rules,
      slug: null,
      traits: { otherTags: [], value: [] },
      level: { value: 1 },
      duration,
      tokenIcon: { show: true },
      unidentified: false,
      start: { value: 0, initiative: null },
      badge: null,
      fromSpell: false,
      context: null,
      _migration: { version: 0.959, previous: null },
    },
    effects: [],
    folder: null,
    sort: 0,
    flags: {},
    ownership: { default: 0 },
  };
}

async function loadDocuments(packPath, names) {
  const documents = new Map();
  const db = new ClassicLevel(packPath, { valueEncoding: "utf8", readOnly: true });
  await db.open();
  for await (const [, value] of db.iterator()) {
    try {
      const document = JSON.parse(value);
      if (names.includes(document.name)) documents.set(document.name, document);
    } catch {
      // Ignore folder and metadata records.
    }
  }
  await db.close();

  const missing = names.filter((name) => !documents.has(name));
  if (missing.length) throw new Error(`Missing compendium documents: ${missing.join(", ")}`);
  return documents;
}

function cleanRetainedItems(actor) {
  const removedTypes = new Set(["spell"]);
  actor.items = actor.items.filter(
    (item) =>
      !removedTypes.has(item.type) &&
      item.type !== "spellcastingEntry" &&
      item.name !== "Призрачный звук" &&
      item.name !== "Верный удар",
  );

  for (const item of actor.items) {
    item.folder = null;
    item.ownership = { default: 0 };
    if (item.system?.publication) item.system.publication = clone(publication);
    if (item.type === "effect") item.system.context = null;
  }

  actor.items = actor.items.filter(
    (item) =>
      !(
        item.type === "equipment" &&
        item.system?.slug !== "mask-of-the-mantis" &&
        /маска богомола/i.test(item.name)
      ),
  );
}

function updateSharedActor(actor, role) {
  actor.system.details.level.value = 9;
  actor.system.details.publication = clone(publication);
  actor.system.details.languages.value = ["common"];
  actor.system.traits.value = ["human", "humanoid"];
  actor.system.traits.rarity = "uncommon";
  actor.system.attributes.ac.value = 28;
  actor.system.attributes.ac.details = "";
  actor.system.attributes.speed.value = 30;
  actor.system.perception.mod = role === "observer" ? 21 : 19;

  actor.flags ??= {};
  actor.flags["crimson-throne-xr0mi"] = {
    conversion: "PF2e Remaster",
    encounter: "Acropolis of the Thrallkeepers",
    role,
    observationGoal: 3,
  };

  cleanRetainedItems(actor);

  const mistAction = actor.items.find((item) => item.type === "action" && item.name === "Багровый туман");
  mistAction.system.description.value =
    "<p><strong>Частота</strong> раз в день.</p><p>Убийца окутывает себя завесой алого тумана на 1 минуту и получает быстрое исцеление 4. Пока туман действует, убийца может использовать действие <em>Закрутить туман</em>. Если убийца погибает, пока действует туман, он может рассеять своё тело алой дымкой, оставив только снаряжение.</p><p><strong>Foundry.</strong> Добавьте на убийцу эффект <em>Багровый туман</em>.</p>";
  mistAction.system.traits.value = ["concentrate", "divine"];

  const crimsonGaze = actor.items.find((item) => item.type === "action" && item.name === "Багровый взгляд");
  crimsonGaze.system.description.value =
    "<p>Красный Богомол невосприимчив к визуальным эффектам иллюзий, созданным другими Красными Богомолами и их союзниками.</p>";

  const sneakAttack = actor.items.find((item) => item.type === "action" && item.name === "Внезапная атака");
  sneakAttack.system.description.value =
    "<p>Удары убийцы наносят дополнительные 2d6 точного урона существам, @UUID[Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg]{застигнутым врасплох} для него.</p>";

  const denyAdvantage = actor.items.find(
    (item) => item.type === "action" && item.name === "Лишить преимущества",
  );
  denyAdvantage.system.description.value =
    "<p>Красный Богомол не становится застигнут врасплох для скрытых, необнаруженных или берущих его в тиски существ 9-го уровня или ниже, а также для таких существ, использующих Неожиданную атаку.</p>";

  const prayerAttack = actor.items.find(
    (item) => item.type === "action" && item.name === "Молитвенный выпад",
  );
  prayerAttack.system.description.value =
    "<p><strong>Требования</strong> Убийца держит по зазубренной сабле в каждой руке.</p><p><strong>Эффект</strong> Убийца совершает @UUID[Compendium.pf2e.actionspf2e.Item.QNAVeNKtHA0EUw4X]{Финт} против врага в пределах 30 футов. При успехе следующий успешный Удар зазубренной саблей, нанесённый в этот ход, причиняет цели 1d6 продолжительного урона кровотечением. Пока убийца остаётся видимым для цели и находится в пределах 30 футов, последующие Молитвенные выпады против неё автоматически делают её застигнутой врасплох для его атак до конца хода.</p>";

  const swirlMist = actor.items.find((item) => item.type === "action" && item.name === "Закрутить туман");
  swirlMist.system.description.value =
    "<p><strong>Требования</strong> На убийцу действует Багровый туман.</p><p>Убийца закручивает туман вокруг себя и получает бонус обстоятельства +1 к КБ до начала своего следующего хода.</p><p><strong>Foundry.</strong> Добавьте эффект <em>Закрученный багровый туман</em>.</p>";
  swirlMist.system.traits.value = ["concentrate"];
  swirlMist.img = "systems/pf2e/icons/actions/OneAction.webp";

  const mistEffect = actor.items.find((item) => item.type === "effect" && item.name === "Багровый туман");
  mistEffect.system.publication = clone(publication);
  mistEffect.system.description.value = "<p>Быстрое исцеление 4 на 1 минуту.</p>";
  mistEffect.system.context = null;
  mistEffect.folder = null;
  mistEffect.ownership = { default: 0 };

  actor.items.push(
    effectItem({
      id: "CtMantisMistAC01",
      name: "Закрученный багровый туман",
      img: "icons/magic/air/fog-gas-smoke-orange.webp",
      duration: { value: 1, unit: "rounds", expiry: "turn-start", sustained: false },
      rules: [{ key: "FlatModifier", selector: "ac", type: "circumstance", value: 1 }],
      description: "<p>Бонус обстоятельства +1 к КБ до начала следующего хода.</p>",
    }),
    actionItem({
      id: "CtMantisRetreat1",
      name: "Багровое отступление",
      img: "systems/pf2e/icons/actions/TwoActions.webp",
      actions: 2,
      traits: ["illusion", "move", "occult"],
      description:
        "<p><strong>Частота</strong> раз за столкновение.</p><p>Красный Богомол становится невидимым, а затем дважды Перемещается. Невидимость заканчивается в конце текущего хода или сразу после совершения враждебного действия.</p>",
    }),
  );
}

function replaceEquipment(actor, equipmentDocuments) {
  actor.items = actor.items.filter(
    (item) => !(item.type === "equipment" && /маска богомола/i.test(item.name)),
  );

  const mask = clone(equipmentDocuments.get("Mask of the Mantis"));
  applyTranslation(mask, equipmentTranslations["Mask of the Mantis"]);
  mask.name = mask.name.replace(/\(\*\)$/, "").trim();
  mask.folder = null;
  mask.sort = 0;
  mask.ownership = { default: 0 };
  actor.items.push(mask);

  const saber = actor.items.find((item) => item.type === "weapon" && item.system.slug === "sawtooth-saber");
  saber.name = "Зазубренная сабля +1 (разящая)";
  saber.system.description.value = equipmentTranslations["Sawtooth Saber"].description;
  saber.system.level.value = 4;
  saber.system.quantity = 2;
  saber.system.price.value = { gp: 100 };
  saber.system.runes.potency = 1;
  saber.system.runes.striking = 1;
  saber.system.traits.value = ["agile", "finesse", "magical", "twin"];
  saber.system.publication = clone(publication);
}

function makeSpellcasting(actor, spellDocuments, role) {
  const entryId = role === "observer" ? "CtMantisObsSpell" : "CtMantisBladeSpl";
  const entry = clone(source.items.find((item) => item.type === "spellcastingEntry"));
  entry._id = entryId;
  entry.name = "Подготовленные оккультные заклинания";
  entry.system.ability.value = "cha";
  entry.system.tradition.value = "occult";
  entry.system.spelldc.value = 19;
  entry.system.spelldc.dc = 27;
  entry.system.autoHeightenLevel.value = 5;
  entry.system.publication = clone(publication);
  entry.folder = null;
  entry.ownership = { default: 0 };

  for (let rank = 0; rank <= 11; rank += 1) {
    entry.system.slots[`slot${rank}`] = { prepared: [], value: 0, max: 0 };
  }

  const spells = [];
  const addSpell = (englishName, rank, heightenedLevel = null) => {
    const spell = clone(spellDocuments.get(englishName));
    applyTranslation(spell, spellTranslations[englishName]);
    spell.name = spell.name.replace(/\(\*\)$/, "").trim();
    spell.system.location = { value: entryId };
    if (heightenedLevel) {
      spell.system.location.heightenedLevel = heightenedLevel;
      if (heightenedLevel !== spell.system.level.value) spell.name += ` (${heightenedLevel}-й ранг)`;
    }
    spell.folder = null;
    spell.sort = 0;
    spell.ownership = { default: 0 };
    spells.push(spell);
    entry.system.slots[`slot${rank}`].prepared.push({ id: spell._id, expended: false });
    entry.system.slots[`slot${rank}`].max += 1;
  };

  addSpell("Message", 0);
  addSpell("Figment", 0);
  addSpell("Sure Strike", 1);

  if (role === "observer") {
    addSpell("Fleet Step", 1);
    addSpell("Hypnotize", 3);
    addSpell("Invisibility", 4, 4);
  }

  actor.items.push(entry, ...spells);
}

function updateStrikes(actor, role) {
  const saberStrike = actor.items.find(
    (item) => item.type === "melee" && item.name === "Зазубренная сабля",
  );
  saberStrike.name = "Зазубренная сабля +1 (разящая)";
  saberStrike.system.slug = "sawtooth-saber";
  saberStrike.system.traits.value = ["agile", "finesse", "magical", "twin"];
  saberStrike.system.bonus.value = role === "blade" ? 22 : 21;
  saberStrike.system.damageRolls[Object.keys(saberStrike.system.damageRolls)[0]].damage =
    role === "blade" ? "2d6+10" : "2d6+8";
  saberStrike.system.publication = clone(publication);

  const daggerStrikes = actor.items.filter((item) => item.type === "melee" && item.name === "Кинжал");
  const meleeDagger = daggerStrikes.find((item) => !item.system.traits.value.includes("thrown-10"));
  const thrownDagger = daggerStrikes.find((item) => item.system.traits.value.includes("thrown-10"));

  meleeDagger.name = "Кинжал (ближний бой)";
  meleeDagger.system.bonus.value = role === "blade" ? 21 : 22;
  meleeDagger.system.damageRolls[Object.keys(meleeDagger.system.damageRolls)[0]].damage =
    role === "blade" ? "2d4+8" : "2d4+8";
  meleeDagger.system.publication = clone(publication);

  thrownDagger.name = "Кинжал (дистанционный)";
  thrownDagger.system.bonus.value = role === "blade" ? 20 : 22;
  thrownDagger.system.damageRolls[Object.keys(thrownDagger.system.damageRolls)[0]].damage =
    role === "blade" ? "2d4+6" : "2d4+8";
  thrownDagger.system.publication = clone(publication);
}

function buildBlade(spellDocuments, equipmentDocuments) {
  const actor = clone(source);
  actor.name = "Багровый клинок Красных Богомолов";
  actor.prototypeToken.name = actor.name;
  updateSharedActor(actor, "blade");
  actor.system.attributes.hp.value = 150;
  actor.system.attributes.hp.max = 150;
  actor.system.saves.fortitude.value = 18;
  actor.system.saves.reflex.value = 21;
  actor.system.saves.will.value = 17;
  actor.system.skills.acrobatics.base = 20;
  actor.system.skills.athletics.base = 18;
  actor.system.skills.deception.base = 18;
  actor.system.skills.intimidation.base = 17;
  actor.system.skills.religion.base = 16;
  actor.system.skills.society.base = 16;
  actor.system.skills.stealth.base = 21;
  actor.system.skills.thievery.base = 18;
  actor.system.details.blurb =
    "Ветеран Красных Богомолов, удерживающий героев в бою, пока наблюдатели изучают их способности.";
  actor.system.details.publicNotes =
    "<p>Багровые клинки действуют парами, создают фланги и прикрывают наблюдателей Киновари.</p>";
  actor.system.details.privateNotes =
    "<p><strong>Поведение в бою.</strong> Клинок активирует Багровый туман, сближается с выбранной целью и использует Молитвенный выпад. Он старается оставаться рядом с другим Богомолом ради Синхронного рассечения.</p><p><strong>Мораль.</strong> После получения 3 Очков наблюдения, поражения двух убийц или снижения двух убийц до половины ОЗ ячейка начинает организованное отступление.</p>";

  replaceEquipment(actor, equipmentDocuments);
  makeSpellcasting(actor, spellDocuments, "blade");
  updateStrikes(actor, "blade");

  actor.items.push(
    actionItem({
      id: "CtMantisRedShift",
      name: "Красная смена",
      img: "systems/pf2e/icons/actions/Reaction.webp",
      actionType: "reaction",
      actions: null,
      traits: ["move"],
      description:
        "<p><strong>Триггер</strong> Союзный Красный Богомол в пределах 15 футов завершает действие с признаком «движение».</p><p><strong>Эффект</strong> Багровый клинок делает Шаг. Если он завершает его рядом с вызвавшим реакцию союзником, они могут поменяться местами.</p>",
    }),
    actionItem({
      id: "CtMantisSyncCut1",
      name: "Синхронное рассечение",
      img: "systems/pf2e/icons/actions/TwoActions.webp",
      actions: 2,
      traits: ["attack", "flourish"],
      description:
        "<p><strong>Требования</strong> Цель находится в досягаемости багрового клинка и другого Красного Богомола.</p><p><strong>Эффект</strong> Клинок совершает Удар зазубренной саблей. При попадании один находящийся рядом с целью Красный Богомол может реакцией совершить по ней Удар зазубренной саблей. Этот Удар использует и увеличивает его собственный штраф за несколько атак.</p>",
    }),
  );

  return actor;
}

function buildObserver(spellDocuments, equipmentDocuments) {
  const actor = clone(source);
  actor.name = "Наблюдатель Киновари";
  actor.prototypeToken.name = actor.name;
  updateSharedActor(actor, "observer");
  actor.system.attributes.hp.value = 135;
  actor.system.attributes.hp.max = 135;
  actor.system.saves.fortitude.value = 16;
  actor.system.saves.reflex.value = 21;
  actor.system.saves.will.value = 19;
  actor.system.skills.acrobatics.base = 20;
  actor.system.skills.athletics.base = 16;
  actor.system.skills.deception.base = 20;
  actor.system.skills.intimidation.base = 16;
  actor.system.skills.religion.base = 17;
  actor.system.skills.society.base = 18;
  actor.system.skills.stealth.base = 22;
  actor.system.skills.thievery.base = 20;
  actor.system.details.blurb =
    "Разведчик Красных Богомолов, заставляющий противников раскрывать приёмы под наблюдением Корианту.";
  actor.system.details.publicNotes =
    "<p>Наблюдатели Киновари держатся позади багровых клинков, отмечают способности героев и мешают им действовать привычным образом.</p>";
  actor.system.details.privateNotes =
    "<p><strong>Очки наблюдения.</strong> Ячейке требуется 3 Очка наблюдения. Не чаще раза за раунд наблюдатель может зафиксировать героя, который потратил Очко Фокусировки, применил заклинание 5-го ранга или выше, использовал реакцию, раскрыл ограниченную способность либо нанёс не менее 40 урона одной активностью.</p><p><strong>Поведение в бою.</strong> Наблюдатель начинает под Невидимостью, использует Гипноз для разделения группы и держится в пределах 30 футов ради Проверки реакции.</p><p><strong>Мораль.</strong> Получив 3 Очка наблюдения, потеряв двух убийц или увидев двух союзников с половиной ОЗ, ячейка начинает организованное отступление.</p>";

  replaceEquipment(actor, equipmentDocuments);
  makeSpellcasting(actor, spellDocuments, "observer");
  updateStrikes(actor, "observer");

  actor.items.push(
    actionItem({
      id: "CtMantisProbeRx1",
      name: "Проверка реакции",
      img: "systems/pf2e/icons/actions/Reaction.webp",
      actionType: "reaction",
      actions: null,
      traits: ["attack"],
      description:
        "<p><strong>Триггер</strong> Видимое существо в пределах 30 футов использует действие с признаком «воздействие» или «концентрация» либо начинает Сотворять заклинание.</p><p><strong>Эффект</strong> Наблюдатель совершает по существу дистанционный Удар кинжалом. Этот Удар не может прервать вызвавшее его действие. При попадании цель застигнута врасплох для наблюдателя до конца его следующего хода.</p><p><strong>Особое</strong> На одно вызвавшее действие может отреагировать только один наблюдатель Киновари.</p>",
    }),
    actionItem({
      id: "CtMantisObserve1",
      name: "Зафиксировать приём",
      img: "systems/pf2e/icons/actions/OneAction.webp",
      actions: 1,
      traits: ["concentrate", "visual"],
      description:
        "<p><strong>Частота</strong> раз за раунд для всей ячейки.</p><p><strong>Требования</strong> Наблюдатель видит героя, который после окончания его прошлого хода потратил Очко Фокусировки, сотворил заклинание 5-го ранга или выше, использовал значимую реакцию или ограниченную способность либо нанёс не менее 40 урона одной активностью.</p><p><strong>Эффект</strong> Ячейка получает 1 Очко наблюдения. После получения третьего очка Корианту видела достаточно: в начале следующего хода убийцы подают сигнал к отступлению.</p>",
    }),
  );

  return actor;
}

async function main() {
  const spellNames = ["Hypnotize", "Invisibility", "Fleet Step", "Message", "Figment", "Sure Strike"];
  const equipmentNames = ["Mask of the Mantis"];
  const spellDocuments = await loadDocuments(spellPackPath, spellNames);
  const equipmentDocuments = await loadDocuments(equipmentPackPath, equipmentNames);

  const blade = buildBlade(spellDocuments, equipmentDocuments);
  const observer = buildObserver(spellDocuments, equipmentDocuments);

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, "red-mantis-crimson-blade-level-9.actor.json"),
    `${JSON.stringify(blade, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outputDirectory, "cinnabar-observer-level-9.actor.json"),
    `${JSON.stringify(observer, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
