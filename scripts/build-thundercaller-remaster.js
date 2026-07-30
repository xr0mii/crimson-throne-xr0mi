const fs = require("fs");
const { ClassicLevel } = require("classic-level");

const [sourcePath, spellPackPath, translationPath, silverPaintPath, outputPath] = process.argv.slice(2);

if (![sourcePath, spellPackPath, translationPath, silverPaintPath, outputPath].every(Boolean)) {
  throw new Error("Expected source actor, copied spell pack, translation, silver paint, and output paths.");
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const actor = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const translations = JSON.parse(fs.readFileSync(translationPath, "utf8")).entries;
const silverPaint = JSON.parse(fs.readFileSync(silverPaintPath, "utf8"));

function setPath(object, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  let cursor = object;
  for (const part of parts) {
    cursor[part] ??= {};
    cursor = cursor[part];
  }
  cursor[last] = value;
}

function applyRussianSpellTranslation(item, englishName) {
  const entry = translations[englishName];
  if (!entry) return item;

  item.name = (entry.name || englishName).replace(/\(\*\)$/, "").trim();
  if (entry.description) item.system.description.value = entry.description;

  const scalarMappings = {
    requirements: "system.requirements",
    range: "system.range.value",
    target: "system.target.value",
    duration: "system.duration.value",
    cost: "system.cost.value",
    time: "system.time.value",
  };

  for (const [key, path] of Object.entries(scalarMappings)) {
    if (entry[key] !== undefined) setPath(item, path, entry[key]);
  }

  return item;
}

async function main() {
  const db = new ClassicLevel(spellPackPath, { valueEncoding: "utf8", readOnly: true });
  await db.open();

  const spellNames = [
    "Soothe",
    "Dispel Magic",
    "Fear",
    "Haste",
    "Noise Blast",
    "Shatter",
    "Sure Strike",
    "Daze",
    "Detect Magic",
    "Light",
    "Prestidigitation",
    "Counter Performance",
    "Courageous Anthem",
    "Rallying Anthem",
    "Song of Strength",
  ];
  const documents = new Map();

  for await (const [, value] of db.iterator()) {
    try {
      const document = JSON.parse(value);
      if (spellNames.includes(document.name)) documents.set(document.name, document);
    } catch {
      // Folder records and metadata are not item documents.
    }
  }
  await db.close();

  const missing = spellNames.filter((name) => !documents.has(name));
  if (missing.length) throw new Error(`Missing remaster spells: ${missing.join(", ")}`);

  actor.name = "Призыватель грома Склар-Куа";
  actor.prototypeToken.name = "Призыватель грома Склар-Куа";
  actor.system.details.level.value = 7;
  actor.system.details.blurb =
    "Воин-певец Склар-Куа, поддерживающий сородичей громовыми напевами и свистом тотемного копья.";
  actor.system.details.publicNotes =
    "<p>Призыватели грома сопровождают Кроджуна в Акрополь Поработителей. Они сражаются тотемными копьями и поддерживают союзников оккультными песнями.</p>";
  actor.system.details.privateNotes =
    "<p><strong>Перед боем.</strong> Призыватель наносит серебряную боевую краску, если ожидает сражения.</p><p><strong>Поведение в бою.</strong> Один призыватель поддерживает Гимн отваги, пока остальные вступают в ближний бой. Тяжело раненный воин отступает и меняется ролью с певцом; певец лечит его Успокоением или атакует Взрывом шума.</p><p><strong>Мораль.</strong> Пока Кроджун жив и способен сражаться, призыватели грома не отступают. Если он погибает или оказывается выведен из строя, они немедленно покидают акрополь.</p>";
  actor.system.details.publication = {
    title: "Проклятие Багряного Трона — конверсия PF2e Remaster",
    authors: "xr0mi",
    license: "ORC",
    remaster: true,
  };

  actor.system.attributes.hp.value = 105;
  actor.system.attributes.hp.max = 105;
  actor.system.attributes.hp.details = "";
  actor.system.attributes.ac.value = 24;
  actor.system.attributes.ac.details = "25 под действием серебряной боевой краски";
  actor.system.saves.fortitude.value = 16;
  actor.system.saves.reflex.value = 14;
  actor.system.saves.will.value = 16;
  actor.system.abilities.str.mod = 5;
  actor.system.abilities.dex.mod = 3;
  actor.system.abilities.con.mod = 4;
  actor.system.abilities.int.mod = 0;
  actor.system.abilities.wis.mod = 1;
  actor.system.abilities.cha.mod = 4;

  const occultEntry = actor.items.find((item) => item.type === "spellcastingEntry" && item.system.prepared.value === "spontaneous");
  const focusEntry = actor.items.find((item) => item.type === "spellcastingEntry" && item.system.prepared.value === "focus");
  occultEntry.name = "Спонтанные оккультные заклинания";
  focusEntry.name = "Заклинания фокусировки";

  for (const entry of [occultEntry, focusEntry]) {
    entry.system.publication = {
      title: "Pathfinder Player Core",
      authors: "",
      license: "ORC",
      remaster: true,
    };
    entry.system.spelldc.value = 17;
    entry.system.spelldc.dc = 25;
    entry.system.autoHeightenLevel.value = 4;
  }

  for (const [rank, slots] of Object.entries({ 1: 3, 2: 3, 3: 3, 4: 2 })) {
    occultEntry.system.slots[`slot${rank}`].value = slots;
    occultEntry.system.slots[`slot${rank}`].max = slots;
  }

  function embeddedSpell(englishName, entryId, heightenedLevel = null) {
    const item = clone(documents.get(englishName));
    item.system.location = { value: entryId };
    if (heightenedLevel) item.system.location.heightenedLevel = heightenedLevel;
    item.folder = null;
    item.sort = 0;
    item.ownership = { default: 0 };
    applyRussianSpellTranslation(item, englishName);
    if (heightenedLevel && heightenedLevel !== item.system.level.value) {
      item.name = `${item.name} (${heightenedLevel}-й ранг)`;
    }
    return item;
  }

  const spells = [
    embeddedSpell("Soothe", occultEntry._id, 4),
    embeddedSpell("Dispel Magic", occultEntry._id, 4),
    embeddedSpell("Fear", occultEntry._id, 3),
    embeddedSpell("Haste", occultEntry._id, 3),
    embeddedSpell("Noise Blast", occultEntry._id, 2),
    embeddedSpell("Shatter", occultEntry._id, 2),
    embeddedSpell("Sure Strike", occultEntry._id, 1),
    embeddedSpell("Daze", occultEntry._id),
    embeddedSpell("Detect Magic", occultEntry._id),
    embeddedSpell("Light", occultEntry._id),
    embeddedSpell("Prestidigitation", occultEntry._id),
    embeddedSpell("Counter Performance", focusEntry._id),
    embeddedSpell("Courageous Anthem", focusEntry._id),
    embeddedSpell("Rallying Anthem", focusEntry._id),
    embeddedSpell("Song of Strength", focusEntry._id),
  ];

  const retainedItems = actor.items.filter((item) => item.type !== "spell");

  const armor = retainedItems.find((item) => item.type === "armor");
  armor.name = "Шкурный доспех +1";
  armor.system.description.value =
    "<p>Слои прочной шкуры, меха и вываренной кожи защищают владельца ценой некоторой громоздкости.</p>";
  armor.system.publication = {
    title: "Pathfinder Player Core",
    authors: "",
    license: "ORC",
    remaster: true,
  };
  armor.system.identification.unidentified.name = "Необычный шкурный доспех";

  const weapon = retainedItems.find((item) => item.type === "weapon");
  weapon.name = "Тотемное копьё +1 (разящее)";
  weapon.system.slug = "totem-spear";
  weapon.system.description.value =
    "<p>Тяжёлое двуручное копьё с широким лопатообразным наконечником. Отверстия в металле издают зловещий свист, когда искусный воин рассекает копьём воздух. Оружие способно наносить колющие и рубящие удары.</p>";
  weapon.system.traits.rarity = "uncommon";
  weapon.system.traits.value = ["magical", "thrown-10", "versatile-s"];
  weapon.system.level.value = 4;
  weapon.system.price.value = { gp: 100 };
  weapon.system.usage.value = "held-in-two-hands";
  weapon.system.category = "martial";
  weapon.system.damage.dice = 1;
  weapon.system.damage.die = "d8";
  weapon.system.identification.unidentified.name = "Необычное копьё";
  weapon.system.publication = {
    title: "Проклятие Багряного Трона — конверсия PF2e Remaster",
    authors: "xr0mi",
    license: "ORC",
    remaster: true,
  };

  const oldPaintIndex = retainedItems.findIndex((item) => item.type === "consumable" && /War Paint/i.test(item.name));
  silverPaint._id = retainedItems[oldPaintIndex]._id;
  silverPaint.folder = null;
  silverPaint.sort = 0;
  silverPaint.ownership = { default: 0 };
  retainedItems[oldPaintIndex] = silverPaint;

  for (const strike of retainedItems.filter((item) => item.type === "melee")) {
    strike.name = "Тотемное копьё +1 (разящее)";
    strike.system.publication = {
      title: "Проклятие Багряного Трона — конверсия PF2e Remaster",
      authors: "xr0mi",
      license: "ORC",
      remaster: true,
    };
  }

  const meleeStrike = retainedItems.find(
    (item) => item.type === "melee" && !item.system.traits.value.includes("thrown-10"),
  );
  meleeStrike.system.bonus.value = 16;
  meleeStrike.system.damageRolls[Object.keys(meleeStrike.system.damageRolls)[0]].damage = "2d8+9";

  const thrownStrike = retainedItems.find(
    (item) => item.type === "melee" && item.system.traits.value.includes("thrown-10"),
  );
  thrownStrike.system.bonus.value = 14;
  thrownStrike.system.damageRolls[Object.keys(thrownStrike.system.damageRolls)[0]].damage = "2d8+6";

  const courageousAdvance = retainedItems.find((item) => item.type === "action");
  courageousAdvance.name = "Смелое наступление";
  courageousAdvance.system.description.value =
    "<p>Громким призывом призыватель грома побуждает союзника наступать. Если его следующим действием становится сотворение <em>Гимна отваги</em>, один получивший бонус от гимна союзник может немедленно использовать реакцию, чтобы Переместиться.</p>";
  courageousAdvance.system.publication = {
    title: "Проклятие Багряного Трона — конверсия PF2e Remaster",
    authors: "xr0mi",
    license: "ORC",
    remaster: true,
  };

  actor.items = [...retainedItems, ...spells];
  actor.flags ??= {};
  actor.flags["crimson-throne-xr0mi"] = {
    conversion: "PF2e Remaster",
    sourceActor: "Sklar-Quah Thundercaller",
    notes: "Level 7 support creature; balanced as a subordinate of Krojun.",
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(actor, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
