//@ts-check
import { cleanupSVG, importDirectory, isEmptyColor, parseColors, runSVGO } from "@iconify/tools";

/**
 * Load a icon set from "src/icons"
 * @returns {Promise<import("@iconify/tools").IconSet>} the icon set
 */
export async function loadLocalCollection() {
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
  return local
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