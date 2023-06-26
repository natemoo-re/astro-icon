import { getIcons } from "@iconify/utils";
import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
export default async function loadIconifyCollections(include = {}) {
    const possibleCollections = await Promise.all(Object.keys(include).map((collectionName) => loadCollection(collectionName).then((possibleCollection) => [collectionName, possibleCollection])));
    const collections = possibleCollections.reduce((acc, [name, collection]) => {
        if (!collection) {
            console.error(`[astro-icon] "${name}" does not appear to be a valid iconify collection! Did you install the "@iconify-json/${name}" dependency?`);
            return acc;
        }
        const requestedIcons = include[name];
        // Requested entire icon collection
        if (requestedIcons.length === 1 && requestedIcons[0] === "*") {
            acc[name] = collection;
            return acc;
        }
        const reducedCollection = getIcons(collection, requestedIcons);
        if (!reducedCollection) {
            console.error(`[astro-icon] "${name}" failed to load the specified icons!`);
            return acc;
        }
        else if (Object.keys(reducedCollection.icons).length !== requestedIcons.length) {
            console.error(`[astro-icon] "${name}" failed to load at least one of the specified icons! Verify the icon names are included in the icon collection.`);
        }
        acc[name] = reducedCollection;
        return acc;
    }, {});
    return collections;
}
export async function loadCollection(name, autoInstall) {
    if (!name)
        return;
    return loadCollectionFromFS(name, autoInstall);
}
