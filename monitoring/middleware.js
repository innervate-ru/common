import configAPI from 'config';
import {oncePerServices, missingService, missingExport, serviceName} from '../services/index';
import express from 'express'
import {STARTING, READY} from '../services/Service.states'

const key = configAPI.get('monitoring.key');

export const service = serviceName(__filename);

export default oncePerServices(function (services) {

  const {
    bus = missingService('bus'),
    monitoring = missingService('monitoring'),
  } = services;

  function reportError(req, res, err, code) {
    if (!err.context) err.context = req.context.reqId || req.context;
    monitoring._service._reportError(err);
    res.status(err.code || code).send(
      {
        context: err && err.context,
        error: `${err && err.message} (${err && err.context})`
      }
    ).end();
  }

  const logger = require('../express/accessLog').default(services)({service});

  const checkKey = function (req, res, next) {
    if (key && req.query.key !== key) return res.status(400).send(`Invalid 'key': ${req.query.key}`);
    next();
  };

  return async function (expressApp) {

    const router = express.Router();
    expressApp.use('/api/health', router);

    /**
     * Возвращает 200, если запущен веб-сервис
     */
    router.get(`/running`, logger, checkKey,
      async function (req, res, next) {
        res.sendStatus(monitoring.isRunning ? 200 : 503);// TODO: get services
      });

    /**
     * Возвращает 200, если статус сервиса
     * равен READY
     */
    router.get(`/status`, logger, checkKey,
      async function (req, res, next) {
        const {service} = req.query;

        if(!monitoring.isRunning || !service)
          res.sendStatus(503);

        const _service = await monitoring.getService(service);

        if(!_service)
          res.sendStatus(404);

        res.sendStatus(_service.status === READY ? 200 : 503);
      });


    /**
     * Возвращает данные в формате Prometheus по счетчикам (https://prometheus.io/docs/instrumenting/writing_exporters/).
     */
    router.get(`/counters`, logger, checkKey,
      async function (req, res, next) {
        try {
          res
            .type('text/plain')
            .send(await monitoring.reportCounters({
              context: req.context.reqId || req.context,
            }));
        } catch (err) {
          reportError(req, res, err, 500);
        }
      });
  };
});
