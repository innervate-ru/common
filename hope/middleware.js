import configApi from 'config'
import express from 'express'
import nanoid from 'nanoid'
import {missingExport, missingService, oncePerServices} from '../services/index'
import Result from '../../../../lib/hope/lib/result/index'
import configAPI from 'config'
import {addRequest, removeRequest} from '../context/requestByContext'

const secret = configApi.get('secret.value');

export default oncePerServices(function (services) {
  const {
    bus = missingService('bus'),
    docs = missingService('docs'),
  } = services;

  const {
    authMiddleware = missingExport('authMiddleware'),
  } = require('../../user/middleware').default(services);

  return function (expressApp) {
    ['update', 'get', 'list'].forEach(method => {

      expressApp.post(`/docs/${method}`,
        (!configAPI.has(`bitrix.crmId`) ? authMiddleware : (req, resp, next) => {
          req.context = nanoid();
          req.crmId = configAPI.get(`bitrix.crmId`);
          req.user = {crmId: configAPI.get(`bitrix.crmId`)};
          next();
        }),
        express.json(),
        async (req, resp, next) => {
          const context = (() => {
            if (typeof req.body.context === 'string' && req.body.context.length === 21) {
              req.context = req.body.context;
              return req.body.context;
            } else {
              return req.context;
            }
          })();
          addRequest(context, req);
          const result = new Result();
          let data;
          try {
            data = await docs[method]({...req.body, context, result, user: req.user});
          } catch (err) {
            if (err.code === 'validate') {
              result.error('doc.wrongArgs', {message: err.message});
            } else {
              err.context = context;
              docs._service._reportError(err);
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
                service: docs._service.name,
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
    });
  }
});
