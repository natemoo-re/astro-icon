import type { AstroIntegrationLogger } from "astro";
import fs from "node:fs";

export class FileCache {
  private enabled = true;

  constructor(
    private cacheDir: URL,
    private logger: AstroIntegrationLogger,
  ) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch (err) {
      this.enabled = false;
      this.logger.warn(
        `An error was encountered while attempting to create the cache directory. Proceeding without caching. Error: ${err}`,
      );
    }
  }

  async read<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) return;

    try {
      const path = new URL(`./${key}.json`, this.cacheDir);
      return JSON.parse(fs.readFileSync(path, { encoding: "utf-8" })) as T;
    } catch {
      this.logger.debug(`Cache miss for key "${key}"`);
    }
  }

  async write<T>(key: string, data: T): Promise<void> {
    if (!this.enabled) return;

    try {
      const path = new URL(`./${key}.json`, this.cacheDir);
      await fs.promises.writeFile(path, JSON.stringify(data), {
        encoding: "utf-8",
      });
    } catch {
      this.logger.debug(
        `An error occurred while attempting to write to the cache for key "${key}"`,
      );
    }
  }
}
