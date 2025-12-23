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

type Manifest = {
  source: string;
  file: {
    path: "/AntiCheatExpert/ACE-BASE.sys";
    hash: "11638352398531338391";
    size: "4282536";
  }[];
};

async function getManifest(
  gameVersion: string,
  gamePath: string,
): Promise<Manifest> {
  const url = encodeURI(
    `/api/launcher/game/config/json?version=${gameVersion}&file_path=${gamePath}`,
  );
  const resUrl = await ax.get(url);
  const fileUrl = resUrl.data.data.url + "?nocache=" + Date.now();

  const res = await ax.get(fileUrl);
  return res.data;
}

async function getCDN(): Promise<{
  primary_cdn: "https://launcher-pkg-ss-en.yo-star.com";
  back_up_cdn: "https://launcher-pkg-ss-en-bk.yo-star.com";
}> {
  const res = await ax.get("/api/launcher/advanced/game/download/cdn");
  return res.data.data;
}

async function getData(): Promise<object> {
  const urls = [
    ["requestClientInfo", "/api/launcher/base/config"],
    ["requestBannerAndNews", "/api/launcher/operations/resource"],
    ["requestMedia", "/api/launcher/social/media/resource"],
    ["requestUpdateBackground", "/api/launcher/installation/config"],
    ["requestLogger", "/api/launcher/advanced/config"],
    ["requestLoggerConfig", "/api/open/api/config"],
  ];

  let data = {};
  for (const url of urls) {
    const res = await ax.get(url[1]);
    data[url[0]] = res.data.data;
  }
  return data;
}

async function downloadFiles(
  currentManifest: Manifest,
): Promise<{ bHasChanges: boolean; dir: string; manifest: Manifest }> {
  launcherVersion = await getLauncherVersion();
  console.log("Launcher version " + launcherVersion);

  // const cdn = await getCDN();
  // console.log("Primary CDN: " + cdn.primary_cdn);
  // console.log("Backup CDN: " + cdn.back_up_cdn);

  const gameInfo = await getGameInfo();
  console.log("Game version: " + gameInfo.game_latest_version);
  if (fs.existsSync(outDir) === false) fs.mkdirSync(outDir);
  fs.writeFileSync(
    path.join(outDir, "gameInfo.json"),
    JSON.stringify(gameInfo, null, 2),
  );
  const cdn = await getCDN();
  console.log(cdn.primary_cdn);
  console.log(cdn.back_up_cdn);
  fs.writeFileSync(
    path.join(outDir, "data.json"),
    JSON.stringify(await getData(), null, 2),
  );

  // Check which files to download
  const manifest = await getManifest(
    gameInfo.game_latest_version,
    gameInfo.game_latest_file_path,
  );

  const files = manifest.file.filter((file) => {
    // (path) => path.includes("icon-") || path.includes("char_2d_"),
    if (file.path.includes("icon-") === false) return false;
    const currentFile = currentManifest?.file?.find(
      (c) => c.path === file.path,
    );

    // We've already downloaded this file, check if it's changed
    if (currentFile !== undefined) {
      if (currentFile.hash === file.hash && currentFile.size === file.size)
        return false;
    }

    return true;
  });

  if (files.length === 0) {
    console.log("No changes detected.");
    return { bHasChanges: false, dir: outDir, manifest: currentManifest };
  }

  // We got new files to download
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.mkdirSync(outDir);
  let downloadedCount = 0;
  const totalFiles = files.length;
  console.log(`Starting download of ${totalFiles} files...`);

  let paths = files.map((file) => file.path);
  while (paths.length > 0) {
    const chunkSize = 5;
    const chunk = paths.splice(0, chunkSize);

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
        paths.push(icon);
      }
    });
    await Promise.all(promises);
  }

  console.log("All files downloaded successfully!");
  return { bHasChanges: true, dir: outDir, manifest };
}

export default downloadFiles;
