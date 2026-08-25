import type { APIRoute } from "astro";
import { AstroIconError } from "astro-icon";
import { entryFromSVG } from "astro-icon/source";
import { defaultOverrides, svgo } from "astro-icon/optimize";

export const prerender = false;

// Backs /playground/. Runs the pasted SVG through the real pipeline - the same svgo() and
// entryFromSVG() a localIcons()-backed collection uses - so what the playground reports is what
// the library actually does, not a reimplementation. (Collection loaders additionally strip
// active content at sync time; that step isn't public API, so the playground only notes it.)
//
// entryFromSVG() itself takes no policy (no logger, no strict): it returns `facts` and leaves
// warn-vs-ignore up to the caller, the same "facts, not policy" split localIcons() applies - see
// its own `facts.viewBox`/`facts.monochromeWithoutCurrentColor` handling for the wording this
// mirrors.

type OptimizeMode = "off" | "default" | "current-color" | "svgo-preset";

interface PlaygroundRequest {
  svg?: unknown;
  optimize?: unknown;
  floatPrecision?: unknown;
  multipass?: unknown;
}

const MAX_SVG_BYTES = 200_000;

function buildOptimizer(
  mode: OptimizeMode,
  floatPrecision: number,
  multipass: boolean,
) {
  if (mode === "off") return undefined;
  const overrides =
    mode === "svgo-preset"
      ? undefined
      : mode === "current-color"
        ? { ...defaultOverrides, convertColors: { currentColor: true } }
        : defaultOverrides;
  return svgo({
    multipass,
    plugins: [
      {
        name: "preset-default",
        params: overrides ? { floatPrecision, overrides } : { floatPrecision },
      },
    ],
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: PlaygroundRequest;
  try {
    body = (await request.json()) as PlaygroundRequest;
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const svg = typeof body.svg === "string" ? body.svg : "";
  if (!svg.trim()) {
    return Response.json(
      { error: { message: "No SVG provided." } },
      { status: 400 },
    );
  }
  if (svg.length > MAX_SVG_BYTES) {
    return Response.json(
      {
        error: {
          message: `SVG too large (limit ${MAX_SVG_BYTES.toLocaleString()} bytes).`,
        },
      },
      { status: 413 },
    );
  }

  const mode: OptimizeMode = (
    ["off", "default", "current-color", "svgo-preset"] as const
  ).includes(body.optimize as OptimizeMode)
    ? (body.optimize as OptimizeMode)
    : "default";
  const floatPrecision = Math.min(
    5,
    Math.max(0, Math.round(Number(body.floatPrecision ?? 3)) || 0),
  );
  const multipass = body.multipass === true;

  const warnings: string[] = [];

  try {
    const optimizer = buildOptimizer(mode, floatPrecision, multipass);
    const optimized = optimizer
      ? await optimizer(svg, { collection: "playground", name: "pasted" })
      : svg;
    const { entry, facts } = entryFromSVG(optimized);

    // The same two warnings localIcons() logs on a real sync, worded to match.
    if (facts.viewBox === "missing") {
      warnings.push(
        `"pasted" has no usable viewBox, falling back to "${entry.viewBox}". Check the source SVG (or the optimize mode above) to avoid this.`,
      );
    }
    if (facts.monochromeWithoutCurrentColor) {
      warnings.push(
        `"pasted" doesn't use "currentColor", so CSS \`color\` won't affect it. See "Styling icons" in the README.`,
      );
    }

    return Response.json({
      entry,
      optimized,
      before: svg.length,
      after: optimized.length,
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hint = err instanceof AstroIconError ? err.hint : undefined;
    return Response.json(
      { error: { message, hint }, warnings },
      { status: 422 },
    );
  }
};
