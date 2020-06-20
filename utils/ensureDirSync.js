import fs from 'fs'
import path from 'path'
import {promisify} from 'util'

import {missingArgument} from '../validation/arguments'

const fsStat = promisify(fs.stat);
const fsMkdir = promisify(fs.mkdir);

export default function (dir = missingArgument('dir')) {
  dir = path.resolve(process.cwd(), dir);
  try {
    if (!fs.statSync(dir).isDirectory())
      throw new Error(`'${dir}' is not a directory`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.mkdirSync(dir);
    }
    else throw err;
  }
  return dir;
}
