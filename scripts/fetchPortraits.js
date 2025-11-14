import fs from "fs";
import characterJson from "../EN/language/en_US/Character.json" with { type: "json" };
import ky from "ky";
import axios from "axios";
import sharp from "sharp";

const characters = Object.values(characterJson).filter((name) => name !== "???");

fs.mkdirSync("./portraits", { recursive: true });

const fetchPortraits = async () => {
  const promises = characters.map(async (character) => {
    const path = `./portraits/${character}.webp`;
    // Skip if file already exists
    if (fs.existsSync(path)) {
      return;
    }

    // Extract portrait URL
    const url = `https://stellasora.miraheze.org/wiki/File:${character}.png`;
    const html = await axios.get(url).then((response) => response.data);
    const regex = new RegExp(`<img[^>]+alt="File:${character}\\.png"[^>]+src="([^"]+)"`);
    const match = html.match(regex);
    if (!match) {
      console.error(`No image found for character ${character}`);
      throw new Error(`No image found for character ${character}`);
    }
    const imgUrl = match[1];

    // Download and save portrait
    const buffer = await ky("https:" + imgUrl).arrayBuffer();

    // Convert buffer to WebP
    await sharp(buffer)
      .webp()
      .toBuffer()
      .then((outputBuffer) => {
        fs.writeFileSync(path, outputBuffer);
      })
      .catch((err) => console.error("Error:", err));
  });

  await Promise.all(promises).then(() => {
    console.log("Portraits fetched successfully!");
  });
};

export default fetchPortraits;
