import express from 'express'
import bodyParser from 'body-parser'
import cookieSession from 'cookie-session'

import {secret} from '../config.js'

export default async function initExpress() {

  let expressApp = global.app.expressApp = express();

  expressApp.set('trust proxy', true);
  expressApp.use(cookieSession({secret, maxAge: 1000 * 60 * 60 * 24 * 10000})); // very long session
  expressApp.use(bodyParser.json({limit: '1mb'}));
  expressApp.use(bodyParser.urlencoded({extended: false, limit: '5mb'}));

}
