import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import {
  readSpriteAssets,
  readSpriteManifest,
} from "./content/sprite/manifest.js";
import { rewritePageSprites } from "./content/sprite/rewrite.js";
import { spritePaths } from "./content/sprite/state.js";
import { spriteAssetPath } from "./internal/spriteManifest.js";

const VIRTUAL_MODULE_ID = "virtual:astro-icon/sprite-manifest";
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

/** Recursively finds every `.html` file under `dir` - deliberately not `pages` from the build hooks, which lists routes, not files, and doesn't account for `build.format`/`trailingSlash`/i18n/404 output shape. */
async function* walkHtmlFiles(dir: URL): AsyncGenerator<URL> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryUrl = new URL(entry.name, dir);
    if (entry.isDirectory()) {
      yield* walkHtmlFiles(new URL(`${entry.name}/`, dir));
    } else if (entry.name.endsWith(".html")) {
      yield entryUrl;
    }
  }
}

/** `build.assetsPrefix` resolved for `.svg` - a plain string applies to every extension, an object needs its own `svg` entry or falls back to `fallback`. */
function resolveSvgAssetsPrefix(
  assetsPrefix: string | Record<string, string> | undefined,
): string | undefined {
  if (!assetsPrefix) return undefined;
  if (typeof assetsPrefix === "string") return assetsPrefix;
  return assetsPrefix.svg ?? assetsPrefix.fallback;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;
}

/**
 * Opt-in integration powering automatic sprite optimization. Without it,
 * `<Icon>`'s import of `virtual:astro-icon/sprite-manifest` fails to
 * resolve, every collection is treated as unsprited, and every icon renders
 * as a plain inline `<svg>` - the same output as not using this integration
 * at all.
 *
 * On a prerendered page, `<Icon>` always renders full inline bodies -
 * dedup into a per-page `<symbol>`/`<use>` sheet happens here, as a
 * post-processing pass over the finished HTML, not at render time: Astro
 * doesn't render template expressions in document order, so nothing at
 * render time can know "this is the Nth occurrence of this icon on the
 * page" without either buffering (which breaks SSR streaming) or a
 * render-order race.
 */
export function icon(): AstroIntegration {
  // Neither `astro:server:setup` nor `astro:build:generated` is handed
  // `config` - captured here from `astro:config:setup`, which always runs
  // first, so both later hooks can still get at `config.root`.
  let root: URL;
  let assetsPrefix: string | undefined;
  // Whether `astro:build:generated` ran, which is not guaranteed - see the
  // `astro:build:done` fallback below.
  let emittedAssets = false;

  /** Writes every sprited collection's staged asset into the client output directory. */
  async function emitSpriteAssets(
    dir: URL,
    logger: { warn(message: string): void; debug(message: string): void },
  ): Promise<{ count: number; bytes: number }> {
    const assets = await readSpriteAssets(root);
    if (assets.length === 0) return { count: 0, bytes: 0 };

    if (assetsPrefix) {
      logger.warn(
        `\`build.assetsPrefix\` is set, so sprite assets are referenced from "${assetsPrefix}" instead of this site's own origin.\n\nThat origin must serve them with CORS headers (e.g. \`Access-Control-Allow-Origin\`) - without them, browsers silently refuse to load the referenced icons, and they'll just be missing with no visible error.`,
      );
    }

    const assetsDir = new URL("./_astro/", dir);
    await mkdir(assetsDir, { recursive: true });

    let bytes = 0;
    for (const asset of assets) {
      const outPath = new URL(
        `.${spriteAssetPath(asset.collection, asset.hash)}`,
        dir,
      );
      await writeFile(outPath, asset.content);
      const assetBytes = Buffer.byteLength(asset.content, "utf-8");
      bytes += assetBytes;
      logger.debug(
        `Emitted sprite asset for "${asset.collection}" (${outPath.pathname}, ${formatBytes(assetBytes)}).`,
      );
    }

    return { count: assets.length, bytes };
  }

  return {
    name: "astro-icon",
    hooks: {
      "astro:config:setup": ({ config, updateConfig }) => {
        root = config.root;
        assetsPrefix = resolveSvgAssetsPrefix(config.build.assetsPrefix);
        updateConfig({
          vite: {
            plugins: [
              {
                name: "astro-icon/sprite-manifest",
                resolveId(id) {
                  if (id === VIRTUAL_MODULE_ID)
                    return RESOLVED_VIRTUAL_MODULE_ID;
                },
                async load(id) {
                  if (id !== RESOLVED_VIRTUAL_MODULE_ID) return;
                  // Tells Vite this module's content depends on the sprite state file, so a
                  // rebuild-on-change (`astro:server:setup` below) has something to react to -
                  // without this, Vite has no way to know a virtual module depends on a real file.
                  this.addWatchFile(
                    fileURLToPath(spritePaths(config.root).stateFile),
                  );
                  const manifest = await readSpriteManifest(config.root);
                  return `export const assetsPrefix = ${JSON.stringify(assetsPrefix ?? null)};\nexport default ${JSON.stringify(manifest)};`;
                },
              },
            ],
          },
        });
      },

      // Dev never buffers or rewrites HTML - it only needs to serve the
      // same URLs a built app would reference from its SSR branch, read
      // live off whatever the loader most recently staged.
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          const match = req.url?.match(/^\/_astro\/([^/]+)\.([0-9a-f]+)\.svg$/);
          if (!match) return next();
          const [, collection, hash] = match;

          const assets = await readSpriteAssets(root);
          const asset = assets.find(
            (a) => a.collection === collection && a.hash === hash,
          );
          if (!asset) return next();

          res.setHeader("Content-Type", "image/svg+xml");
          res.end(asset.content);
        });

        // Without this, editing a local icon mid dev-session leaves the virtual module's
        // cached content stale: <Icon> keeps resolving hrefs against the old hash, which
        // the dev middleware above can no longer find (it looks up by exact hash match) -
        // a broken icon until something else happens to force a reload. `addWatchFile` in
        // the plugin's load() above tells Vite this file matters; this is what actually
        // reacts to it changing.
        const stateFilePath = fileURLToPath(spritePaths(root).stateFile);
        server.watcher.add(stateFilePath);
        server.watcher.on("change", (changedPath) => {
          if (changedPath !== stateFilePath) return;
          const mod = server.moduleGraph.getModuleById(
            RESOLVED_VIRTUAL_MODULE_ID,
          );
          if (mod) server.moduleGraph.invalidateModule(mod);
          // A stale sprite href is baked into already-rendered HTML, not just client state -
          // no partial HMR update can fix that, so this forces a real re-render.
          server.ws.send({ type: "full-reload" });
        });
      },

      // Runs after static pages are written but before adapters bundle or
      // relocate anything - `dir` is the client output directory, exactly
      // where `/_astro/*` assets are served from and where every
      // prerendered page's finished HTML already lives.
      "astro:build:generated": async ({ dir, logger }) => {
        const { count, bytes } = await emitSpriteAssets(dir, logger);
        emittedAssets = true;

        let rewritten = 0;
        for await (const file of walkHtmlFiles(dir)) {
          const html = await readFile(file, "utf-8");
          const output = rewritePageSprites(html);
          if (output === html) continue;
          await writeFile(file, output);
          rewritten++;
        }

        if (count > 0 || rewritten > 0) {
          const parts: string[] = [];
          if (count > 0) {
            parts.push(
              `${count} sprite asset(s) for server-rendered routes (${formatBytes(bytes)} total)`,
            );
          }
          if (rewritten > 0)
            parts.push(
              `deduped repeated icons on ${rewritten} prerendered page(s)`,
            );
          logger.info(`Sprite optimization: ${parts.join(", ")}.`);
        }
      },

      // `astro:build:generated` never runs for a build with no prerendered routes:
      // Astro's own page-generation step returns early when nothing is prerendered, before
      // reaching the hook. A fully server-rendered app would otherwise reference sprite
      // assets nobody ever wrote - a 404 for every `<use>`, so every icon renders blank.
      // Emission is kept in `build:generated` whenever that hook does run, since it lands
      // before adapters bundle or relocate the client directory; this only covers the case
      // where it never ran, and there's no prerendered HTML to rewrite by definition.
      "astro:build:done": async ({ dir, logger }) => {
        if (emittedAssets) return;

        const { count, bytes } = await emitSpriteAssets(dir, logger);
        if (count > 0) {
          logger.info(
            `Sprite optimization: ${count} sprite asset(s) for server-rendered routes (${formatBytes(bytes)} total).`,
          );
        }
      },
    },
  };
}
