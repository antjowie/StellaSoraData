import generateDatabases from "./generateDatabase.ts";
import { warnings } from "./global.ts"
import fs from "fs";
import path from "path";
import downloadFiles from "./downloader.ts";
import extractFiles from "./extract.ts";

const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf8"));
let promises: any = [generateDatabases()];
const res = await downloadFiles(manifest);
if (res.bHasChanges)
{
  promises.push(extractFiles(res.dir));
}

await Promise.all(promises);

if (res.bHasChanges)
{
  fs.writeFileSync(
    path.join(".", "manifest.json"),
    JSON.stringify(res.manifest, null, 2),
  );
}

if (warnings.length > 0)
{
  console.log(`Warnings detected (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(warning));
}
