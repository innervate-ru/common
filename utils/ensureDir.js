import fs from 'fs'
import {promisify} from 'util'

import {missingArgument} from './arguments'

const fsStat = promisify(fs.stat);
const fsMkdir = promisify(fs.mkdir);

export default async function (dir = missingArgument('dir')) {
  try {
    let dirState = await fsStat(dir);
    if (!dirState.isDirectory())
      throw new Error(`'${dir}' is not a directory`);
  } catch (err) {
    if (err.code == 'ENOENT') {
      await fsMkdir(dir);
    }
    else throw err;
  }
}
