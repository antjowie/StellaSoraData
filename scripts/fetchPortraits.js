import fs from "fs";
import characterJson from "../EN/language/en_US/Character.json" with { type: "json" };
import ky from "ky";
import axios from "axios";
import sharp from "sharp";

const characters = Object.values(characterJson).filter((name) => name !== "???");

fs.mkdirSync("./portraits", { recursive: true });
const placeholderBuffer = fs.readFileSync("./portraits/Placeholder.webp");

const fetchPortraits = async () => {
  const promises = characters.map(async (character) => {
    const path = `./portraits/${character}.webp`;
    // Check skip conditions
    if (fs.existsSync(path)) {
      const buffer = fs.readFileSync(path);

      // Check if this is placeholder file
      const isPlaceholder = placeholderBuffer.length === buffer.length && placeholderBuffer.equals(buffer);
      if (isPlaceholder === false) {
        return;
      }
    }

    // Extract portrait URL
    let match;
    try {
      const url = `https://stellasora.miraheze.org/wiki/File:${character}.png`;
      const html = await axios.get(url).then((response) => response.data);
      const regex = new RegExp(`<img[^>]+alt="File:${character}\\.png"[^>]+src="([^"]+)"`);
      match = html.match(regex);
      if (match === null) {
        throw new Error(`No image found for character ${character} found at ${url}`);
      }
    } catch (error) {
      console.error(`Error fetching portrait for character ${character}: ${error.message}`);
      fs.writeFileSync(path, placeholderBuffer);
      return;
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
