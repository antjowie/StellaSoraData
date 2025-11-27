import { readFileSync } from "fs";

export const EN = "en";
export const JP = "jp";
export const KR = "kr";
export const CN = "cn";
export const TW = "tw";
// This needs to be set before using the parser by the caller
// Kinda bad to have it global but don't wanna pass it around atm
export let lang = "";
export let jsonCache = {};
export let jsonLangCache = {};

export function setLang(newLang: string) {
  lang = newLang;
}

export function getJson(json: string) {
  if (jsonCache[json] === undefined)
    jsonCache[json] = JSON.parse(readFileSync(`EN/bin/${json}.json`, "utf8"));
  if (jsonCache[json] === undefined)
    throw new Error(`Failed to load ${json}.json`);
  return jsonCache[json];
}

export function getLangJson(
  json: string,
  langOverride: string | undefined = undefined,
) {
  let path: string;
  let localLang = langOverride ?? lang;
  switch (localLang) {
    case EN:
      path = `EN/language/en_US/${json}.json`;
      break;
    case JP:
      path = `JP/language/ja_JP/${json}.json`;
      break;
    case KR:
      path = `KR/language/ko_KR/${json}.json`;
      break;
    case CN:
      path = `EN/language/zh_CN/${json}.json`;
      break;
    case TW:
      path = `TW/language/zh_TW/${json}.json`;
      break;
    default:
      throw new Error(`Unsupported language: ${localLang}`);
  }

  if (!jsonLangCache[path]) {
    jsonLangCache[path] = JSON.parse(readFileSync(path, "utf8"));
  }
  if (!jsonLangCache[path])
    throw new Error(`Failed to load language file: ${path}`);
  return jsonLangCache[path];
}

export function parseNumberStrict(value: any) {
  const result = parseFloat(value);
  if (isNaN(result)) {
    throw new Error(`Failed to parse integer: ${JSON.stringify(value)}`);
  }
  return result;
}

export function roundIfDecimal(num: number) {
  return Number.isInteger(num) ? num : Math.round(num * 10) / 10;
}
