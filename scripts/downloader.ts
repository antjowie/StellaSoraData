import crypto from "crypto";
import axios from "axios";
import path from "path";
import fs from "fs";

const baseUrl = "https://api-launcher-en.yo-star.com";
const cdnUrl = "https://launcher-pkg-ss-en.yo-star.com";
const outDir = "./download";
let launcherVersion = "";

const ax = axios.create({
  timeout: 3e4,
  baseURL: baseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json;charset=UTF-8",
  },
});
ax.interceptors.request.use(
  (config) => {
    if (config.withCredentials) {
      config.headers["Authorization"] = createAuthHeader();
    } else {
      config.headers = new axios.AxiosHeaders({
        "Cache-Control": "no-cache",
      });
      config.withCredentials = false;
    }
    // console.log("Request sent:", (config.baseURL ?? "") + config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
ax.interceptors.response.use(
  (response) => {
    if (response.status !== 200) {
      throw new Error(`Request failed with status ${response.status}`);
    } else {
      // console.log(
      //   "Request succeeded:",
      //   response.status,
      //   (response.config.baseURL ?? "") + response.config.url,
      // );
    }
    return response;
  },
  (error) => {
    console.error(error.message);
    throw new Error("Failed to download url");
  },
);

async function getLauncherVersion(): Promise<string> {
  let res = await ax.get(
    "/install_pkg/game_launcher/StellaSora_EN/latest.yml",
    { baseURL: cdnUrl, withCredentials: false },
  );
  let yml = res.data;
  let version = yml.match(/version: (.*)/)?.[1];
  return version ?? "";
}

function createAuthHeader(): string {
  const salt = "DE7108E9B2842FD460F4777702727869";
  const head = {
    game_tag: "StellaSora_EN",
    time: Math.floor(Date.now() / 1000),
    version: launcherVersion,
  };
  const signStr = JSON.stringify(head) + salt;
  const sign = crypto.createHash("md5").update(signStr).digest("hex");
  return JSON.stringify({
    head,
    sign,
  });
}

async function getGameInfo(): Promise<{
  game_lowest_version: "1.2.0";
  game_latest_version: "1.2.0";
  game_latest_file_path: "prod/ZIP_TEMP/StellaSora_EN_TEMP/StellaSora_EN_1.2.0-game.zip";
  game_start_exe_name: "StellaSora";
  game_file_size: "";
  game_file_size_type: "";
  crc64: "";
  size: 0;
  file_url: "";
  decompression_size: "14.1GB";
  config_id: 0;
}> {
  const res = await ax.get("/api/launcher/game/config");
  return res.data.data;
}

async function getManifest(
  gameVersion: string,
  gamePath: string,
): Promise<{ source: string; file: any[] }> {
  const url = encodeURI(
    `/api/launcher/game/config/json?version=${gameVersion}&file_path=${gamePath}`,
  );
  const resUrl = await ax.get(url);
  const fileUrl = resUrl.data.data.url + "?nocache=" + Date.now();

  const res = await ax.get(fileUrl);
  return res.data;
}

async function getCDN(): Promise<{
  back_up_cdn: "https://launcher-pkg-ss-en-bk.yo-star.com";
  primary_cdn: "https://launcher-pkg-ss-en.yo-star.com";
}> {
  const res = await ax.get("/api/launcher/advanced/game/download/cdn");
  return res.data.data;
}

async function downloadFiles(
  gameVersion: string,
): Promise<{ dir: string; version: string }> {
  launcherVersion = await getLauncherVersion();
  console.log("Launcher version " + launcherVersion);

  // const cdn = await getCDN();
  // console.log("Primary CDN: " + cdn.primary_cdn);
  // console.log("Backup CDN: " + cdn.back_up_cdn);

  const gameInfo = await getGameInfo();
  console.log("Game version: " + gameInfo.game_latest_version);

  if (gameInfo.game_latest_version === gameVersion) {
    console.log("Game version is up to date, skipping download");
    return { dir: outDir, version: gameVersion };
  }

  const manifest = await getManifest(
    gameInfo.game_latest_version,
    gameInfo.game_latest_file_path,
  );

  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.mkdirSync(outDir);
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const paths = Object.values(manifest.file).map((file: any) => file.path);
  const files = paths.filter(
    (path) => path.includes("icon-"),
    // (path) => path.includes("icon-") || path.includes("char_2d_"),
  );

  let downloadedCount = 0;
  const totalFiles = files.length;
  console.log(`Starting download of ${totalFiles} files...`);

  while (files.length > 0) {
    const chunkSize = 5;
    const chunk = files.splice(0, chunkSize);

    const promises = chunk.map(async (icon) => {
      const url = encodeURI(manifest.source + icon);
      try {
        const res = await ax.get(url, {
          baseURL: cdnUrl,
          withCredentials: false,
          responseType: "arraybuffer",
        });

        const out = path.join(outDir, icon);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, res.data);

        downloadedCount++;
        console.log(`Downloaded ${downloadedCount}/${totalFiles} files`);
      } catch (error) {
        console.error(`Error downloading ${icon}, retrying: ${error.message}`);
        files.push(icon);
      }
    });
    await Promise.all(promises);
  }

  console.log("All files downloaded successfully!");
  return { dir: outDir, version: gameInfo.game_latest_version };
}

export default downloadFiles;
