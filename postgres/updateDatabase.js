import path from 'path';
import configAPI from 'config';
import shortid from 'shortid'
import 'moment-duration-format';
import errorDataToEvent from '../errors/errorDataToEvent';
import prettyError from '../utils/prettyError';
import buildFullErrorMessage from '../utils/buildFullErrorMessage';

(async function start() {

  let bus, nodeName;

  const context = shortid();

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

    await require('./evolutions').default(consoleAndBusServicesOnly)({
      postgres: {
        ...configAPI.get('postgres'),
        ...(configAPI.has('evolutions') ? configAPI.get('evolutions') : {}),
      },
      lock: process.env.NODE_ENV === 'production',
      dev: process.env.NODE_ENV === 'development',
      // silent: true,
    });

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
