const fs = require("fs");
const path = require("path");

const moduleRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(moduleRoot, "exports", "vencarlo-companion-setup.js");
const outputPath = path.join(moduleRoot, "exports", "fvtt-Macro-spitniki-dobavit-venkarlo.json");
const command = fs.readFileSync(sourcePath, "utf8").trim();

const macro = {
  _id: "CtVencarloMac001",
  name: "Спутники — добавить Венкарло",
  type: "script",
  scope: "global",
  command,
  img: "modules/crimson-throne-xr0mi/assets/portraits/207.webp",
  folder: null,
  sort: 0,
  ownership: {
    default: 0
  },
  flags: {},
  _stats: {
    coreVersion: "14.365",
    systemId: "pf2e",
    systemVersion: "8.3.0",
    createdTime: null,
    modifiedTime: null,
    lastModifiedBy: null,
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null
  }
};

fs.writeFileSync(outputPath, `${JSON.stringify(macro, null, 2)}\n`, "utf8");
console.log(outputPath);
