import { SPRITESHEET_NAMESPACE } from "./constants";
import { Props, Optimize } from "./Props";
import getFromService from "./resolver";
import { optimize as optimizeSVGNative } from "svgo";

// Adapted from https://github.com/developit/htmlParser
const splitAttrsTokenizer = /([a-z0-9_\:\-]*)\s*?=\s*?(['"]?)(.*?)\2\s+/gim;
const domParserTokenizer =
  /(?:<(\/?)([a-zA-Z][a-zA-Z0-9\:]*)(?:\s([^>]*?))?((?:\s*\/)?)>|(<\!\-\-)([\s\S]*?)(\-\->)|(<\!\[CDATA\[)([\s\S]*?)(\]\]>))/gm;

const splitAttrs = (str) => {
  let res = {};
  let token;
  if (str) {
    splitAttrsTokenizer.lastIndex = 0;
    str = " " + (str || "") + " ";
    while ((token = splitAttrsTokenizer.exec(str))) {
      res[token[1]] = token[3];
    }
  }
  return res;
};

function optimizeSvg(
  contents: string,
  name: string,
  options: Optimize
): string {
  return optimizeSVGNative(contents, {
    plugins: [
      "removeDoctype",
      "removeXMLProcInst",
      "removeComments",
      "removeMetadata",
      "removeXMLNS",
      "removeEditorsNSData",
      "cleanupAttrs",
      "minifyStyles",
      "convertStyleToAttrs",
      {
        name: "cleanupIDs",
        params: { prefix: `${SPRITESHEET_NAMESPACE}:${name}` },
      },
      "removeRasterImages",
      "removeUselessDefs",
      "cleanupNumericValues",
      "cleanupListOfValues",
      "convertColors",
      "removeUnknownsAndDefaults",
      "removeNonInheritableGroupAttrs",
      "removeUselessStrokeAndFill",
      "removeViewBox",
      "cleanupEnableBackground",
      "removeHiddenElems",
      "removeEmptyText",
      "convertShapeToPath",
      "moveElemsAttrsToGroup",
      "moveGroupAttrsToElems",
      "collapseGroups",
      "convertPathData",
      "convertTransform",
      "removeEmptyAttrs",
      "removeEmptyContainers",
      "mergePaths",
      "removeUnusedNS",
      "sortAttrs",
      "removeTitle",
      "removeDesc",
      "removeDimensions",
      "removeStyleElement",
      "removeScriptElement",
    ],
  }).data;
}

const preprocessCache = new Map();
export function preprocess(contents: string, name: string, { optimize }) {
  if (preprocessCache.has(contents)) {
    return preprocessCache.get(contents);
  }
  if (optimize) {
    contents = optimizeSvg(contents, name, optimize);
  }
  domParserTokenizer.lastIndex = 0;
  let result = contents;
  let token;
  if (contents) {
    while ((token = domParserTokenizer.exec(contents))) {
      const tag = token[2];
      if (tag === "svg") {
        const attrs = splitAttrs(token[3]);
        result = contents
          .slice(domParserTokenizer.lastIndex)
          .replace(/<\/svg>/gim, "")
          .trim();
        const value = { innerHTML: result, defaultProps: attrs };
        preprocessCache.set(contents, value);
        return value;
      }
    }
  }
}

export function normalizeProps(inputProps: Props) {
  const size = inputProps.size ?? "1em";
  delete inputProps.size;
  const width = toAttributeSize(inputProps.width ?? size);
  const height = toAttributeSize(inputProps.height ?? size);
  return { ...inputProps, width, height };
}

const toAttributeSize = (size: string | number) =>
  String(size).replace(/(?<=[0-9])x$/, "em");

export const fallback = {
  innerHTML:
    '<rect width="24" height="24" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />',
  props: {
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    "aria-hidden": "true",
  },
};

export default async function load(
  name: string,
  inputProps: Props,
  optimize: Optimize
) {
  const key = name;
  if (!name) {
    throw new Error("<Icon> requires a name!");
  }

  let svg = "";
  let filepath = "";
  if (name.includes(":")) {
    const [pack, ..._name] = name.split(":");
    name = _name.join(":");
    // Note: omit ending to use default resolution
    filepath = `/src/icons/${pack}`;
    let get;
    try {
      const mod = await import(`${filepath}`);
      if (typeof mod.default !== "function") {
        throw new Error(
          `[astro-icon] "${filepath}" did not export a default function!`
        );
      }
      get = mod.default;
    } catch (e) {
      // Do nothing, local pack is not required
    }
    if (typeof get === "undefined") {
      get = getFromService.bind(null, pack);
    }
    const contents = await get(name);
    if (!contents) {
      throw new Error(
        `<Icon pack="${pack}" name="${name}" /> did not return an icon!`
      );
    }
    if (!/<svg/gim.test(contents)) {
      throw new Error(
        `Unable to process "<Icon pack="${pack}" name="${name}" />" because an SVG string was not returned!

Recieved the following content:
${contents}`
      );
    }
    svg = contents;
  } else {
    filepath = `/src/icons/${name}.svg`;

    try {
      const { default: contents } = await import(`${filepath}?raw`);
      if (!/<svg/gim.test(contents)) {
        throw new Error(
          `Unable to process "${filepath}" because it is not an SVG!

Recieved the following content:
${contents}`
        );
      }
      svg = contents;
    } catch (e) {
      throw new Error(
        `[astro-icon] Unable to load "${filepath}". Does the file exist?`
      );
    }
  }

  const { innerHTML, defaultProps } = preprocess(svg, key, { optimize });

  if (!innerHTML.trim()) {
    throw new Error(`Unable to parse "${filepath}"!`);
  }

  return {
    innerHTML,
    props: { ...defaultProps, ...normalizeProps(inputProps) },
  };
}
