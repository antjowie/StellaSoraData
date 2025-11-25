import fs from "fs";
import {
  setLang,
  EN,
  JP,
  KR,
  CN,
  TW,
  parseNumberStrict,
  getJson,
  getLangJson,
} from "./global.js";
import parseParam from "./paramParser.js";

// Patch descriptions
// Apply special text
// Some descriptions contain the ##Lux Mark#1015# pattern. This pattern indicates a special text
// 1015 is the ID and in game the text is adjusted in the following ways:
//  - The text will be colored
//  - The text will be underlined and can be pressed to open a popup
//  - The ID will be replaced with an icon
function patchDescription(origText) {
  // Replace all color tags with span tags (valid html)
  let finalText = origText;
  while (finalText.includes("<color=#")) {
    const colorStart = finalText.indexOf("<color=#");
    const colorEnd = finalText.indexOf(">", colorStart);
    const color = finalText.slice(colorStart + "<color=#".length, colorEnd);
    let colorCloseStart = finalText.indexOf("</color>", colorEnd);
    const textStart = colorEnd + 1;
    let textEnd;
    let colorCloseEnd;
    if (colorCloseStart === -1) {
      // Some translations don't close color tags, in this case the first string is included
      textEnd =
        finalText.slice(textStart).match(/^[^,\s]+/)[0].length + textStart;
      colorCloseEnd = textEnd;
    } else {
      textEnd = colorCloseStart;
      colorCloseEnd = colorCloseStart + "</color>".length;
    }
    const text = finalText.slice(textStart, textEnd);

    finalText =
      finalText.slice(0, colorStart) +
      `<span style="color:#${color}">${text}</span>` +
      finalText.slice(colorCloseEnd);
  }

  // Process special words
  const specialTextRegex = /##[^#]+#\d+#/g; // Match ##Lux Mark#1015#
  const idRegex = /#\d+#/g; // Match #1015#
  const textRegex = /##[^#]+#/g; // Match ##Lux Mark#
  const texts = origText.match(specialTextRegex);
  if (texts !== null) {
    for (const text of texts) {
      const id = text.match(idRegex)[0].slice(1, -1);
      if (!(id in getJson("Word")))
        throw new Error(`Unknown special text ID: ${id}`);
      const word = getJson("Word")[id];

      finalText = finalText.replace(
        text,
        `<span style="color:#${word.Color}">${text.match(textRegex)[0].slice(2, -1)}</span>`,
      );
    }
  }
  return finalText.replace(/\u000b/g, "\n");
}

const extractParamsFromText = (text) => text.match(/(?<=&)\w+(?=&)/g) ?? [];

function getCharacters() {
  let data = [];
  // Build mapping for char to potential types
  /** @type {Set<number>} */
  let incompleteIds = new Set();
  /** @type {Map<number, any>} */
  let charToPotentialType = new Map();
  Object.values(getJson("CharPotential")).forEach((entry) => {
    let data = entry;
    let charId = parseNumberStrict(data.Id);
    let result = {
      type1: [],
      type2: [],
      type3: [],
    };
    if (data.MasterSpecificPotentialIds === undefined) {
      incompleteIds.add(charId);
      return;
    }
    Object.values(data.MasterSpecificPotentialIds).forEach((id) =>
      result.type1.push(parseNumberStrict(id)),
    );
    Object.values(data.MasterNormalPotentialIds).forEach((id) =>
      result.type1.push(parseNumberStrict(id)),
    );
    Object.values(data.AssistSpecificPotentialIds).forEach((id) =>
      result.type2.push(parseNumberStrict(id)),
    );
    Object.values(data.AssistNormalPotentialIds).forEach((id) =>
      result.type2.push(parseNumberStrict(id)),
    );
    Object.values(data.CommonPotentialIds).forEach((id) =>
      result.type3.push(parseNumberStrict(id)),
    );

    charToPotentialType.set(charId, result);
  });

  // Build mapping from char to potentials
  /** @type {Map<number, Potential[]>} */
  let charToPotentials = new Map();
  Object.values(getJson("Potential")).forEach((potential) => {
    let charId = parseNumberStrict(potential.CharId);
    if (incompleteIds.has(charId)) return;

    if (charToPotentials.has(charId) == false) {
      charToPotentials.set(charId, []);
    }

    // Parse potential data
    let potentialId = parseNumberStrict(potential.Id);

    // Get rarity
    // Specific potential has stype 42
    // Rare potential has stype 41 and rarity 1
    // Common potential has stype 41 and rarity 2
    let rarity = 0;
    let stype = parseNumberStrict(getJson("Item")[potentialId].Stype);
    let typeRarity = parseNumberStrict(getJson("Item")[potentialId].Rarity);
    if (stype == 42) {
      rarity = 3;
    } else if (stype == 41 && typeRarity == 1) {
      rarity = 2;
    } else if (stype == 41 && typeRarity == 2) {
      rarity = 1;
    } else {
      throw new Error(
        `Unknown potential type. stype: ${stype} rarity: ${typeRarity}`,
      );
    }

    // Set potential icon
    let icons = [];
    const parts = getJson("Item")[potentialId].Icon.split("/");
    icons.push(parts[parts.length - 1] + "_A");
    if ("Corner" in getJson("Potential")[potentialId]) {
      // One of the 3 common icons
      switch (parseNumberStrict(getJson("Potential")[potentialId].Corner)) {
        case 1:
          icons.push("Potential_Diamond_B");
          icons.push("Potential_Diamond_A");
          break;
        case 2:
          icons.push("Potential_Triangle_B");
          icons.push("Potential_Triangle_A");
          break;
        case 3:
          icons.push("Potential_Round_B");
          icons.push("Potential_Round_A");
          break;
        default:
          throw new Error(
            `Unknown corner value for potential ${potentialId}: ${getJson("Potential")[potentialId].Corner}`,
          );
      }
    }

    if (icons.length === 0) {
      throw new Error(`No icon found for potential: ${potentialId}`);
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

    const descShort = patchDescription(
      getLangJson("Potential")[`Potential.${potentialId}.1`],
    );
    const descLong = patchDescription(
      getLangJson("Potential")[`Potential.${potentialId}.2`],
    );

    let paramStrings = extractParamsFromText(descShort);
    paramStrings = [...paramStrings, ...extractParamsFromText(descLong)];
    paramStrings = new Set(paramStrings);
    let params = [];
    for (const param of paramStrings) {
      if (!(param in potential))
        throw new Error(
          `Missing param value: ${param} for potential ${potentialId}`,
        );

      const paramValue = potential[param];
      const paramIdx = parseNumberStrict(param.slice("Param".length));
      params.push({ idx: paramIdx, values: parseParam(paramValue) });
    }

    charToPotentials.get(charId).push({
      id: potentialId,
      name: getLangJson("Item")[`Item.${potentialId}.1`],
      descShort,
      descLong,
      icons,
      rarity,
      build: potential.Build,
      type,
      params,
    });
  });

  // Populate each character
  for (const [charIdStr, charData] of Object.entries(getJson("Character"))) {
    let charId = parseNumberStrict(charIdStr);
    if (charData["Visible"] === undefined || charData["Visible"] === false)
      continue;

    // Get data and filter out unwanted entries
    const potentials = charToPotentials.get(charId);
    if (!potentials) continue;
    const charName = getLangJson("CharacterDes")[`CharacterDes.${charId}.2`];
    const name = getLangJson("CharacterDes")[`CharacterDes.${charId}.2`];

    // Populate character
    const character = {
      id: charId,
      name: name,
      class: parseNumberStrict(charData.Class),
      element: parseNumberStrict(charData.EET),
      rarity: parseNumberStrict(charData.Grade),
      mainBuild1Name: getLangJson("CharacterDes")[`CharacterDes.${charId}.4`],
      mainBuild1Desc: getLangJson("CharacterDes")[`CharacterDes.${charId}.9`],
      mainBuild2Name: getLangJson("CharacterDes")[`CharacterDes.${charId}.5`],
      mainBuild2Desc: getLangJson("CharacterDes")[`CharacterDes.${charId}.10`],
      supportBuild1Name:
        getLangJson("CharacterDes")[`CharacterDes.${charId}.6`],
      supportBuild1Desc:
        getLangJson("CharacterDes")[`CharacterDes.${charId}.11`],
      supportBuild2Name:
        getLangJson("CharacterDes")[`CharacterDes.${charId}.7`],
      supportBuild2Desc:
        getLangJson("CharacterDes")[`CharacterDes.${charId}.12`],
      potentials: potentials,
    };
    data.push(character);
  }
  return data;
}

function getDiscs() {
  return Object.values(getJson("Disc"))
    .map((disc) => {
      if (disc["Visible"] === undefined || disc["Visible"] === false)
        return null;

      // Parse skills (melodies and harmonies)
      const patchText = (desc) => {
        // Replace {x} with &Paramx& to be consistent
        return patchDescription(desc.replace(/\{(\d+)\}/g, "&Param$1&"));
      };

      const getSkill = (groupId, bin, lang) => {
        let obj = bin[groupId + "01"];
        // There are separate name and desc entires for each level, but we can ignore them
        // as they are all similar
        if (!obj) {
          throw new Error(
            `No skill found for ${groupId}01 while processing disc ${disc.Id}`,
          );
        }
        const name = lang[obj.Name];
        const desc = patchText(lang[obj.Desc]);

        const paramsStrings = extractParamsFromText(desc);
        let params = [];
        let notes = [];
        for (const [i, param] of paramsStrings.entries()) {
          params.push({
            idx: parseNumberStrict(param.slice("Param".length)),
            values: [],
          });
        }

        let level = 1;
        while (obj !== undefined) {
          for (const [i, param] of paramsStrings.entries()) {
            if (obj[param] === undefined)
              throw new Error(
                `Parameter ${param} not found for ${groupId} at level ${level}`,
              );
            params[i].values.push(obj[param]);
          }
          // "NeedSubNoteSkills": "{\"90013\":1,\"90014\":2}",
          if ("NeedSubNoteSkills" in obj) {
            const noteObj = JSON.parse(obj["NeedSubNoteSkills"]);

            // Notes are stored like this:
            // [
            //  [id, [values]].
            //  [id, [values]].
            // ]
            const noteReqs = Object.entries(noteObj).map(([key, value]) => [
              parseNumberStrict(key),
              parseNumberStrict(value),
            ]);

            for (const [id, value] of noteReqs) {
              const noteIdx = notes.findIndex((note) => note.id === id);
              if (noteIdx === -1) {
                notes.push({ id: id, values: [value] });
              } else {
                notes[noteIdx].values.push(value);
              }
            }
          }
          level++;
          obj = bin[groupId + level.toString().padStart(2, "0")];
        }

        return { name, desc, params, notes };
      };

      const discItem = getJson("Item")[disc.Id];
      const name = getLangJson("Item")[discItem.Title];
      const desc = getLangJson("Item")[discItem.Literary];

      // Gather skills
      // 1st is melody, all subsequent are harmonies
      const main = getSkill(
        disc.MainSkillGroupId,
        getJson("MainSkill"),
        getLangJson("MainSkill"),
      );
      if (main === null)
        throw new Error(
          `Skill not found for ${disc.Id} at id ${disc.MainSkillGroupId}`,
        );

      let skills = [];
      skills.push(main);
      let level = 1;
      while (true) {
        const skillKey = `SecondarySkillGroupId${level++}`;
        if (!(skillKey in disc)) break;

        const skill = getSkill(
          disc[skillKey],
          getJson("SecondarySkill"),
          getLangJson("SecondarySkill"),
        );
        if (skill === null)
          throw new Error(
            `Skill not found for ${disc.Id} at id ${disc[skillKey]}`,
          );
        skills.push(skill);
      }

      return {
        id: disc.Id,
        name,
        desc,
        element: parseNumberStrict(disc.EET),
        // 1 ssr, 2 sr, 3 r
        rarity: discItem.Rarity,
        skills,
      };
    })
    .filter((disc) => disc !== null);
}

function generateDatabases() {
  const langs = [EN, JP, KR, CN, TW];
  let databases = [];
  fs.mkdirSync("./databases", { recursive: true });
  for (const lang of langs) {
    console.log(`Generating database for ${lang}...`);
    let database = {};
    setLang(lang);
    database.characters = getCharacters();
    database.discs = getDiscs();
    fs.writeFileSync(
      "./databases/database_" + lang + ".json",
      JSON.stringify(database, null, 2),
    );
    databases.push(database);
  }
  return databases;
}

export default generateDatabases;
