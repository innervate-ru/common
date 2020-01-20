import fs from 'fs';
import path from 'path';

const readDir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);

export default async function(dir) {
  dir = path.resolve(process.cwd(), dir);
  try {
    return (await list(dir)).flatMap(v => v).sort();
  } catch (err) {
    // throw err;
    if (err.code !== 'ENOENT') throw err;
    throw new Error(`Missing dir: ${dir}`)
  }
}

async function list(dir) {
  return readDir(dir).map(async (filename) => {
    const fullpath = path.join(dir, filename);
    return (await stat(fullpath)).isDirectory() ? await list(fullpath) : fullpath;
  });
}
