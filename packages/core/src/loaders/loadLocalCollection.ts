import {
  cleanupSVG,
  importDirectory,
  isEmptyColor,
  parseColors,
  runSVGO,
} from "@iconify/tools";
import type { IconCollection } from "virtual:astro-icon";
import type { SVG, Color, SVGOOptions } from "../../typings/iconify.js";

export default async function createLocalCollection(dir: string, options: SVGOOptions = { plugins: ['preset-default'] }): Promise<IconCollection> {
  // Import icons
  const local = await importDirectory(dir, {
    prefix: "local",
    keepTitles: true,
  });

  // Validate, clean up, fix palette and optimize
  await local.forEach(async (name, type) => {
    if (type !== "icon") {
      return;
    }

    // Get SVG instance for parsing
    const svg = local.toSVG(name);
    if (svg === null) {
      // Invalid icon
      local.remove(name);
      return;
    }

    // Clean up and optimize icons
    try {
      // Clean up icon code
      cleanupSVG(svg, { keepTitles: true });
      
      // Validate if Icon is monotone
      if (await isMonochrome(svg)) {
        // If so, convert to use currentColor
        await convertToCurrentColor(svg);
      }

      // Optimize
      runSVGO(svg, options);
    } catch (err) {
      // Invalid icon
      console.error(`Error parsing ${name}:`, err);
      local.remove(name);
      return;
    }

    // Update icon
    local.fromSVG(name, svg);
  });

  return local.export(true);
}

async function convertToCurrentColor(svg: SVG): Promise<void> {
  await parseColors(svg, {
    defaultColor: "currentColor",
    callback: (_, colorStr, color) => {
      return color === null || isEmptyColor(color) || isWhite(color)
        ? colorStr
        : "currentColor";
    },
  });
}

async function isMonochrome(svg: SVG): Promise<boolean> {
  let monochrome = true;
  await parseColors(svg, {
    defaultColor: "currentColor",
    callback: (_, colorStr, color) => {
      if (!monochrome) return colorStr;
      monochrome =
        !color || isEmptyColor(color) || isWhite(color) || isBlack(color);
      return colorStr;
    },
  });

  return monochrome;
}

function isBlack(color: Color): boolean {
  switch (color.type) {
    case "rgb":
      return color.r === 0 && color.r === color.g && color.g === color.b;
  }
  return false;
}

function isWhite(color: Color): boolean {
  switch (color.type) {
    case "rgb":
      return color.r === 255 && color.r === color.g && color.g === color.b;
  }
  return false;
}
