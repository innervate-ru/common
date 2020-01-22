import path from 'path';
import configAPI from 'config';
import shortid from 'shortid'
import 'moment-duration-format';
import errorDataToEvent from '../errors/errorDataToEvent';
import prettyError from '../utils/prettyError';

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

    const Evolutions = require('./evolutions').default(consoleAndBusServicesOnly)

    const evolutions = new Evolutions(configAPI.get('evolutions'));

    // TODO: Process args
    // TODO: Think of watching files

    evolutions.process({context});

  } catch (error) {

    // if (manager) await manager.dispose();

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
