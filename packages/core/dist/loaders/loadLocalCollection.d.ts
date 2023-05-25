import type { IconCollection } from "virtual:astro-icon";
import type { SVGOOptions } from '../../typings/iconify.js';
export default function createLocalCollection(dir: string, options?: SVGOOptions): Promise<IconCollection>;
