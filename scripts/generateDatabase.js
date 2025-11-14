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
import langItem from "../EN/language/en_US/Item.json" with { type: "json" };
import langPotential from "../EN/language/en_US/Potential.json" with { type: "json" };
import langCharacterDes from "../EN/language/en_US/CharacterDes.json" with { type: "json" };
import langUIText from "../EN/language/en_US/UIText.json" with { type: "json" };
import langSkill from "../EN/language/en_US/Skill.json" with { type: "json" };

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

    // Apply special text
    // Some descriptions contain the ##Lux Mark#1015# pattern. This pattern indicates a special text
    // 1015 is the ID and in game the text is adjusted in the following ways:
    //  - The text will be colored
    //  - The text will be underlined and can be pressed to open a popup
    //  - The ID will be replaced with an icon
    const patchSpecialText = (origText) => {
      const specialTextRegex = /##[^#]+#\d+#/g; // Match ##Lux Mark#1015#
      const idRegex = /#\d+#/g; // Match #1015#
      const textRegex = /##[^#]+#/g; // Match ##Lux Mark#

      const texts = origText.match(specialTextRegex);
      if (texts === null) return origText;

      let finalText = origText;
      for (const text of texts) {
        const id = text.match(idRegex)[0].slice(1, -1);
        if (!(id in binWord)) throw new Error(`Unknown special text ID: ${id}`);
        const word = binWord[id];

        finalText = finalText.replace(text, `<color=#${word.Color}>${text.match(textRegex)[0].slice(2, -1)}</color>`);
      }

      return finalText;
    };

    const descShort = patchSpecialText(langPotential[`Potential.${potentialId}.1`]);
    const descLong = patchSpecialText(langPotential[`Potential.${potentialId}.2`]);

    // Parse param values
    // NOTE: This approach is very brute forced with a ton of assumptions.
    // The grammer is actually quite straightforward, I just wanted to get something
    // workings. Atleast there should now be a valid test case to compare against
    // but if this ever breaks because the developers introduce new keywords
    // I would urge future me or whoever reads this to create a proper parser.
    /** @type {string[]} */
    const paramSet = new Set();
    const addParams = (desc) => {
      // Capture Param1 from &Param1&
      const params = desc.match(/(?<=&)\w+(?=&)/g);
      if (!params) return;
      params.forEach((param) => paramSet.add(param));
    };
    addParams(descShort);
    addParams(descLong);
    let params = [];
    for (const param of paramSet) {
      if (!(param in potential)) throw new Error(`Missing param value: ${param} for potential ${potentialId}`);

      let data = [];
      const paramValue = potential[param];
      const parts = paramValue.split(",");
      if (paramValue.startsWith("Effect,LevelUp,")) {
        if (parts.length < 4)
          throw new Error(`Too little parts in param value: ${paramValue} for potential ${potentialId}`);

        const key = parts[2];
        let valid = true;
        let index = 1;
        while (valid) {
          // 14412001 is key
          // 14412xx1 is id
          // xxxxx00x is level 0 (doesn't exist)
          // xxxxx01x is level 1 potential
          // xxxxx02x is level 2 potential
          let id = key.substring(0, key.length - 2);
          id += index;
          id += key[key.length - 1];
          index++;
          if (!(id in binEffectValue)) {
            valid = false;
            if (index < 10)
              throw new Error(
                `Level is too low for paramValue ${paramValue}. Tried id ${id}, likely an error ${potentialId}`,
              );
            break;
          }
          if (index > 99) throw new Error(`Can't go past 99 levels for potential ${potentialId}`);

          const effect = binEffectValue[id];
          const type = parts[3];
          if (!(type in effect)) throw new Error(`Missing type ${type} for potential ${potentialId}`);
          switch (type) {
            case "EffectTypeFirstSubtype":
              // EffectTypeFirstSubtype,Enum,EAT - is UIText.json and maps to a value
              const enumIdx = parseIntStrict(binEffectValue[id]["EffectTypeFirstSubtype"]);
              const textKey = `UIText.Enums_Effect_${enumIdx}.1`;
              if (!(textKey in langUIText))
                throw new Error(`Missing ${textKey} in langUIText for potential ${potentialId}`);
              data.push(langUIText[textKey]);
              break;
            case "EffectTypeParam1":
              const p1 = parseFloatStrict(binEffectValue[id]["EffectTypeParam1"]);
              data.push(roundIfDecimal(p1 * 100) + "%");
              break;
            case "EffectTypeParam3":
              const p3 = parseFloatStrict(binEffectValue[id]["EffectTypeParam1"]);
              data.push(p3 + "%");
              break;

            default:
              throw new Error(`Unknown effect type: ${type} for potential ${potentialId}`);
          }
        }
      } else if (paramValue.startsWith("OnceAdditionalAttribute,LevelUp,")) {
        if (parts.length < 4)
          throw new Error(`Too little parts in param value: ${paramValue} for potential ${potentialId}`);

        let valid = true;
        let index = 1;
        const key = parts[2];
        while (valid) {
          // 14412001 is key
          // 14412xx1 is id
          // xxxxx00x is level 0 (doesn't exist)
          // xxxxx01x is level 1 potential
          // xxxxx02x is level 2 potential
          let id = key.substring(0, key.length - 2);
          id += index;
          id += key[key.length - 1];
          index++;
          if (!(id in binOnceAdditionalAttributeValue)) {
            valid = false;
            if (index < 10)
              throw new Error(
                `Level is too low for paramValue ${paramValue}. Tried id ${id}, likely an error ${potentialId}`,
              );
            break;
          }
          if (index > 99) throw new Error(`Can't go past 99 levels for potential ${potentialId}`);
          const obj = binOnceAdditionalAttributeValue[id];
          const type = parts[3];
          if (!(type in obj))
            throw new Error(
              `Type ${type} not found for OnceAdditionalAttributeValue ${id} for potential ${potentialId}`,
            );
          switch (type) {
            case "AttributeType1":
            case "AttributeType2":
              const key = `UIText.Enums_Effect_${obj[type]}.1`;
              if (!(key in langUIText))
                throw new Error(`Key ${key} not found for langUIText ${id} for potential ${potentialId}`);

              data.push(langUIText[key]);
              break;
            case "Value1":
            case "Value2":
              const val = parseIntStrict(obj[type]);
              data.push(roundIfDecimal(val / 100) + "%");
              break;
            default:
              throw new Error(`Unknown type: ${type} for HitDamage ${id} for potential ${potentialId}`);
          }
        }
      } else if (paramValue.startsWith("Buff,LevelUp,")) {
        if (parts.length < 3)
          throw new Error(`Too little parts in param value: ${paramValue} for potential ${potentialId}`);
        const key = parts[2];
        const type = parts[3];
        let index = 1;
        let valid = true;
        while (valid) {
          // 10350701 is key
          // 103507X1 is id
          let id = key.substring(0, key.length - 2);
          id += index;
          id += key[key.length - 1];
          if (!(id in binBuffValue)) {
            valid = false;
            if (index < 10)
              throw new Error(
                `Level is too low for paramValue ${paramValue}. Tried id ${id}, likely an error ${potentialId}`,
              );
            break;
          }
          if (index > 9) throw new Error(`Can't go past 9 levels for Buff ${potentialId}`);
          index++;
          const obj = binBuffValue[id];
          switch (type) {
            case "Time":
              const time = parseIntStrict(obj["Time"]);
              data.push(String(time / 10000));
              break;
            case "LaminatedNum":
              const num = parseIntStrict(obj["LaminatedNum"]);
              data.push(String(num));
              break;
            default:
              throw new Error(`Unknown type: ${type} for Buff ${id} for potential ${potentialId}`);
          }
        }
      } else if (paramValue.startsWith("Shield,LevelUp,")) {
        if (parts.length < 3)
          throw new Error(`Too little parts in param value: ${paramValue} for potential ${potentialId}`);
        const key = parts[2];
        const type = parts[3];
        let index = 1;
        let valid = true;
        while (valid) {
          // 10742001 is key
          // 107420X1 is id
          let id = key.substring(0, key.length - 2);
          id += index;
          id += key[key.length - 1];
          if (!(id in binShieldValue)) {
            valid = false;
            if (index < 10)
              throw new Error(
                `Level is too low for paramValue ${paramValue}. Tried id ${id}, likely an error ${potentialId}`,
              );
            break;
          }
          if (index > 9) throw new Error(`Can't go past 9 levels for Shield ${potentialId}`);
          index++;
          const obj = binShieldValue[id];
          switch (type) {
            case "Time":
              const time = parseIntStrict(obj["Time"]);
              data.push(String(time / 10000));
              break;
            case "ReferenceScale":
              const scale = parseIntStrict(obj["ReferenceScale"]);
              data.push(roundIfDecimal(scale / 100) + "%");
              break;
            case "ShieldLaminatedNum":
              const shield = parseIntStrict(obj["ShieldLaminatedNum"]);
              data.push(String(shield));
              break;
            default:
              throw new Error(`Unknown type: ${type} for ShieldValue ${id} for potential ${potentialId}`);
          }
        }
      } else if (paramValue.startsWith("ScriptParameter,LevelUp,")) {
        if (parts.length < 3)
          throw new Error(`Too little parts in param value: ${paramValue} for potential ${potentialId}`);
        const key = parts[2];
        const type = parts[3];
        let index = 1;
        let valid = true;
        while (valid) {
          // 10730001 is key
          // 107300X1 is id
          let id = key.substring(0, key.length - 2);
          id += index;
          id += key[key.length - 1];
          if (!(id in binScriptParameterValue)) {
            valid = false;
            if (index < 10)
              throw new Error(
                `Level is too low for paramValue ${paramValue}. Tried id ${id}, likely an error ${potentialId}`,
              );
            break;
          }
          if (index > 9) throw new Error(`Can't go past 9 levels for ScriptParameter ${potentialId}`);
          index++;
          const obj = binScriptParameterValue[id];
          switch (type) {
            case "CommonData":
              const val = parseIntStrict(obj["CommonData"]);
              data.push(roundIfDecimal(val / 10000) + "%");
              break;
            default:
              throw new Error(`Unknown type: ${type} for ScriptParameter ${id} for potential ${potentialId}`);
          }
        }
      } else if (paramValue.startsWith("HitDamage,DamageNum,")) {
        if (parts.length < 3)
          throw new Error(`Too little parts in param value: ${paramValue} for potential ${potentialId}`);

        const id = parts[2];
        if (!(id in binHitDamage)) throw new Error(`Missing HitDamage ${id} for potential ${potentialId}`);

        const hitDamage = binHitDamage[id];
        // Assumption that SkillAbsAmend is always 0
        if (hitDamage["SkillAbsAmend"][0] !== 0)
          throw new Error(`SkillAbsAmend is not 0 for HitDamage ${id} for potential ${potentialId}`);

        const percentages = hitDamage["SkillPercentAmend"];
        for (let index = 0; index < percentages.length; index++) {
          const value = parseIntStrict(percentages[index]) / 10000;
          data.push(value + "%");
        }
      } else if (paramValue.startsWith("BuffValue,NoLevel,")) {
        if (parts.length < 4)
          throw new Error(`Too little parts in param value: ${paramValue} for potential ${potentialId}`);

        const id = parts[2];
        const type = parts[3];
        const obj = binBuffValue[id];
        if (!(type in obj))
          throw new Error(`BuffValue for type ${type} not found for HitDamage ${id} for potential ${potentialId}`);
        switch (type) {
          case "Time":
            const time = parseIntStrict(obj["Time"]);
            data.push(String(time / 10000));
            break;
          case "LaminatedNum":
            const num = parseIntStrict(obj["LaminatedNum"]);
            data.push(String(num));
            break;
          default:
            throw new Error(`Unknown type: ${type} for HitDamage ${id} for potential ${potentialId}`);
        }
      } else if (paramValue.startsWith("Skill,NoLevel")) {
        const id = parts[2];
        const type = parts[3];
        const obj = binSkill[id];
        if (!(type in obj)) throw new Error(`Type ${type} not found for Skill ${id} for potential ${potentialId}`);
        switch (type) {
          case "Title":
            const key = obj["Title"];
            if (!(key in langSkill))
              throw new Error(`Title ${key} not found for Skill ${id} for potential ${potentialId}`);
            data.push(langSkill[key]);
            break;
          default:
            throw new Error(`Unknown type: ${type} for Skill ${id} for potential ${potentialId}`);
        }
      } else if (paramValue.startsWith("OnceAdditionalAttributeValue,NoLevel")) {
        const id = parts[2];
        const type = parts[3];
        const obj = binOnceAdditionalAttributeValue[id];
        if (!(type in obj))
          throw new Error(`Type ${type} not found for OnceAdditionalAttributeValue ${id} for potential ${potentialId}`);
        switch (type) {
          case "Value1":
            data.push(roundIfDecimal(parseIntStrict(obj["Value1"]) / 100) + "%");
            break;
          case "AttributeType1":
            const key = `UIText.Enums_Effect_${obj["AttributeType1"]}.1`;
            if (!(key in langUIText))
              throw new Error(`Key ${key} not found for LangUIText ${id} for potential ${potentialId}`);
            data.push(langUIText[key]);
            break;
          default:
            throw new Error(
              `Unknown type: ${type} for OnceAdditionalAttributeValue ${id} for potential ${potentialId}`,
            );
        }
      } else if (paramValue.startsWith("EffectValue,NoLevel")) {
        const id = parts[2];
        const type = parts[3];
        const obj = binEffectValue[id];
        if (!(type in obj))
          throw new Error(`Type ${type} not found for EffectValue ${id} for potential ${potentialId}`);
        switch (type) {
          case "EffectTypeParam1":
            data.push(roundIfDecimal(parseFloatStrict(obj["EffectTypeParam1"]) * 100) + "%");
            break;
          case "EffectTypeParam2":
            data.push(String(parseFloatStrict(obj["EffectTypeParam2"])));
            break;
          case "EffectTypeParam3":
            data.push(parseFloatStrict(obj["EffectTypeParam3"]) + "%");
            break;
          case "EffectTypeFirstSubtype":
            const key = `UIText.Enums_Effect_${obj[type]}.1`;
            if (!(key in langUIText))
              throw new Error(`Key ${key} not found for langUIText ${id} for potential ${potentialId}`);

            data.push(langUIText[key]);
            break;
          default:
            throw new Error(`Unknown type: ${type} for EffectValue ${id} for potential ${potentialId}`);
        }
      } else if (paramValue.startsWith("ScriptParameterValue,NoLevel")) {
        const id = parts[2];
        const type = parts[3];
        const obj = binScriptParameterValue[id];
        if (!(type in obj))
          throw new Error(`Type ${type} not found for ScriptParameterValue ${id} for potential ${potentialId}`);
        switch (type) {
          case "CommonData":
            data.push(String(parseIntStrict(obj["CommonData"]) / 10000));
            break;
          default:
            throw new Error(`Unknown type: ${type} for ScriptParameterValue ${id} for potential ${potentialId}`);
        }
      } else if (paramValue.startsWith("ShieldValue,NoLevel")) {
        const id = parts[2];
        const type = parts[3];
        const obj = binShieldValue[id];
        if (!(type in obj))
          throw new Error(`Type ${type} not found for ShieldValue ${id} for potential ${potentialId}`);
        switch (type) {
          case "Time":
            data.push(String(parseIntStrict(obj["Time"]) / 10000));
            break;
          case "ReferenceScale":
            data.push(roundIfDecimal(parseIntStrict(obj["ReferenceScale"]) / 100) + "%");
            break;

          default:
            throw new Error(`Unknown type: ${type} for ScriptParameterValue ${id} for potential ${potentialId}`);
        }
      } else {
        throw new Error(`Unknown param value: ${paramValue} for potential ${potentialId}`);
      }

      params.push(data);
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
