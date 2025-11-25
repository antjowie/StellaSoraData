import fetchImages from "./fetchImages.js";
import generateDatabases from "./generateDatabase.js";

const db = generateDatabases()[0];
await fetchImages(db);
