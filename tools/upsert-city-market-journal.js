const fs = require("fs");
const path = require("path");
const { ClassicLevel } = require("classic-level");

const [packPath, journalPath, backupDirectory] = process.argv.slice(2);
if (!packPath || !journalPath || !backupDirectory) {
  throw new Error("Usage: node upsert-city-market-journal.js <pack> <journal-json> <backup-directory>");
}

const ADVENTURE_NAME = "0/6 Обязательные материалы";
const ROOT_JOURNAL_FOLDER_NAME = "Проклятие Багряного Трона";
const KORVOSA_JOURNAL_NAME = "02 Корвоса и окрестности";
const SHOPPING_PAGE_NAME = "Покупки в Корвосе";
const GUIDE_ID = "ctCityMarket0001";

const replacementIntro = [
  '<div class="ct-handout">',
  '<h4>Динамический рынок PF2e</h4>',
  '<p>Старое правило о 75% вероятности наличия больше не используется. Доступность и цена сделки определяются текущим состоянием города, уровнем предмета, его редкостью и спросом.</p>',
  `<p>Полные правила и порядок работы: @UUID[JournalEntry.${GUIDE_ID}]{«Городская торговля»}.</p>`,
  '</div>',
  '<p>Ниже перечислены самые заметные рынки, лавки и поставщики услуг Корвосы. Они помогают выбрать место и участников сцены покупки, но не заменяют проверку городского рынка.</p>'
].join("");

function updateShoppingPage(adventure) {
  const journal = adventure.journal?.find((entry) => entry.name === KORVOSA_JOURNAL_NAME);
  const page = journal?.pages?.find((entry) => entry.name === SHOPPING_PAGE_NAME);
  if (!page?.text?.content) throw new Error(`Page not found: ${KORVOSA_JOURNAL_NAME} / ${SHOPPING_PAGE_NAME}`);

  const shopHeading = "<h3>МАГАЗИНЫ И УСЛУГИ</h3>";
  const headingIndex = page.text.content.indexOf(shopHeading);
  if (headingIndex < 0) throw new Error(`Shop heading not found on page: ${SHOPPING_PAGE_NAME}`);
  page.text.content = `${replacementIntro}${page.text.content.slice(headingIndex)}`;
  page._stats ??= {};
  page._stats.modifiedTime = Date.now();
}

async function main() {
  const guide = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  if (guide._id !== GUIDE_ID) throw new Error(`Unexpected guide id: ${guide._id}`);
  fs.mkdirSync(backupDirectory, { recursive: true });

  const db = new ClassicLevel(packPath, { valueEncoding: "utf8" });
  await db.open();
  let found = false;

  try {
    for await (const [key, value] of db.iterator()) {
      const adventure = JSON.parse(value);
      if (adventure.name !== ADVENTURE_NAME) continue;
      found = true;

      const rootFolder = adventure.folders?.find((folder) =>
        folder.type === "JournalEntry" && folder.name === ROOT_JOURNAL_FOLDER_NAME && !folder.folder
      );
      if (!rootFolder) throw new Error(`Root JournalEntry folder not found: ${ROOT_JOURNAL_FOLDER_NAME}`);

      const backupName = `${adventure._id}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      fs.writeFileSync(path.join(backupDirectory, backupName), JSON.stringify(adventure, null, 2), "utf8");

      guide.folder = rootFolder._id;
      const existingIndex = adventure.journal.findIndex((entry) => entry._id === GUIDE_ID || entry.name === guide.name);
      if (existingIndex >= 0) adventure.journal[existingIndex] = guide;
      else adventure.journal.push(guide);

      updateShoppingPage(adventure);
      adventure._stats ??= {};
      adventure._stats.modifiedTime = Date.now();
      await db.put(key, JSON.stringify(adventure));
      console.log(JSON.stringify({
        adventure: adventure.name,
        adventureId: adventure._id,
        journal: guide.name,
        journalId: guide._id,
        action: existingIndex >= 0 ? "updated" : "added",
        journalCount: adventure.journal.length,
        backup: path.join(backupDirectory, backupName)
      }, null, 2));
      break;
    }
  } finally {
    await db.close();
  }

  if (!found) throw new Error(`Adventure not found: ${ADVENTURE_NAME}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
