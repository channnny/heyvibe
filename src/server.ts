import dotenv from 'dotenv';
/* eslint-disable import/first */
dotenv.config();
import log from 'bog';
import http from 'http';
import BurritoStore from './store/BurritoStore';
import LocalStore from './store/LocalStore';
import database from './database';
import config from './config';
import { start } from './bot';
import { boltApp } from './slack';
import WBCHandler from './slack/Wbc';
import APIHandler from './api';
import WEBHandler from './web';
import WSSHandler from './wss';
import boot from './lib/boot';

const init = async () => {
    await boot();
};

init().then(async () => {
    log.info('Starting heyburrito (Bolt with Socket Mode)');

    // Configure BurritoStore
    BurritoStore.setDatabase(database);

    // Set and start slack services
    await boltApp.start();
    WBCHandler.register(boltApp.client);

    // Start bot instance
    start();

    // Start localstore instance
    LocalStore.start();

    /**
     * Httpserver request handler
     */
    const requestHandler = (request: http.IncomingMessage, response: http.ServerResponse) => {
        /**
         * Check if request url contains api path, then let APIHandler take care of it
         */
        if (request.url.includes(config.http.api_path)) return APIHandler(request, response);
        /**
         * Check if request url contains webpath, then let WEBHandler take care of it
         */
        if (request.url.includes(config.http.web_path)) return WEBHandler(request, response);
        /**
         * redirect all other requests to webPath
         */
        response.writeHead(301, {
            location: config.http.web_path,
        });
        return response.end();
    };

    /**
     * Start HTTP / WSS server
     */
    const httpserver = http.createServer(requestHandler);

    httpserver.listen(config.http.http_port, (err) => {
        if (err) throw new Error(`Could not start HTTP server, error => ${err}`);
        // Start WSS instance
        WSSHandler();
        log.info(`HttpServer started on ${config.http.http_port}`);
    });
});
