import fs from "fs";
import binCharacter from "../EN/bin/Character.json" with { type: "json" };
import binItem from "../EN/bin/Item.json" with { type: "json" };
import binPotential from "../EN/bin/Potential.json" with { type: "json" };
import binCharPotential from "../EN/bin/CharPotential.json" with { type: "json" };
import binEffectValue from "../EN/bin/EffectValue.json" with { type: "json" };
import binHitDamage from "../EN/bin/HitDamage.json" with { type: "json" };
import binBuffValue from "../EN/bin/BuffValue.json" with { type: "json" };
import binOnceAdditionalAttributeValue from "../EN/bin/OnceAdditionalAttributeValue.json" with { type: "json" };
import binScriptParameterValue from "../EN/bin/ScriptParameterValue.json" with { type: "json" };
import binWord from "../EN/bin/Word.json" with { type: "json" };
import binSkill from "../EN/bin/Skill.json" with { type: "json" };
import binShieldValue from "../EN/bin/ShieldValue.json" with { type: "json" };
import binDisc from "../EN/bin/Disc.json" with { type: "json" };
import binMainSkill from "../EN/bin/MainSkill.json" with { type: "json" };
import binSecondarySkill from "../EN/bin/SecondarySkill.json" with { type: "json" };
import langItem from "../EN/language/en_US/Item.json" with { type: "json" };
import langPotential from "../EN/language/en_US/Potential.json" with { type: "json" };
import langCharacterDes from "../EN/language/en_US/CharacterDes.json" with { type: "json" };
import langUIText from "../EN/language/en_US/UIText.json" with { type: "json" };
import langSkill from "../EN/language/en_US/Skill.json" with { type: "json" };
import langMainSkill from "../EN/language/en_US/MainSkill.json" with { type: "json" };
import langSecondarySkill from "../EN/language/en_US/SecondarySkill.json" with { type: "json" };

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

/**
 * Parses a string to an float, throwing an error if it fails.
 * @param {*} value - The value to parse.
 * @param {string} context - Optional context for the error message.
 * @returns {number} The parsed float.
 */
function parseFloatStrict(value, context) {
  const result = parseFloat(value);
  if (isNaN(result)) {
    const contextMsg = context ? ` (${context})` : "";
    throw new Error(`Failed to parse float: ${value}${contextMsg}`);
  }
  return result;
}

function roundIfDecimal(num) {
  return Number.isInteger(num) ? num : Math.round(num * 10) / 10;
}

/**
 * Extract all &ParamX& as ParamX from a string and return them
 * @type {string[]}
 */
function getParams(text) {
  return text.match(/(?<=&)\w+(?=&)/g) ?? [];
}

// Patch descriptions
// Apply special text
// Some descriptions contain the ##Lux Mark#1015# pattern. This pattern indicates a special text
// 1015 is the ID and in game the text is adjusted in the following ways:
//  - The text will be colored
//  - The text will be underlined and can be pressed to open a popup
//  - The ID will be replaced with an icon
function patchDescription(origText) {
  const specialTextRegex = /##[^#]+#\d+#/g; // Match ##Lux Mark#1015#
  const idRegex = /#\d+#/g; // Match #1015#
  const textRegex = /##[^#]+#/g; // Match ##Lux Mark#

  const texts = origText.match(specialTextRegex);
  let finalText = origText;

  if (texts !== null) {
    for (const text of texts) {
      const id = text.match(idRegex)[0].slice(1, -1);
      if (!(id in binWord)) throw new Error(`Unknown special text ID: ${id}`);
      const word = binWord[id];

      finalText = finalText.replace(
        text,
        `<color=#${word.Color}>${text.match(textRegex)[0].slice(2, -1)}</color>`,
      );
    }
  }

  // Replace all color tags with span tags (valid html)
  finalText = finalText.replace(
    /<color=#([0-9A-Fa-f]{6})>(.*?)<\/color>/g,
    '<span style="color:#$1">$2</span>',
  );

  return finalText.replace(/\u000b/g, "\n");
}

/**
 * Data-driven parameter parser configuration
 * Each parameter type has a configuration defining how to parse it
 */
const PARAM_PARSER_CONFIG = {
  // Effect parameters with level progression
  "Effect,LevelUp": {
    dataStore: binEffectValue,
    maxLevel: 99,
    fieldProcessors: {
      EffectTypeFirstSubtype: (value, parts) => {
        const enumIdx = parseIntStrict(value);
        const textKey = `UIText.Enums_Effect_${enumIdx}.1`;
        if (!(textKey in langUIText)) {
          throw new Error(
            `Missing ${textKey} in langUIText for potential ${potentialId}`,
          );
        }
        return langUIText[textKey];
      },
      EffectTypeParam1: (value, parts) => {
        const p1 = parseFloatStrict(value);
        return (
          roundIfDecimal(p1 * (parts[4]?.includes("HdPct") ? 100 : 1)) + "%"
        );
      },
      EffectTypeParam3: (value, parts) => {
        return parseFloatStrict(value) + "%";
      },
    },
  },

  // OnceAdditionalAttribute parameters with level progression
  "OnceAdditionalAttribute,LevelUp": {
    dataStore: binOnceAdditionalAttributeValue,
    maxLevel: 99,
    fieldProcessors: {
      AttributeType1: (value, parts) => {
        const key = `UIText.Enums_Effect_${value}.1`;
        if (!(key in langUIText)) {
          throw new Error(
            `Key ${key} not found in langUIText for potential ${potentialId}`,
          );
        }
        return langUIText[key];
      },
      AttributeType2: (value, parts) => {
        const key = `UIText.Enums_Effect_${value}.1`;
        if (!(key in langUIText)) {
          throw new Error(
            `Key ${key} not found in langUIText for potential ${potentialId}`,
          );
        }
        return langUIText[key];
      },
      Value1: (value, parts) => {
        const val = parseIntStrict(value);
        return roundIfDecimal(val / 100) + "%";
      },
      Value2: (value, parts) => {
        const val = parseIntStrict(value);
        return roundIfDecimal(val / 100) + "%";
      },
    },
  },

  // Buff parameters with level progression
  "Buff,LevelUp": {
    dataStore: binBuffValue,
    maxLevel: 9,
    fieldProcessors: {
      Time: (value, parts) => {
        const time = parseIntStrict(value);
        return String(time / 10000);
      },
      LaminatedNum: (value, parts) => {
        return String(parseIntStrict(value));
      },
    },
  },

  // Shield parameters with level progression
  "Shield,LevelUp": {
    dataStore: binShieldValue,
    maxLevel: 9,
    fieldProcessors: {
      Time: (value, parts) => {
        const time = parseIntStrict(value);
        return String(time / 10000);
      },
      ReferenceScale: (value, parts) => {
        const scale = parseIntStrict(value);
        return roundIfDecimal(scale / 100) + "%";
      },
      ShieldLaminatedNum: (value, parts) => {
        return String(parseIntStrict(value));
      },
    },
  },

  // ScriptParameter parameters with level progression
  "ScriptParameter,LevelUp": {
    dataStore: binScriptParameterValue,
    maxLevel: 9,
    fieldProcessors: {
      CommonData: (value, parts) => {
        const val = parseIntStrict(value);
        return roundIfDecimal(val / 10000) + "%";
      },
    },
  },

  // NoLevel parameters (static values without progression)
  "HitDamage,DamageNum": {
    customHandler: (parts) => {
      const id = parts[2];
      if (!(id in binHitDamage)) {
        throw new Error(`Missing HitDamage ${id} for potential ${potentialId}`);
      }

      const hitDamage = binHitDamage[id];

      // Assumption that SkillAbsAmend is always 0
      if (hitDamage["SkillAbsAmend"][0] !== 0) {
        throw new Error(
          `SkillAbsAmend is not 0 for HitDamage ${id} for potential ${potentialId}`,
        );
      }

      const percentages = hitDamage["SkillPercentAmend"];
      return percentages.map((value) => {
        return parseIntStrict(value) / 10000 + "%";
      });
    },
  },

  // BuffValue without level progression
  "BuffValue,NoLevel": {
    dataStore: binBuffValue,
    noLevel: true,
    fieldProcessors: {
      Time: (value, parts) => {
        const time = parseIntStrict(value);
        return String(time / 10000);
      },
      LaminatedNum: (value, parts) => {
        return String(parseIntStrict(value));
      },
    },
  },

  // Skill without level progression
  "Skill,NoLevel": {
    dataStore: binSkill,
    noLevel: true,
    fieldProcessors: {
      Title: (value, parts) => {
        const key = value;
        if (!(key in langSkill)) {
          throw new Error(
            `Title ${key} not found for potential ${potentialId}`,
          );
        }
        return langSkill[key];
      },
    },
  },

  // OnceAdditionalAttributeValue without level progression
  "OnceAdditionalAttributeValue,NoLevel": {
    dataStore: binOnceAdditionalAttributeValue,
    noLevel: true,
    fieldProcessors: {
      Value1: (value, parts) => {
        return roundIfDecimal(parseIntStrict(value) / 100) + "%";
      },
      AttributeType1: (value, parts) => {
        const key = `UIText.Enums_Effect_${value}.1`;
        if (!(key in langUIText)) {
          throw new Error(
            `Key ${key} not found in langUIText for potential ${potentialId}`,
          );
        }
        return langUIText[key];
      },
    },
  },

  // EffectValue without level progression
  "EffectValue,NoLevel": {
    dataStore: binEffectValue,
    noLevel: true,
    fieldProcessors: {
      EffectTypeParam1: (value, parts) => {
        const p1 = parseFloatStrict(value);
        return (
          roundIfDecimal(p1 * (parts[4]?.includes("HdPct") ? 100 : 1)) + "%"
        );
      },
      EffectTypeParam2: (value, parts) => {
        return String(parseFloatStrict(value));
      },
      EffectTypeParam3: (value, parts) => {
        return parseFloatStrict(value) + "%";
      },
      EffectTypeFirstSubtype: (value, parts) => {
        const key = `UIText.Enums_Effect_${value}.1`;
        if (!(key in langUIText)) {
          throw new Error(
            `Key ${key} not found in langUIText for potential ${potentialId}`,
          );
        }
        return langUIText[key];
      },
    },
  },

  // ScriptParameterValue without level progression
  "ScriptParameterValue,NoLevel": {
    dataStore: binScriptParameterValue,
    noLevel: true,
    fieldProcessors: {
      CommonData: (value, parts) => {
        const val = parseIntStrict(value);
        return String(val / 10000);
      },
    },
  },

  // ShieldValue without level progression
  "ShieldValue,NoLevel": {
    dataStore: binShieldValue,
    noLevel: true,
    fieldProcessors: {
      Time: (value, parts) => {
        const time = parseIntStrict(value);
        return String(time / 10000);
      },
      ReferenceScale: (value, parts) => {
        const scale = parseIntStrict(value);
        return roundIfDecimal(scale / 100) + "%";
      },
    },
  },
};

/**
 * Helper function for generating level-based IDs
 * Takes a base ID and generates the ID for a specific level
 * @param {string} baseId - The base ID (e.g., "90013001")
 * @param {number} level - The level to generate the ID for
 * @returns {string} The generated ID for the specified level
 */
function generateLevelId(baseId, level) {
  // Extract the base part (without the last two digits)
  const idWithoutLevel = baseId.substring(0, baseId.length - 2);
  // Get the last digit
  const lastDigit = baseId[baseId.length - 1];

  // Construct the new ID with the level
  return idWithoutLevel + level + lastDigit;
}

/**
 * Common function for processing level-up parameters
 * Iterates through levels and processes each level's data
 * @param {string} baseId - The base ID for the parameter
 * @param {Object} dataStore - The data store containing the parameter values
 * @param {Function} processValue - Function to process each value
 * @param {number} maxLevel - Maximum level to process
 * @returns {Array} Array of processed values for each level
 */
function processLevelUpValues(baseId, dataStore, processValue, maxLevel) {
  const data = [];
  let index = 1;
  let valid = true;

  while (valid) {
    const id = generateLevelId(baseId, index);

    if (!(id in dataStore)) {
      valid = false;
      if (index < 10) {
        throw new Error(
          `Level is too low for paramValue with base ID ${baseId}. Tried id ${id}, likely an error ${potentialId}`,
        );
      }
      break;
    }

    if (index > maxLevel) {
      throw new Error(
        `Can't go past ${maxLevel} levels for potential ${potentialId}`,
      );
    }

    const value = dataStore[id];
    data.push(processValue(value));
    index++;
  }

  return data;
}

/**
 * Main parameter parsing function
 * Uses a data-driven approach to determine how to parse each parameter
 * @param {string} paramValue - The parameter value to parse
 * @returns {Array} Array of parsed values
 */
function parseParam(paramValue) {
  // Split the parameter into its components
  const parts = paramValue.split(",");

  // Determine the parameter type key (e.g., "Effect,LevelUp")
  const paramTypeKey = parts.slice(0, 2).join(",");

  // Get the parser configuration for this parameter type
  const parserConfig = PARAM_PARSER_CONFIG[paramTypeKey];

  if (!parserConfig) {
    throw new Error(
      `Unknown param value: ${paramValue} for potential ${potentialId}`,
    );
  }

  // Handle custom handlers (for special cases)
  if (parserConfig.customHandler) {
    return parserConfig.customHandler(parts);
  }

  // Extract the ID and field type
  const id = parts[2];
  const fieldType = parts[3];

  // Check if we have a processor for this field type
  const fieldProcessor = parserConfig.fieldProcessors[fieldType];
  if (!fieldProcessor) {
    throw new Error(
      `Unknown field type ${fieldType} for parameter type ${paramTypeKey} for potential ${potentialId}`,
    );
  }

  // Handle NoLevel parameters (static values)
  if (parserConfig.noLevel) {
    const value = parserConfig.dataStore[id];
    if (!value || !(fieldType in value)) {
      throw new Error(
        `Field ${fieldType} not found in ${paramTypeKey} with ID ${id} for potential ${potentialId}`,
      );
    }
    return [fieldProcessor(value[fieldType], parts)];
  }

  // Handle LevelUp parameters (progressive values)
  return processLevelUpValues(
    id,
    parserConfig.dataStore,
    (value) => {
      if (!value || !(fieldType in value)) {
        throw new Error(
          `Field ${fieldType} not found in ${paramTypeKey} with ID ${id} for potential ${potentialId}`,
        );
      }
      return fieldProcessor(value[fieldType], parts);
    },
    parserConfig.maxLevel || 99,
  );
}

function getCharacters() {
  let data = [];
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
    Object.values(data.MasterSpecificPotentialIds).forEach((id) =>
      result.type1.push(parseIntStrict(id)),
    );
    Object.values(data.MasterNormalPotentialIds).forEach((id) =>
      result.type1.push(parseIntStrict(id)),
    );
    Object.values(data.AssistSpecificPotentialIds).forEach((id) =>
      result.type2.push(parseIntStrict(id)),
    );
    Object.values(data.AssistNormalPotentialIds).forEach((id) =>
      result.type2.push(parseIntStrict(id)),
    );
    Object.values(data.CommonPotentialIds).forEach((id) =>
      result.type3.push(parseIntStrict(id)),
    );

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
      throw new Error(
        `Unknown potential type. stype: ${stype} rarity: ${typeRarity}`,
      );
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
      langPotential[`Potential.${potentialId}.1`],
    );
    const descLong = patchDescription(
      langPotential[`Potential.${potentialId}.2`],
    );

    let paramStrings = getParams(descShort);
    paramStrings = [...paramStrings, ...getParams(descLong)];
    paramStrings = new Set(paramStrings);
    let params = [];
    for (const param of paramStrings) {
      if (!(param in potential))
        throw new Error(
          `Missing param value: ${param} for potential ${potentialId}`,
        );

      const paramValue = potential[param];
      const paramIdx = parseIntStrict(param.slice("Param".length));
      params.push({ idx: paramIdx, values: parseParam(paramValue) });
    }

    charToPotentials.get(charId).push({
      id: potentialId,
      name: langItem[`Item.${potentialId}.1`],
      descShort: descShort,
      descLong: descLong,
      rarity: rarity,
      build: potential.Build,
      type: type,
      params,
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
      rarity: parseIntStrict(charData.Grade),
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
    data.push(character);
  }
  return data;
}

function getDiscs() {
  return Object.values(binDisc)
    .map((disc) => {
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

        const paramsStrings = getParams(desc);
        let params = [];
        let notes = [];
        for (const [i, param] of paramsStrings.entries()) {
          params.push({
            idx: parseIntStrict(param.slice("Param".length)),
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
            notes.push(
              Object.entries(noteObj).map(([key, value]) => [
                parseIntStrict(key),
                parseIntStrict(value),
              ]),
            );
          }
          level++;
          obj = bin[groupId + level.toString().padStart(2, "0")];
        }

        return { name, desc, params, notes };
      };

      const discItem = binItem[disc.Id];
      const name = langItem[discItem.Title];
      if (name === "???") return null;
      const desc = langItem[discItem.Literary];

      // Gather skills
      // 1st is melody, all subsequent are harmonies
      const main = getSkill(disc.MainSkillGroupId, binMainSkill, langMainSkill);
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
          binSecondarySkill,
          langSecondarySkill,
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
        element: parseIntStrict(disc.EET),
        // 1 ssr, 2 sr, 3 r
        rarity: discItem.Rarity,
        skills,
      };
    })
    .filter((disc) => disc !== null);
}

function generateDatabase() {
  let database = {};
  database.characters = getCharacters();
  database.discs = getDiscs();
  // fs.writeFileSync("./database.json", JSON.stringify(database));
  fs.writeFileSync("./database.json", JSON.stringify(database, null, 2));
  return database;
}

export default generateDatabase;
