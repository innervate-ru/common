import path from 'path';
import configAPI from 'config';
import {nanoid} from 'nanoid'
import 'moment-duration-format';
import errorDataToEvent from '../errors/errorDataToEvent';
import prettyError from '../utils/prettyError';
import cmd from 'commander'

export default (async function start() {

  cmd
    .name(`node src/common/postgres/updateDatabase.js`)
    .option(`-p, --prod`, `production mode`)
    .option(`-d, --dev`, `development mode. sql section '-- !Dev' is executed`)
    .option(`-e, --eval <.../db/evolutions>`, `path of db evolution`)
    .option(`-s, --silent`, `silent mode`)
    .parse(process.argv);

  let bus, nodeName;

  const context = nanoid();

  try {
    nodeName = `${configAPI.get('node')}/updateDatabase`;

    const consoleAndBusServicesOnly = Object.create(null);

    consoleAndBusServicesOnly.console = console;

    bus = consoleAndBusServicesOnly.bus = new (require('../events').Bus(consoleAndBusServicesOnly))({
      color: true,
      nodeName: nodeName,
    });

    const eventLoader = require('../services/defineEvents').default(consoleAndBusServicesOnly);
    await eventLoader(path.join(process.cwd(), 'src'));

    const evolutions = configAPI.has('evolutions') ? configAPI.get('evolutions') : {};

    const postgres = {...configAPI.get('postgres')};
    postgres.user = postgres.user || evolutions.user;
    postgres.password = postgres.password || evolutions.password;

    const params = {
      postgres,
      lock: cmd.prod || process.env.NODE_ENV === 'production',
      dev: cmd.dev || process.env.NODE_ENV === 'development',
      silent: cmd.silent || (evolutions.hasOwnProperty('silent') ? evolutions.silent : true),
    };

    if (cmd.eval) {
      params.schemaDir = path.resolve(process.cwd(), cmd.eval, 'schema');
      params.codeDir = path.resolve(process.cwd(), cmd.eval, 'code');

    } else {
      if (evolutions.schemaDir) params.schemaDir = evolutions.schemaDir;
      if (evolutions.codeDir) params.codeDir = evolutions.codeDir;
    }

    await require('./evolutions').default(consoleAndBusServicesOnly)(params);

  } catch (error) {
    if (bus) {
      const errEvent = {
        context,
        type: 'nodemanager.error',
        service: nodeName,
      };
      errorDataToEvent(error, errEvent);
      bus.criticalError(errEvent);
      await bus.dispose();
    } else {
      console.error(prettyError(error).stack);
    }
  }
})();
