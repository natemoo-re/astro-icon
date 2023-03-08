import { AstroIntegration } from 'astro';

export interface AstroIconOptions {
    include: Record<string, ['*'] | string[]>
}

export default function icon(opts: AstroIconOptions): AstroIntegration;
