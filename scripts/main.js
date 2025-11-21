import fetchImages from "./fetchImages.js";
import generateDatabase from "./generateDatabase.js";

// const promises = [fetchImages(), generateDatabase()];
// await Promise.all(promises);
const db = generateDatabase();
await fetchImages(db);
