import fs from 'fs';
import path from 'path';
import {promisify} from 'util'

const readDir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export default async function listFiles(dir) {
  dir = path.resolve(process.cwd(), dir);
  try {
    return (await list(dir)).flat(Number.MAX_SAFE_INTEGER).sort();
  } catch (err) {
    // throw err;
    if (err.code !== 'ENOENT') throw err;
    throw new Error(`Missing dir: ${dir}`)
  }
}

async function list(dir) {
  return Promise.all((await readDir(dir)).reduce((res, filename) => {
    if (!filename.startsWith('.')) {
      const fullpath = path.join(dir, filename);
      res.push((async () => {
        return (await stat(fullpath)).isDirectory() ? list(fullpath) : fullpath;
      })());
    }
    return res;
  }, []));
}
