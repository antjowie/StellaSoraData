import generateDatabases from "./generateDatabase.ts";
import { databaseEn, warnings } from "./global.ts"
import fs, { existsSync, readFile, readFileSync, writeFileSync } from "fs";
import path from "path";
import downloadFiles from "./downloader.ts";
import extractFiles from "./extract.ts";
import ky from "ky";

const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf8"));
let promises: any = [generateDatabases()];
const res = await downloadFiles(manifest);
if (res.bHasChanges)
{
  promises.push(extractFiles(res.dir));
}

await Promise.all(promises);
// Get missing chars
// For now we will download from other sources until I proxy the ingame downloader
const charNames = [];
for (const char of databaseEn["characters"])
{
  const fileName = `head_${char.id}01_XL.webp`;
  if (existsSync(path.join(".", "portraits", fileName)))
  {
    continue;
  }
  
  const charName = char.name;
  const url = `https://stellasora.miraheze.org/wiki/File:${charName}.png`;
  const html = await ky(url).text();

  const regex = new RegExp(`<img[^>]+alt="File:${charName}\\.png"[^>]+src="([^"]+)"`);
  const match = html.match(regex);
  if (match) {
    const imgUrl = match[1];
    const filePath = path.join(".", "portraits", fileName);
    await ky("https:" + imgUrl)
      .arrayBuffer()
      .then((buffer) => {
        fs.writeFileSync(filePath, Buffer.from(buffer));
      })
      console.log("Downloaded " + charName);
      charNames.push(fileName);
  } else
  {
    console.error("Failed to download " + charName);
  }
}

if (charNames.length > 0)
{
  const manPath = path.join(".","portraits", "index.json");
  const manifest = JSON.parse(readFileSync(manPath, "utf8"));
  manifest.concat(charNames);
    writeFileSync(
    manPath,
    JSON.stringify([...new Set(manifest)]),
  );
}

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
