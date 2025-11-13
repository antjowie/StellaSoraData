import fetchPortraits from "./fetchPortraits.js";
import generateDatabase from "./generateDatabase.js";

const promises = [fetchPortraits(), generateDatabase()];
await Promise.all(promises);
