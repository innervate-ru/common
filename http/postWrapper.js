import express from 'express'
import hrid from '../utils/hrid'
import {missingExport, missingService, oncePerServices} from '../services/index'
import Result from '../result'
import {addRequest, removeRequest} from '../context/requestByContext'

const schema = require('./postWrapper.schema');

export default oncePerServices(function (services) {
  const {
    bus = missingService('bus'),
  } = services;

  return function (args) {

    schema.args(args);

    // TODO: as default auth use authMIddleware

    const {expressApp, path, service, method, auth, result: addResult, http: sayItsHttpCall} = args;

    expressApp.post(path,
      // auth,
      express.json(),
      async (req, resp, next) => {
        console.info(25)
        const context = (() => {
          if (typeof req.body.context === 'string' && req.body.context.length === 21) {
            req.context = req.body.context;
            return req.body.context;
          } else if (req.context) {
            return req.context;
          } else {
            return hrid();
          }
        })();
        console.info(26)
        addRequest(context, req);
        console.info(28)
        const result = new Result();
        let data;
        try {
          console.info(27)
          const params = {...req.body, context};
          if (addResult) params.result = result;
          if (sayItsHttpCall) params.http = true;
          console.info(43)
          data = await method(params);
        } catch (err) {
          if (err.code === 'validate') {
            result.error('doc.wrongArgs', {message: err.message});
          } else {
            err.context = context;
            service._service._reportError(err);
            result.error('doc.systemError', {context});
          }
        } finally {
          removeRequest(context);
        }
        const res = {
          context,
          status: result.isError ? 'failed' : 'success',
          messages: result.messages,
        };
        if (result.isError) {
          if (result.messages[0].code !== 'doc.systemError') {
            bus.error({
              type: 'service.error',
              service: service._service.name,
              context,
              message: `(context: ${context}) ${JSON.stringify(result.messages)}`,
            });
          }
        } else {
          res.data = data;
        }
        resp.json(res);
        next();
      });
  };
});
