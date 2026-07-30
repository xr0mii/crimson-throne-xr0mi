const fs = require("fs");
const path = require("path");

const [sourcePath, outputDirectory] = process.argv.slice(2);
if (!sourcePath || !outputDirectory) throw new Error("Expected source actor and output directory.");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const publication = {
  title: "Проклятие Багряного Трона — конверсия PF2e Remaster",
  authors: "xr0mi",
  license: "ORC",
  remaster: true,
};

function actionItem({
  id,
  name,
  img,
  slug = null,
  actionType = "passive",
  actions = null,
  traits = [],
  description,
}) {
  return {
    _id: id,
    name,
    type: "action",
    img,
    system: {
      description: { value: description, gm: "" },
      traits: { value: traits, otherTags: [] },
      rules: [],
      slug,
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

function meleeItem({
  id,
  name,
  bonus,
  traits,
  damage,
  damageType,
  extraDamage = null,
  extraDamageType = null,
  attackEffects = [],
}) {
  const damageRolls = {
    CtDamageMain0001: { damage, damageType, category: null },
  };
  if (extraDamage) {
    damageRolls.CtDamageExtra001 = {
      damage: extraDamage,
      damageType: extraDamageType,
      category: "persistent",
    };
  }

  return {
    _id: id,
    name,
    type: "melee",
    img: "systems/pf2e/icons/default-icons/melee.svg",
    system: {
      description: { value: "", gm: "" },
      traits: { value: traits, otherTags: [], config: {} },
      rules: [],
      slug: null,
      damageRolls,
      bonus: { value: bonus },
      attackEffects: { value: attackEffects },
      publication: clone(publication),
      _migration: { version: 0.959, previous: null },
      action: "strike",
      area: null,
      range: null,
      subjectToMAP: true,
    },
    effects: [],
    folder: null,
    sort: 0,
    flags: {},
    ownership: { default: 0 },
  };
}

function commonActorCleanup(actor) {
  actor.folder = null;
  actor.ownership = { default: 0 };
  actor.system.details.publication = clone(publication);
  actor.system.traits.value = ["aberration"];
  actor.system.traits.rarity = "rare";
  actor.system.details.languages.value = [];
  actor.system.details.languages.details = "";
  actor.flags ??= {};
  actor.flags["crimson-throne-xr0mi"] = {
    conversion: "PF2e Remaster",
    source: "Curse of the Crimson Throne — Havero",
  };
}

function buildTentacle() {
  const actor = clone(source);
  actor._id = "CtHaveroTent0001";
  actor.name = "Щупальце хаверо";
  actor.prototypeToken.name = actor.name;
  commonActorCleanup(actor);

  actor.system.details.level.value = 10;
  actor.system.details.blurb =
    "Отдалённый придаток космического хаверо, проникший через пространственную границу.";
  actor.system.details.publicNotes =
    "<p>Уничтожение щупальца не причиняет хаверо серьёзного вреда, но заставляет придаток втянуться и уменьшает накопленные Очки шума.</p>";
  actor.system.details.privateNotes =
    "<p><strong>Поведение в бою.</strong> Щупальце использует Исследующий взмах, выбирая ближайшее ощущаемое существо. После попадания оно Захватывает цель и на следующем ходу Сдавливает её.</p><p><strong>Мораль.</strong> При 0 ОЗ щупальце втягивается в бассейн. Оно не погибает отдельно от хаверо.</p>";

  actor.system.attributes.hp.value = 170;
  actor.system.attributes.hp.max = 170;
  actor.system.attributes.hp.details = "";
  actor.system.attributes.ac.value = 30;
  actor.system.attributes.ac.details = "";
  actor.system.attributes.speed.value = 0;
  actor.system.attributes.speed.otherSpeeds = [];
  actor.system.attributes.speed.details = "Неподвижно; кончик перемещается только Исследующим взмахом";
  actor.system.attributes.immunities = [
    { type: "cold" },
    { type: "mental" },
    { type: "poison" },
    { type: "visual" },
  ];
  actor.system.attributes.resistances = [
    { type: "acid", value: 10 },
    { type: "fire", value: 10 },
    { type: "physical", value: 10, exceptions: ["slashing"], doubleVs: [] },
  ];

  actor.system.perception.mod = 21;
  actor.system.perception.details = "слепое чувство 60 футов";
  actor.system.perception.senses = [];
  actor.system.perception.vision = false;
  actor.system.saves.fortitude.value = 23;
  actor.system.saves.reflex.value = 18;
  actor.system.saves.will.value = 22;
  actor.system.abilities.str.mod = 7;
  actor.system.abilities.dex.mod = 0;
  actor.system.abilities.con.mod = 5;
  actor.system.abilities.int.mod = -5;
  actor.system.abilities.wis.mod = 5;
  actor.system.abilities.cha.mod = 0;
  actor.system.skills = {
    athletics: { base: 24 },
  };

  const strike = actor.items.find((item) => item.type === "melee");
  strike.name = "Щупальце";
  strike.system.bonus.value = 24;
  strike.system.traits.value = ["reach-60"];
  strike.system.damageRolls[Object.keys(strike.system.damageRolls)[0]].damage = "2d10+14";
  strike.system.damageRolls[Object.keys(strike.system.damageRolls)[0]].damageType = "bludgeoning";
  strike.system.attackEffects.value = ["grab"];
  strike.system.publication = clone(publication);

  const grab = actor.items.find((item) => item.system.slug === "grab");
  grab.name = "Захват";
  grab.system.description.value = "<p>@Localize[PF2E.NPC.Abilities.Glossary.Grab]</p>";
  grab.system.publication = clone(publication);

  const constrict = actor.items.find((item) => item.system.slug === "constrict");
  constrict.name = "Сдавливание";
  constrict.system.description.value =
    "<p>[[/r (3d10+14)[bludgeoning]]]{3d10+14 дробящего урона}, @Check[type:fortitude|dc:29|basic:true]{базовый спасбросок Стойкости КС 29}.</p><hr><p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>";
  constrict.system.publication = clone(publication);

  actor.items = actor.items.filter((item) => item.system.slug !== "darkvision");
  for (const item of actor.items) {
    item.folder = null;
    item.ownership = { default: 0 };
    if (item.system?.publication) item.system.publication = clone(publication);
  }

  actor.items.push(
    actionItem({
      id: "CtHaveroBlindSn1",
      name: "Слепое чувство",
      img: "systems/pf2e/icons/actions/Passive.webp",
      description:
        "<p>Щупальце воспринимает существ в пределах 60 футов, не полагаясь на зрение. Оно невосприимчиво к визуальным эффектам.</p>",
    }),
    actionItem({
      id: "CtTentacleStill1",
      name: "Неподвижное щупальце",
      img: "systems/pf2e/icons/actions/Passive.webp",
      description:
        "<p>Щупальце не может Перемещаться обычным образом и не может быть насильно перемещено. Оно занимает всю цепочку маркеров от бассейна до своего кончика и может быть атаковано в любой точке этой цепочки.</p>",
    }),
    actionItem({
      id: "CtTentacleSweep1",
      name: "Исследующий взмах",
      img: "systems/pf2e/icons/actions/TwoActions.webp",
      actionType: "action",
      actions: 2,
      traits: ["attack"],
      description:
        "<p>Щупальце перемещает маркер своего кончика в любую точку в пределах 50 футов от клетки основания, оставляя за ним цепочку маркеров. Затем оно совершает один Удар щупальцем по существу, расположенному рядом с любым участком этой цепочки. Этот Удар учитывает штраф за несколько атак обычным образом.</p>",
    }),
    actionItem({
      id: "CtHaveroNoBreth1",
      name: "Не дышит",
      img: "systems/pf2e/icons/actions/Passive.webp",
      description: "<p>Щупальцу не требуется дышать.</p>",
    }),
  );

  return actor;
}

function buildHavero() {
  const actor = clone(source);
  actor._id = "CtHaveroCore0001";
  actor.name = "Хаверо";
  actor.prototypeToken.name = actor.name;
  actor.img = "systems/pf2e/icons/default-icons/npc.svg";
  actor.prototypeToken.texture.src = actor.img;
  actor.prototypeToken.width = 4;
  actor.prototypeToken.height = 4;
  commonActorCleanup(actor);

  actor.system.details.level.value = 24;
  actor.system.details.blurb =
    "Исполинская сущность Тёмного Гобелена, чьи бесчисленные щупальца способны тянуться между мирами.";
  actor.system.details.publicNotes =
    "<p>Хаверо — не божество в привычном смысле, но по масштабу и разрушительной силе почти неотличим от космической катастрофы. Его полное появление должно становиться кульминацией кампании, а не обычным столкновением.</p>";
  actor.system.details.privateNotes =
    "<p><strong>Поведение в бою.</strong> Хаверо формирует придатки под текущие цели. Против скоплений он использует Кислотный распылитель и Размашистую бойню; опасных одиночных противников хватает, сдавливает или поражает ворпальным щупальцем.</p><p><strong>Мораль.</strong> Хаверо не воспринимает смертных как равных противников. Получив значительный урон, оно скорее отступает через межпространственную границу, чем сражается до смерти.</p>";
  actor.system.details.publication = clone(publication);
  actor.system.traits.rarity = "unique";
  actor.system.traits.size.value = "grg";

  actor.system.attributes.hp.value = 600;
  actor.system.attributes.hp.max = 600;
  actor.system.attributes.hp.details = "";
  actor.system.attributes.ac.value = 49;
  actor.system.attributes.ac.details = "";
  actor.system.attributes.speed.value = 20;
  actor.system.attributes.speed.otherSpeeds = [{ type: "fly", value: 60 }];
  actor.system.attributes.speed.details = "";
  actor.system.attributes.immunities = [{ type: "cold" }, { type: "mental" }];
  actor.system.attributes.resistances = [
    { type: "acid", value: 30 },
    { type: "electricity", value: 30 },
    { type: "fire", value: 30 },
    { type: "physical", value: 20, exceptions: [], doubleVs: [] },
  ];

  actor.system.perception.mod = 45;
  actor.system.perception.details =
    "всестороннее зрение, слепое чувство 120 футов, видит во тьме";
  actor.system.perception.senses = [{ type: "darkvision" }];
  actor.system.perception.vision = true;
  actor.system.saves.fortitude.value = 43;
  actor.system.saves.reflex.value = 36;
  actor.system.saves.will.value = 44;
  actor.system.abilities.str.mod = 12;
  actor.system.abilities.dex.mod = 4;
  actor.system.abilities.con.mod = 10;
  actor.system.abilities.int.mod = -2;
  actor.system.abilities.wis.mod = 7;
  actor.system.abilities.cha.mod = 10;
  actor.system.skills = {
    acrobatics: { base: 36 },
    athletics: { base: 46 },
  };

  actor.items = [
    meleeItem({
      id: "CtHaveroStrike01",
      name: "Щупальце-душитель",
      bonus: 45,
      traits: ["magical", "reach-120"],
      damage: "4d10+20",
      damageType: "bludgeoning",
      attackEffects: ["grab"],
    }),
    meleeItem({
      id: "CtHaveroGhost001",
      name: "Призрачное щупальце",
      bonus: 45,
      traits: ["magical", "reach-120"],
      damage: "4d10+20",
      damageType: "void",
      attackEffects: ["havero-ghost-drain"],
    }),
    meleeItem({
      id: "CtHaveroSting001",
      name: "Ядовитое жало",
      bonus: 44,
      traits: ["magical", "reach-120"],
      damage: "4d10+18",
      damageType: "piercing",
      attackEffects: ["havero-venom"],
    }),
    meleeItem({
      id: "CtHaveroSlash001",
      name: "Режущее щупальце",
      bonus: 45,
      traits: ["magical", "reach-120"],
      damage: "4d10+18",
      damageType: "slashing",
      extraDamage: "4d6",
      extraDamageType: "bleed",
    }),
    meleeItem({
      id: "CtHaveroVorp0001",
      name: "Ворпальное щупальце",
      bonus: 46,
      traits: ["deadly-d12", "magical", "reach-120"],
      damage: "6d12+20",
      damageType: "slashing",
      attackEffects: ["havero-vorpal-sever"],
    }),
    actionItem({
      id: "CtHaveroAllView1",
      name: "Всестороннее зрение",
      img: "systems/pf2e/icons/actions/Passive.webp",
      description: "<p>@Localize[PF2E.NPC.Abilities.Glossary.AllAroundVision]</p>",
    }),
    actionItem({
      id: "CtHaveroMind0001",
      name: "Чуждый разум",
      img: "systems/pf2e/icons/actions/Passive.webp",
      traits: ["mental"],
      description:
        "<p>Существо, которое пытается установить телепатическую связь с хаверо, прочитать его мысли или иным образом непосредственно соприкоснуться с его сознанием, должно совершить @Check[type:will|dc:48]{спасбросок Воли КС 48}.</p><hr><p><strong>Критический успех</strong> Существо невредимо и временно невосприимчиво на 24 часа.</p><p><strong>Успех</strong> Существо становится одурманено 1 на 1 раунд.</p><p><strong>Провал</strong> Существо получает [[/r 16d6[mental]]]{16d6 ментального урона} и становится одурманено 3 на 1 час.</p><p><strong>Критический провал</strong> Существо получает [[/r 32d6[mental]]]{32d6 ментального урона}, становится одурманено 4 и не может использовать действия с признаком «концентрация» в течение 1 минуты.</p>",
    }),
    actionItem({
      id: "CtHaveroAppend01",
      name: "Формирование придатков",
      img: "systems/pf2e/icons/actions/FreeAction.webp",
      actionType: "free",
      traits: ["concentrate", "polymorph"],
      description:
        "<p><strong>Частота</strong> раз за раунд.</p><p>Хаверо перераспределяет до 20 Очков трансформации между своими четырнадцатью щупальцами. Оно может использовать только атаки и способности сформированных щупалец.</p><ul><li><strong>Кислотный распылитель, 5 ОТ:</strong> предоставляет одноимённую активность и не совершает Удары.</li><li><strong>Бронированное, 3 ОТ:</strong> даёт бонус обстоятельства +2 к КБ и не атакует.</li><li><strong>Душитель, 3 ОТ:</strong> использует Щупальце-душитель, Захват и Сдавливание.</li><li><strong>Призрачное, 8 ОТ:</strong> использует Призрачное щупальце.</li><li><strong>Глазное, 0 ОТ:</strong> не атакует, но обеспечивает зрение и слепое чувство.</li><li><strong>Ядовитое жало, 5 ОТ:</strong> использует одноимённый Удар.</li><li><strong>Режущее, 3 ОТ:</strong> использует Режущее щупальце.</li><li><strong>Ворпальное, 12 ОТ:</strong> использует Ворпальное щупальце.</li></ul><p>Обычно хаверо формирует шесть щупалец-душителей, расходуя 18 ОТ, а остальные оставляет глазными.</p>",
    }),
    actionItem({
      id: "CtHaveroTelepth1",
      name: "Телепатический савант",
      img: "systems/pf2e/icons/actions/Passive.webp",
      traits: ["mental"],
      description:
        "<p>Хаверо может передавать смутные образы и первобытные эмоции на неограниченное расстояние любому известному ему существу, включая тех, кто взаимодействует с его щупальцами на далёких мирах. Эти послания не являются языком и не активируют Чуждый разум.</p>",
    }),
    actionItem({
      id: "CtHaveroNoBreth1",
      name: "Не дышит",
      img: "systems/pf2e/icons/actions/Passive.webp",
      description: "<p>Хаверо не требуется дышать.</p>",
    }),
    actionItem({
      id: "CtHaveroLightSen",
      name: "Светобоязнь",
      img: "systems/pf2e/icons/actions/Passive.webp",
      description:
        "<p>Находясь в области яркого света, хаверо становится @UUID[Compendium.pf2e.conditionitems.Item.TkIyaNPgTZFBCCuh]{ослеплено}.</p>",
    }),
    actionItem({
      id: "CtHaveroGrab0001",
      name: "Захват",
      img: "systems/pf2e/icons/actions/OneAction.webp",
      actionType: "action",
      actions: 1,
      description: "<p>@Localize[PF2E.NPC.Abilities.Glossary.Grab]</p>",
    }),
    actionItem({
      id: "CtHaveroCrush001",
      name: "Сдавливание",
      img: "systems/pf2e/icons/actions/OneAction.webp",
      actionType: "action",
      actions: 1,
      description:
        "<p>[[/r (4d10+20)[bludgeoning]]]{4d10+20 дробящего урона}, @Check[type:fortitude|dc:48|basic:true]{базовый спасбросок Стойкости КС 48}.</p><hr><p>@Localize[PF2E.NPC.Abilities.Glossary.Constrict]</p>",
    }),
    actionItem({
      id: "CtHaveroSweep001",
      name: "Размашистая бойня",
      img: "systems/pf2e/icons/actions/TwoActions.webp",
      actionType: "action",
      actions: 2,
      traits: ["attack"],
      description:
        "<p>Хаверо совершает до трёх Ударов разными сформированными щупальцами, каждый по отдельной цели. При расчёте штрафа за несколько атак все три Удара считаются одной атакой, но после завершения активности штраф хаверо увеличивается так, словно оно совершило три атаки.</p>",
    }),
    actionItem({
      id: "CtHaveroAcid0001",
      name: "Кислотный распылитель",
      img: "systems/pf2e/icons/actions/TwoActions.webp",
      actionType: "action",
      actions: 2,
      traits: ["acid"],
      description:
        "<p>Хаверо извергает кислоту линией длиной 180 футов. Существа в линии совершают @Check[type:reflex|dc:48|basic:true]{базовый спасбросок Рефлекса КС 48} против [[/r 18d6[acid]]]{18d6 урона кислотой}.</p>",
    }),
    actionItem({
      id: "CtHaveroDrain001",
      name: "Призрачное истощение",
      img: "systems/pf2e/icons/actions/Passive.webp",
      slug: "havero-ghost-drain",
      traits: ["void"],
      description:
        "<p>Существо, получившее урон от Призрачного щупальца, должно совершить @Check[type:fortitude|dc:48]{спасбросок Стойкости КС 48}. При провале оно становится истощено 2, при критическом провале — истощено 4.</p>",
    }),
    actionItem({
      id: "CtHaveroPoison01",
      name: "Яд хаверо",
      img: "systems/pf2e/icons/actions/Passive.webp",
      slug: "havero-venom",
      traits: ["poison"],
      description:
        "<p><strong>Спасбросок</strong> @Check[type:fortitude|dc:48]{Стойкость КС 48}; <strong>максимальная длительность</strong> 6 раундов.</p><p><strong>Стадия 1</strong> [[/r 4d6[poison]]]{4d6 урона ядом} и ослаблен 1 (1 раунд).</p><p><strong>Стадия 2</strong> [[/r 6d6[poison]]]{6d6 урона ядом} и ослаблен 2 (1 раунд).</p><p><strong>Стадия 3</strong> [[/r 8d6[poison]]]{8d6 урона ядом} и истощён 2 (1 раунд).</p>",
    }),
    actionItem({
      id: "CtHaveroVorpal01",
      name: "Ворпальный разрез",
      img: "systems/pf2e/icons/actions/Passive.webp",
      slug: "havero-vorpal-sever",
      traits: ["death"],
      description:
        "<p>При критическом попадании Ворпальным щупальцем цель должна совершить @Check[type:fortitude|dc:48]{спасбросок Стойкости КС 48}. При провале она получает дополнительные [[/r 12d12[slashing]]]{12d12 рубящего урона}. При критическом провале существо с головой обезглавлено и погибает; существа без головы вместо этого получают двойной дополнительный урон.</p>",
    }),
  ];

  return actor;
}

function buildBestiaryJournal() {
  return {
    _id: "CtHaveroBest0001",
    name: "Хаверо",
    pages: [
      {
        sort: 100000,
        name: "Хаверо",
        type: "text",
        _id: "CtHaveroLore0001",
        system: {},
        title: { show: true, level: 1 },
        image: {},
        text: {
          format: 1,
          content:
            '<div class="ct-handout ct-read-aloud"><p>Исполинская масса плоти, опутанная клубком невероятно длинных щупалец, подавляет разум одним своим чудовищным масштабом.</p></div><h2>Хаверо</h2><p>Слово «хаверо» восходит к древнему тассилонскому выражению, которое приблизительно переводится как «удушающие руки». Существование хаверо впервые подтвердили случайно: звездочёты древнего Тассилона обнаружили их при помощи прорицательной магии. Ища всё более могучих чудовищ, которых можно было бы призвать и подчинить, мудрецы ордена Поработителей постепенно вышли на след исполинского существа, обитавшего далеко за пределами досягаемости большинства средств дальнего наблюдения и способного порождать бесчисленных когтистых тварей.</p><p>Возможность обрести новый источник силы, скрытый где-то среди ночных звёзд, опьянила Поработителей. Между ними началась безрассудная гонка: каждый стремился первым заполучить хаверо.</p><p>К несчастью, хаверо оказались не выдумкой обезумевших звездочётов. Это сущности чистой тьмы. В редчайшие и страшнейшие времена одному из них удаётся проникнуть на Голарион — и тогда все народы мира оказываются в пределах досягаемости его губительных щупалец.</p><h2>Экология</h2><p>Мысли хаверо настолько чужды, что смертный разум почти не способен их истолковать, однако в их злобной природе сомневаться не приходится. Теоретически телепатия хаверо не имеет пределов, хотя мысленному посланию, пересекающему галактики, требуется немало времени, чтобы достигнуть цели.</p><p>Поработители полагали, что случайно перехваченные отголоски мыслей хаверо могут становиться причиной как некоторых форм безумия, так и необъяснимых вспышек гениальности. Некоторые учёные заходят ещё дальше: по их мнению, древние Поработители сумели перенести хаверо на Голарион не благодаря собственным открытиям. Не исключено, что сами хаверо незаметно вложили в их разум знания, необходимые для призыва.</p><h2>Среда обитания и общество</h2><p>Древний фолиант звёздных наблюдений и оккультных изысканий «О подтверждённом безумии» утверждает, что родина хаверо лежит в самом дальнем уголке Тёмного Гобелена. На Голарионе у этих существ нет естественной среды обитания. Они появляются здесь лишь из-за деяний тех, кому когда-то хватило могущества — и безрассудства — перенести их в этот мир.</p><h2>Щупальце хаверо</h2><p>Даже опытные герои рискуют не пережить встречу с целым хаверо. Чтобы показать угрозу космического чудовища, не обрекая искателей приключений на неминуемую гибель, можно использовать отдельное щупальце: оно способно проникнуть сквозь межпространственный разлом, подняться из бездонной расселины или протянуться из затопленного провала.</p><p>Уничтожение одного щупальца — и даже нескольких — не убивает хаверо. Оно лишь заставляет чудовище ненадолго отступить и дарит его жертвам время для побега.</p>',
        },
        video: { controls: true, volume: 0.5 },
        src: null,
        category: null,
        flags: {},
        ownership: { default: -1 },
        _stats: {
          coreVersion: "14.365",
          systemId: "pf2e",
          systemVersion: "8.3.0",
          createdTime: null,
          modifiedTime: null,
          lastModifiedBy: null,
          compendiumSource: null,
          duplicateSource: null,
          exportSource: null,
        },
      },
    ],
    categories: [],
    ownership: { default: 0 },
    flags: { core: { sheetClass: "" } },
    _stats: {
      coreVersion: "14.365",
      systemId: "pf2e",
      systemVersion: "8.3.0",
      createdTime: null,
      modifiedTime: null,
      lastModifiedBy: null,
      compendiumSource: null,
      duplicateSource: null,
      exportSource: null,
    },
  };
}

function validateActor(actor) {
  const ids = [actor._id, ...actor.items.map((item) => String(item._id || ""))];
  const invalid = ids.filter((id) => !/^[A-Za-z0-9]{16}$/.test(id));
  if (invalid.length) throw new Error(`Invalid embedded item IDs: ${invalid.join(", ")}`);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate embedded item ID in ${actor.name}.`);
}

const tentacle = buildTentacle();
const havero = buildHavero();
const bestiaryJournal = buildBestiaryJournal();
validateActor(tentacle);
validateActor(havero);

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, "havero-tentacle-level-10.actor.json"),
  `${JSON.stringify(tentacle, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputDirectory, "havero-level-24.actor.json"),
  `${JSON.stringify(havero, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputDirectory, "havero-bestiary.journal.json"),
  `${JSON.stringify(bestiaryJournal, null, 2)}\n`,
  "utf8",
);
