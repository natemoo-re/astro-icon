import { loadCollectionFromFS } from "@iconify/utils/lib/loader/fs";
import { loadLocalCollection } from "./load.mjs";

export const icons: import("virtual:astro-icon").AstroIconCollection = {}
icons["local"] = await loadLocalCollection()

export async function loadCollection(name: string) {
    if (!name) {
        console.info("what the hell")
        return
    }
    if (name in icons) return
    const collection = await loadCollectionFromFS(name)
    if (collection) icons[name] = collection
}