import { promises as fs } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const baseUrl = pathToFileURL(require.resolve('heroicons/package.json'));

export default async (name: string) => {
    const svg = await fs.readFile(fileURLToPath(new URL(`./outline/${name}.svg`, baseUrl))).then(res => res.toString());
    return svg;
}
