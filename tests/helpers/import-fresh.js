import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function importFresh(relativePath, seed = `${Date.now()}-${Math.random()}`) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const url = pathToFileURL(absolutePath);
  return import(`${url.href}?fresh=${seed}`);
}

export { importFresh };