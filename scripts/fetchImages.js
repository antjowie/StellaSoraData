import fs from "fs";
import ky from "ky";
import axios from "axios";
import sharp from "sharp";

async function downloadImage(name, path, placeholder) {
  {
    // Check skip conditions
    if (fs.existsSync(path)) {
      const buffer = fs.readFileSync(path);

      // Check if this is placeholder file
      const isPlaceholder =
        placeholder.length === buffer.length && placeholder.equals(buffer);
      if (isPlaceholder === false) {
        return;
      }
    }

    // Extract image URL
    const url = `https://stellasora.miraheze.org/wiki/File:${name.repeat(1).replaceAll(" ", "_")}.png`;
    let match;
    try {
      const html = await axios.get(url).then((response) => response.data);
      const altName = name
        .repeat(1)
        .replaceAll("&", "&amp;")
        .replaceAll("'", "&#039;");
      const regex = new RegExp(
        `<img[^>]+alt="File:${altName}.png"[^>]+src="([^"]+)"`,
      );
      match = html.match(regex);
      if (match === null) {
        throw new Error(
          `No image found at ${url} with regex "${regex.toString()}"`,
        );
      }
    } catch (error) {
      console.error(`Error fetching "${name}": ${error.message}`);
      fs.writeFileSync(path, placeholder);
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
      .catch((err) => console.error("Error converting to WebP:", err));
  }
}

const fetchImages = async (database) => {
  const characters = database.characters.map((character) => character.name);
  const discs = database.discs.map((disc) => disc.name);

  const portraitPlaceholder = fs.readFileSync("./portraits/Placeholder.webp");
  const discPlaceholder = fs.readFileSync("./discs/Placeholder.webp");

  let promises = characters.map((name) =>
    downloadImage(name, `./portraits/${name}.webp`, portraitPlaceholder),
  );
  promises = promises.concat(
    discs.map((name) =>
      downloadImage("Disc " + name, `./discs/${name}.webp`, discPlaceholder),
    ),
  );

  await Promise.all(promises).then(() => {
    console.log("Images fetched successfully!");
  });
};

export default fetchImages;
