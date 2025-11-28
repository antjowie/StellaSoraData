import generateDatabases from "./generateDatabase.js";
import fs from "fs";
import downloadFiles from "./downloader.js";
import extractFiles from "./extract.js";

let cache = JSON.parse(fs.readFileSync("./cache.json", "utf8"));
let promises: any = [generateDatabases()];
const res = await downloadFiles(cache.version);
if (res.version !== cache.version) {
  cache.version = res.version;
  extractFiles(res.dir);
  promises.push(downloadFiles(cache.version));
  fs.writeFileSync("./cache.json", JSON.stringify(cache));
}

await Promise.all(promises);
