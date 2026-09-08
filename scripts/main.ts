import generateDatabases from "./generateDatabase.ts";
import { databaseEn, warnings } from "./global.ts";
import fs, { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import downloadFiles from "./downloader.ts";
import extractFiles from "./extract.ts";
import { Buffer } from "buffer";
import { chromium } from "playwright";

const manifest = existsSync(path.join(".", "manifest.json"))
  ? JSON.parse(fs.readFileSync("./manifest.json", "utf8"))
  : {};
let promises: any = [generateDatabases()];
const res = await downloadFiles(manifest);
if (res.bHasChanges) {
  promises.push(extractFiles(res.dir));
}

await Promise.all(promises);

if (res.bHasChanges) {
  fs.writeFileSync(
    path.join(".", "manifest.json"),
    JSON.stringify(res.manifest, null, 2),
  );
}

if (warnings.length > 0) {
  console.log(`Warnings detected (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(warning));
  console.log(
    `Printed ${warnings.length} warnings (on avg ${warnings.length / 6} per language)`,
  );
}

// Get missing chars
// For now we will download from other sources until I proxy the ingame downloader
const missingCharNames = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});
for (const char of databaseEn["characters"]) {
  const fileName = `head_${char.id}01_XL.webp`;
  if (existsSync(path.join(".", "portraits", fileName))) {
    continue;
  }

  const charName = char.name;
  const url = `https://stellasora.miraheze.org/wiki/File:${charName}.png`;
  const page = await context.newPage();
  const response = await page.goto(url);
  const html = await response?.text();

  const regex = new RegExp(
    `<img[^>]+alt="File:${charName}\\.png"[^>]+src="([^"]+)"`,
  );
  console.assert(html != undefined);
  const match = html.match(regex);
  if (match) {
    const imgUrl = match[1];
    const filePath = path.join(".", "portraits", fileName);
    const response = await page.goto(url);

    // Assumes 'page' has already been initialized earlier in your script
    try {
      // 1. Navigate directly to the image URL via the browser context
      const response = await page.goto("https:" + imgUrl, {
        waitUntil: "load",
      });

      // 2. Check if the response status is successful (status code 200-299)
      if (response && response.ok()) {
        // 3. Extract the raw network buffer from the browser response
        const buffer = await response.body();

        // 4. Write the binary data to your local file path
        fs.writeFileSync(filePath, buffer);

        console.log("Downloaded " + charName);
        missingCharNames.push(fileName);
      } else {
        console.error(
          `Failed to download ${charName} (Status: ${response?.status()})`,
        );
      }
    } catch (error) {
      // Catch network timeouts, 403 blocks, or navigation crashes
      console.error(`Failed to download ${charName} due to error:`, error);
    }
  } else {
    console.error("Failed to download " + charName);
  }
}
await browser.close();

if (missingCharNames.length > 0) {
  const manPath = path.join(".", "portraits", "index.json");
  const index = JSON.parse(readFileSync(manPath, "utf8"));
  writeFileSync(
    manPath,
    JSON.stringify([...new Set(index.concat(missingCharNames))]),
  );
}
