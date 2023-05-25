import type { AstroIconCollectionMap, IconCollection } from 'virtual:astro-icon';
import type { AutoInstall } from '../../typings/iconify';
import type { IntegrationOptions } from '../integration';
export default function loadIconifyCollections(include?: IntegrationOptions['include']): Promise<AstroIconCollectionMap>;
export declare function loadCollection(name: string, autoInstall?: AutoInstall): Promise<IconCollection | void>;
