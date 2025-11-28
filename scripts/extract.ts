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

let FROM = "F:/YostarGames/StellaSora_EN";
const TO = "./bundles";

async function extract(from: string) {
  if (existsSync(TO)) rmSync(TO, { recursive: true });
  if (existsSync("./assets")) rmSync("./assets", { recursive: true });
  if (existsSync("./extract")) rmSync("./extract", { recursive: true });
  let files: { [key: string]: string[] } = {};

  const to = join(TO, from.split("/").slice(1).join("/"));
  const patterns = [/icon-.*unity3d/];
  // const patterns = [/icon-.*unity3d/, /char_2d.*unity3d/];
  readdirSync(from, { recursive: true }).forEach((file) => {
    const match = patterns.some((pattern) => pattern.test(file));
    if (match) {
      const source = join(from, file);
      const destination = join(to, file);
      let dest_folder = destination;
      dest_folder = dest_folder.slice(0, dest_folder.lastIndexOf("/"));
      mkdirSync(dest_folder, { recursive: true });
      copyFileSync(source, destination);
    }
  });

  await new Promise<void>((resolve, reject) => {
    const assetStudioProcess = spawn("dotnet", [
      "./assetStudio/AssetStudioModCLI.dll",
      to,
      "-t",
      "tex2d",
      "-o",
      "extract",
      "--image-format",
      "webp",
      "--filter-by-name",
      // _XL is portrait, outfit_ is discs, but unfortunately we can't use
      // wildcards, so we get 9 images per disc instead of 1.
      "Potential,comic,_XL,outfit_",
    ]);

    assetStudioProcess.stdout.on("data", (data) => {
      console.log(data.toString());
    });

    assetStudioProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    assetStudioProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`AssetStudio exited with code ${code}`));
        return;
      }

      const folders = [
        { path: "assets/assetbundles/icon/potential", out: "potential-icons" },
        { path: "assets/assetbundles/icon/head", out: "portraits" },
        {
          path: "assets/assetbundles/icon/outfit",
          out: "discs",
          filter: /outfit_\d*.webp$/,
        },
        { path: "assets/assetbundles_en/icon/loading", out: "loading" },
      ];

      for (const folder of folders) {
        let localFiles: string[] = [];
        readdirSync("./extract/" + folder.path, { recursive: true }).forEach(
          (file) => {
            if (folder.filter && file.match(folder.filter) === null) {
              return;
            }
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

        for (const [key, value] of Object.entries(files)) {
          writeFileSync(
            key + "/index.json",
            JSON.stringify([...new Set(value)]),
          );
        }
      }

      console.log(from, "finished extraction.");
      resolve();
    });
  });
}

export default extract;

if (require.main === module) {
  extract(FROM);
}
