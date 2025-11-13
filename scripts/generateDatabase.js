import fs from "fs";
import binCharacter from "../EN/bin/Character.json" with { type: "json" };
import binItem from "../EN/bin/Item.json" with { type: "json" };
import binPotential from "../EN/bin/Potential.json" with { type: "json" };
import binCharPotential from "../EN/bin/CharPotential.json" with { type: "json" };
import langItem from "../EN/language/en_US/Item.json" with { type: "json" };
import langPotential from "../EN/language/en_US/Potential.json" with { type: "json" };
import langCharacterDes from "../EN/language/en_US/CharacterDes.json" with { type: "json" };

/**
 * Parses a string to an integer, throwing an error if it fails.
 * @param {*} value - The value to parse.
 * @param {string} context - Optional context for the error message.
 * @returns {number} The parsed integer.
 */
function parseIntStrict(value, context) {
  const result = parseInt(value);
  if (isNaN(result)) {
    const contextMsg = context ? ` (${context})` : "";
    throw new Error(`Failed to parse integer: ${value}${contextMsg}`);
  }
  return result;
}

function generateDatabase() {
  let database = [];
  // Should probs validate, but the json is very big so problem for later

  // Build mapping for char to potential types
  /** @type {Set<number>} */
  let incompleteIds = new Set();
  /** @type {Map<number, any>} */
  let charToPotentialType = new Map();
  Object.values(binCharPotential).forEach((entry) => {
    let data = entry;
    let charId = parseIntStrict(data.Id);
    let result = {
      type1: [],
      type2: [],
      type3: [],
    };
    if (data.MasterSpecificPotentialIds === undefined) {
      incompleteIds.add(charId);
      return;
    }
    Object.values(data.MasterSpecificPotentialIds).forEach((id) => result.type1.push(parseIntStrict(id)));
    Object.values(data.MasterNormalPotentialIds).forEach((id) => result.type1.push(parseIntStrict(id)));
    Object.values(data.AssistSpecificPotentialIds).forEach((id) => result.type2.push(parseIntStrict(id)));
    Object.values(data.AssistNormalPotentialIds).forEach((id) => result.type2.push(parseIntStrict(id)));
    Object.values(data.CommonPotentialIds).forEach((id) => result.type3.push(parseIntStrict(id)));

    charToPotentialType.set(charId, result);
  });

  // Build mapping from char to potentials
  /** @type {Map<number, Potential[]>} */
  let charToPotentials = new Map();
  Object.values(binPotential).forEach((potential) => {
    let charId = parseIntStrict(potential.CharId);
    if (incompleteIds.has(charId)) return;

    if (charToPotentials.has(charId) == false) {
      charToPotentials.set(charId, []);
    }

    // Parse potential data
    let potentialId = parseIntStrict(potential.Id);

    // Get rarity
    // Specific potential has stype 42
    // Rare potential has stype 41 and rarity 1
    // Common potential has stype 41 and rarity 2
    let rarity = 0;
    let stype = parseIntStrict(binItem[potentialId].Stype);
    let typeRarity = parseIntStrict(binItem[potentialId].Rarity);
    if (stype == 42) {
      rarity = 3;
    } else if (stype == 41 && typeRarity == 1) {
      rarity = 2;
    } else if (stype == 41 && typeRarity == 2) {
      rarity = 1;
    } else {
      throw new Error(`Unknown potential type. stype: ${stype} rarity: ${typeRarity}`);
    }

    // Get potential type
    // Type depends on where id is located in CharPotential.json
    let type = 0;
    const potentialTypes = charToPotentialType.get(charId);
    if (!potentialTypes) {
      throw new Error(`No potential types found for character: ${charId}`);
    }
    if (potentialTypes.type1.includes(potentialId)) type = 1;
    else if (potentialTypes.type2.includes(potentialId)) type = 2;
    else if (potentialTypes.type3.includes(potentialId)) type = 3;
    else throw new Error(`Unknown potential type: ${potentialId}`);

    charToPotentials.get(charId).push({
      id: potentialId,
      name: langItem[`Item.${potentialId}.1`],
      descShort: langPotential[`Potential.${potentialId}.1`],
      descLong: langPotential[`Potential.${potentialId}.2`],
      rarity: rarity,
      build: potential.Build,
      type: type,
    });
  });

  // Populate each character
  for (const [charIdStr, charData] of Object.entries(binCharacter)) {
    let charId = parseIntStrict(charIdStr);

    // Get data and filter out unwanted entries
    const potentials = charToPotentials.get(charId);
    if (!potentials) continue;
    const charName = langCharacterDes[`CharacterDes.${charId}.2`];
    if (charName === "???") continue;
    const name = langCharacterDes[`CharacterDes.${charId}.2`];

    // Populate character
    const character = {
      id: charId,
      name: name,
      class: parseIntStrict(charData.Class),
      element: parseIntStrict(charData.EET),
      grade: parseIntStrict(charData.Grade),
      mainBuild1Name: langCharacterDes[`CharacterDes.${charId}.4`],
      mainBuild1Desc: langCharacterDes[`CharacterDes.${charId}.9`],
      mainBuild2Name: langCharacterDes[`CharacterDes.${charId}.5`],
      mainBuild2Desc: langCharacterDes[`CharacterDes.${charId}.10`],
      supportBuild1Name: langCharacterDes[`CharacterDes.${charId}.6`],
      supportBuild1Desc: langCharacterDes[`CharacterDes.${charId}.11`],
      supportBuild2Name: langCharacterDes[`CharacterDes.${charId}.7`],
      supportBuild2Desc: langCharacterDes[`CharacterDes.${charId}.12`],
      potentials: potentials,
    };
    database.push(character);
  }

  fs.writeFileSync("./database.json", JSON.stringify(database, null, 2));
  console.log("Database generated successfully!");
}

export default generateDatabase;
