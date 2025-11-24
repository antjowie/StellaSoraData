import {
  existsSync,
  rmSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";

let FROM = [
  "F:/YostarGames/StellaSora_EN/Persistent_Store/AssetBundles",
  "F:/YostarGames/StellaSora_EN/StellaSora_Data/StreamingAssets/InstallResource",
];
const TO = "./bundles";

if (existsSync(TO)) rmSync(TO, { recursive: true });
if (existsSync("./assets")) rmSync("./assets", { recursive: true });
if (existsSync("./extract")) rmSync("./extract", { recursive: true });
let files = {};

async function process(from) {
  const to = join(TO, from.split("/").slice(1).join("/"));
  mkdirSync(to, { recursive: true });
  const patterns = [/^icon-.*\.unity3d$/];
  readdirSync(from).forEach((file) => {
    const match = patterns.find((pattern) => pattern.test(file));
    if (match) {
      const source = join(from, file);
      const destination = join(to, file);
      copyFileSync(source, destination);
    }
  });

  const assetStudioProcess = spawn(`dotnet`, [
    "./assetStudio/AssetStudioModCLI.dll",
    to,
    "-t",
    "tex2d",
    "-o",
    "extract",
    "--image-format",
    "webp",
  ]);

  assetStudioProcess.stdout.on("data", (data) => {
    console.log(data.toString());
  });

  assetStudioProcess.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  assetStudioProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`AssetStudio exited with code ${code}`);
      return;
    }

    const folders = [
      { path: "assets/assetbundles/icon/potential", out: "potential-icons" },
    ];

    let localFiles = [];
    for (const folder of folders) {
      readdirSync("./extract/" + folder.path, { recursive: true }).forEach(
        (file) => {
          const source = join("./extract", folder.path, file);
          const destination = join(folder.out, file);
          mkdirSync(dirname(destination), { recursive: true });
          copyFileSync(source, destination);
          localFiles.push(file);
        },
      );
      if (!(folder.out in files)) {
        files[folder.out] = [];
      }
      files[folder.out].push(...localFiles);
    }

    console.log(from, "finished extraction.");
  });
}

const promises = [FROM.map((entry) => process(entry))];
await Promise.all(promises);
for (const [key, value] of Object.entries(files)) {
  writeFileSync(key + "/index.json", JSON.stringify([...new Set(value)]));
}
