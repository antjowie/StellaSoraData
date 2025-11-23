import { existsSync, rmSync, mkdirSync, readdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";

const from = "F:/YostarGames/StellaSora_EN/Persistent_Store/AssetBundles";
const to = "./bundles";

const patterns = [/^icon-.*\.unity3d$/];

if (existsSync(to)) {
  rmSync(to, { recursive: true });
}
mkdirSync(to, { recursive: true });
readdirSync(from).forEach((file) => {
  const match = patterns.find((pattern) => pattern.test(file));
  if (match) {
    const source = join(from, file);
    const destination = join(to, file);
    copyFileSync(source, destination);
  }
});

if (existsSync("./extract")) {
  rmSync("./extract", { recursive: true });
}
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

  console.log("Texture extraction completed successfully");

  // Copy only assets we need (moved inside process close event)
  const folders = [
    { path: "assets/assetbundles/icon/potential", out: "potential-icons" },
  ];

  if (existsSync("./assets")) {
    rmSync("./assets", { recursive: true });
  }
  for (const folder of folders) {
    readdirSync("./extract/" + folder.path, { recursive: true }).forEach(
      (file) => {
        const source = join("./extract", folder.path, file);
        const destination = join(folder.out, file);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(source, destination);
      },
    );
  }
});
