import fs from 'fs';
import path from 'path';

export default function listFilesSync(dir) {
  dir = path.resolve(process.cwd(), dir);
  try {
    return list(dir).flat(Number.MAX_SAFE_INTEGER).sort();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    throw new Error(`Missing dir: ${dir}`)
  }
}

function list(dir) {
  return fs.readdirSync(dir).filter(filename => !filename.startsWith('.')).map(filename => {
    const fullpath = path.join(dir, filename);
    return fs.statSync(fullpath).isDirectory() ? list(fullpath) : fullpath;
  });
}
