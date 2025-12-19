import generateDatabases from "./generateDatabase.js";
import fs from "fs";
import downloadFiles from "./downloader.js";
import extractFiles from "./extract.js";

const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf8"));
let promises: any = [generateDatabases()];
const res = await downloadFiles(manifest);
if (res.bHasChanges) {
  promises.push(extractFiles(res.dir));
}

await Promise.all(promises);
