import {
  getJson,
  getLangJson,
  parseNumberStrict,
  roundIfDecimal,
} from "./global.js";

const processEnum = (value, fields) => {
  if (fields[1] !== "EAT")
    throw new Error("Expected EAT, unsupported value: " + fields[1]);

  const key = `UIText.Enums_Effect_${value}.1`;
  return getLangJson("UIText")[key];
};

const formatValue = (value, format) => {
  // Numerical ops
  if (format.includes("10K")) value /= 10000;
  if (format.includes("Hd")) value *= 100;

  // String ops
  value = String(roundIfDecimal(value));
  if (format.includes("Pct")) value += "%";
  return value;
};

const parserConfig = {
  // Examples of a param
  // "Param1": "EffectValue,NoLevel,10350711,EffectTypeParam1,HdPct",
  // "Param2": "Effect,LevelUp,10350703,EffectTypeParam1,HdPct",
  // "Param3": "Buff,LevelUp,10350701,Time,10K",
  // "Param4": "EffectValue,NoLevel,10350713,EffectTypeFirstSubtype,Enum,EAT",
  // "Param5": "Effect,LevelUp,10350703,EffectTypeFirstSubtype,Enum,EAT"
  // The first 3 elements are used to look up values
  // Everything after that is processing
  //
  // For Param 5 it would be
  // value: Whatever was in the json
  // fields: ["Enum","EAT"]
  // Types are the supported types (so Enum in this case) this way we can specify which types we've implemented
  // and if the developer introduces new types, we'll get errors to handle them

  // 1st level specifies response to category (the 1st value of a param)
  // 2nd level specifies response to format (4th value of a param)
  Default: {
    // Generic cases
    // Most of the values are numerical and can be parsed as such
    Default: {
      formats: ["Pct", "Hd", "10K", "Fixed"],
      process: (value, fields) => {
        return formatValue(parseNumberStrict(value), fields[0]);
      },
    },
    EffectTypeFirstSubtype: {
      formats: ["Enum"],
      process: processEnum,
    },
    AttributeType1: {
      formats: ["Enum"],
      process: processEnum,
    },
    AttributeType2: {
      formats: ["Enum"],
      process: processEnum,
    },
    Title: {
      formats: ["Text"],
      process: (value, fields) => {
        return getLangJson("Skill")[value];
      },
    },
  },
  // Some params don't have a 4th value. I've only seen it for HitDamage,DamageNum,xxxxxxx
  // so it's assumed that's the only case (There's an assert for it that checks HitDamage)
  HitDamage: {
    Default: {
      formats: ["10K"],
      process: (value, fields) => {
        // value is an object in HitDamage.json
        // Assumption that SkillAbsAmend is always 0. This obj is also used for bosses?
        // In any case, it's not always 0 so lets check for it
        if (value["SkillAbsAmend"][0] !== 0) {
          throw new Error(`SkillAbsAmend is not 0 for HitDamage ${id}`);
        }

        const percentages = value["SkillPercentAmend"];
        return percentages.map((percentage) => {
          // Normally we pass through filter and process 10K, but these values seem to ignore it...
          return parseNumberStrict(percentage) / 10000 + "%";
        });
      },
    },
  },
};

function generateLevelId(baseId, level) {
  const idWithoutLevel = baseId.substring(0, baseId.length - 2);
  const lastDigit = baseId[baseId.length - 1];
  return idWithoutLevel + level + lastDigit;
}

function processValue(id, fields, json, key, process) {
  let obj = json[id];
  if (key !== null) obj = obj[key];
  if (!obj)
    throw new Error(`Can't find value for ${id},${key},${fields.join(",")}`);
  return process(obj, fields.slice(1));
}

function processLevelUpValues(baseId, fields, json, key, process) {
  const data = [];
  let index = 1;
  let valid = true;

  while (valid) {
    const id = generateLevelId(baseId, index);

    if (id in json === false) {
      valid = false;
      if (index < 10) {
        throw new Error(
          `Level is too low for paramValue with base ID ${baseId}. Tried id ${id}`,
        );
      }
      break;
    }

    data.push(processValue(id, fields, json, key, process));
    index++;
  }

  return data;
}

function parseParam(param) {
  // EX: "Param1": "Shield,LevelUp,12354101,ReferenceScale,10KHdPct",
  const parts = param.split(",");
  const category = parts[0];
  const method = parts[1]; // LevelUp
  const id = parts[2]; // 12354101
  const fields = parts.slice(3); // ["ReferenceScale","10KHdPct"]

  try {
    // Get the processor
    let processor = parserConfig[category];
    if (!processor) processor = parserConfig.Default;
    let fieldProcessor = processor[fields[0]];
    if (!fieldProcessor) fieldProcessor = processor.Default;
    processor = fieldProcessor;

    const validateFormat = (format) => {
      // Check if we can exhaust all formats
      // The formats decide how the number should be interpeted
      for (const f of processor.formats) {
        format = format.replace(f, "");
      }
      if (format.length > 0)
        throw new Error(`Unsupported format ${fields[1]} for ${param}`);
    };

    let values;
    switch (method) {
      case "NoLevel":
        validateFormat(fields[1]);
        values = [
          processValue(
            id,
            fields,
            getJson(category),
            fields[0],
            processor.process,
          ),
        ];
        break;
      case "LevelUp":
        validateFormat(fields[1]);
        // LevelUp refers to category without Value
        // Not sure why, it seems to be some meta file but we
        // can get level info from the corresponding Value file
        values = [
          processLevelUpValues(
            id,
            fields,
            getJson(category + "Value"),
            fields[0],
            processor.process,
          ),
        ];
        break;
      case "DamageNum":
        // HitDamage,DamageNum,103502001
        // NOTE: Unlike others where field[0] matches the key in the bin json,
        // for this type there is no key, seems like it can be a sum of things in the obj
        validateFormat(fields[0] ?? "");
        values = [
          processValue(id, fields, getJson(category), null, processor.process),
        ];
        break;
      default:
        throw new Error(`Unknown method ${method} for ${param}`);
    }

    // Check for null values
    values = values.flat();
    if (values.some((value) => value === undefined)) {
      throw new Error(`Null value found for ${param}`);
    }
    return values;
  } catch (error) {
    console.error(`Failed to get value for ${param}`);
    throw error;
  }
}

export default parseParam;
