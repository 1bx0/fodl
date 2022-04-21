import { writeJSONSync } from 'fs-extra'
export function saveArtifact(artifact: any, name: string) {
  if (!require?.main?.filename) throw new Error()
  writeJSONSync(`${__dirname}/${name}.json`, artifact)
}
