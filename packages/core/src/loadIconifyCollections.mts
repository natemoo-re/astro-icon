import { getIcons } from '@iconify/utils';
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import type { IconifyJSON } from '@iconify/types';
import type { IntegrationOptions } from './types.mjs';
import type { AutoInstall } from '@iconify/utils/lib/loader/types.js';

export default async function loadIconifyCollections(include: IntegrationOptions['include'] = {}): Promise<Record<string, IconifyJSON>> {
    const possibleCollections = await Promise.all(
        Object.keys(include).map((collectionName) => 
            loadIconifyCollection(collectionName).then((possibleCollection) => [collectionName, possibleCollection] as const)
        )
    )

    const collections = possibleCollections.reduce<Record<string, IconifyJSON>>((acc, [name, collection]) => {
        if (!collection) {
            console.error(`[astro-icon] "${name}" does not appear to be a valid iconify collection!`);
            return acc;
        }

        const requestedIcons = include[name];
        
        // Requested entire icon collection
        if (requestedIcons.length === 1 && requestedIcons[0] === '*') {
            acc[name] = collection
            return acc;
        }

        const reducedCollection = getIcons(collection, requestedIcons)
        if (!reducedCollection) {
            console.error(`[astro-icon] "${name}" failed to load the specified icons!`);
            return acc;
        }

        acc[name] = reducedCollection
        return acc;
    }, {})

    return collections
}

export async function loadIconifyCollection(name: string, autoInstall?: AutoInstall): Promise<IconifyJSON | void> {
    if (!name) return
    
    return loadCollectionFromFS(name, autoInstall)
}