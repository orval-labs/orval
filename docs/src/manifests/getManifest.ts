import manifest from './manifest.json';

const versions = {};

export const versionList = Object.keys(versions);
export function getManifest(tag: string | undefined) {
  return tag ? versions[tag] : manifest;
}
