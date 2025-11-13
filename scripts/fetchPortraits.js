import fs from "fs";
import characterJson from "../EN/language/en_US/Character.json" with { type: "json" };
import ky from "ky";
import axios from "axios";

const characters = Object.values(characterJson).filter((name) => name !== "???");

fs.mkdirSync("./portraits", { recursive: true });

const fetchPortraits = async () => {
  const promises = characters.map(async (character) => {
    const url = `https://stellasora.miraheze.org/wiki/File:${character}.png`;
    const html = await axios.get(url).then((response) => response.data);

    const regex = new RegExp(`<img[^>]+alt="File:${character}\\.png"[^>]+src="([^"]+)"`);
    const match = html.match(regex);
    if (!match) {
      console.error(`No image found for character ${character}`);
      throw new Error(`No image found for character ${character}`);
    }
    const imgUrl = match[1];

    const path = `./portraits/${character}.png`;
    const buffer = await ky("https:" + imgUrl).arrayBuffer();
    fs.writeFileSync(path, Buffer.from(buffer));
  });

  await Promise.all(promises)
    .catch((error) => {
      console.error("Error fetching portraits:", error);
    })
    .then(() => {
      console.log("Portraits fetched successfully!");
    });
};

export default fetchPortraits;
