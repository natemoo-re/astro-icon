import type { AstroIconCollectionMap, IconCollection, IntegrationOptions } from "../../typings/integration";
import type { AutoInstall } from "../../typings/iconify";
export default function loadIconifyCollections(include?: IntegrationOptions["include"]): Promise<AstroIconCollectionMap>;
export declare function loadCollection(name: string, autoInstall?: AutoInstall): Promise<IconCollection | void>;
