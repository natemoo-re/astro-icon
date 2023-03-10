import { getIcons } from "@iconify/utils";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import {
  importDirectory,
  cleanupSVG,
  runSVGO,
  parseColors,
  isEmptyColor,
} from "@iconify/tools";
import { writeFile } from "node:fs/promises";

/** @returns {import('astro').AstroIntegration} */
export default function icon(opts = {}) {
  return {
    name: "astro-icon",
    hooks: {
      async "astro:config:setup"({ updateConfig, command, config }) {
        updateConfig({
          vite: {
            plugins: [await getVitePlugin(opts, { command, output: config.output, root: config.root })],
          },
        });
      },
    },
  };
}

/** @returns {import('vite').Plugin} */
async function getVitePlugin({ include = {} }, { command, root }) {
  const virtualModuleId = "virtual:astro-icon";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  // let collections = [];
  // const possibleCollections = Object.keys(await lookupCollections());
  // const invalidCollections = Object.keys(include).filter(name => !possibleCollections.includes(name));
  // for (const invalidCollection of invalidCollections) {
  //   console.error(`[astro-icon] "${invalidCollection}" does not appear to be a valid iconify collection!`);
  // }
  const fullCollections = await Promise.all(
    Object.keys(include).map((collection) =>
      loadCollectionFromFS(collection).then((value) => [collection, value])
    )
  );
  collections = fullCollections.map(([name, icons]) => {
    const reduced = include[name];
    if (reduced.length === 1 && reduced[0] === "*") return icons;
    return getIcons(icons, reduced);
  });

  return {
    name: "astro-icon",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const local = await importDirectory("src/icons", {
          prefix: "local",
        });

        await local.forEach(async (name, type) => {
          if (type !== "icon") {
            return;
          }

          const svg = local.toSVG(name);
          if (!svg) {
            // Invalid icon
            local.remove(name);
            return;
          }

          try {
            await cleanupSVG(svg);

            if (await isMonochrome(svg)) {
              await normalizeColors(svg);
            }

            runSVGO(svg);
          } catch (err) {
            // Invalid icon
            console.error(`Error parsing ${name}:`, err);
            local.remove(name);
            return;
          }

          // Update icon
          local.fromSVG(name, svg);
        });
        collections.unshift(local.export())
        await writeFile(new URL('./.astro/icon.d.ts', root), `declare module 'astro-icon' {
	type Icon = ${collections.map(collection => Object.keys(collection.icons).map(icon => `\n\t\t| "${collection.prefix === 'local' ? '' : `${collection.prefix}:`}${icon}"`)).flat(1).join("")};
}`)

        return `import.meta.glob('/src/icons/**/*.svg');

        export default ${JSON.stringify(
          collections
        )};\nexport const config = ${command === "dev" ? JSON.stringify({ include }) : "undefined"
          }`;
      }
    },
  };
}

function normalizeColors(svg) {
  return parseColors(svg, {
    defaultColor: "currentColor",
    callback: (_, colorStr, color) => {
      return !color || isEmptyColor(color) || isWhite(color)
        ? colorStr
        : "currentColor";
    },
  });
}

async function isMonochrome(svg) {
  let monochrome = true;
  await parseColors(svg, {
    defaultColor: "currentColor",
    callback: (_, colorStr, color) => {
      if (!monochrome) return colorStr;
      monochrome = !color || isEmptyColor(color) || isWhite(color) || isBlack(color);
      return colorStr;
    },
  });

  return monochrome;
}

function isBlack(color) {
  switch (color.type) {
    case 'rgb': return color.r === 0 && color.r === color.g && color.g === color.b;
  }
  return false;
}
function isWhite(color) {
  switch (color.type) {
    case 'rgb': return color.r === 255 && color.r === color.g && color.g === color.b;
  }
  return false;
}
