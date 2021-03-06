'use strict';
var io = require('socket.io-client');
var gaze = require('gaze');
var fs = require('fs');
var path = require('path');
var logger = require('winston');
var config = require('./config')(logger);

var directory = path.resolve(__dirname, process.argv[2]);

if (!directory) {
  logger.error("Usage: node server.js /path/to/directory");
  process.exit(1);
}

logger.info('listening on %s', directory);

var SOCKET_IO_URL = config.server.exposed_endpoint + '/?access_token=' + config.auth.token;

logger.info('connecting...');
var sio = io(SOCKET_IO_URL, {
  transports: ['websocket', 'polling'],
  multiplex: false
});

sio.on('connect', function() {
  logger.info('Etu is connected!');
  sio.emit('etu:co');
});

gaze(directory, function(err, watcher) {
  if (err) {
    throw err;
  }

  // Get all watched files
  this.watched(function(err, watched) {
    console.log(watched);
  });

  // On file changed
  this.on('changed', function(filepath) {
    sio.emit('file:etuChange',
      path.basename(filepath),
      Date.now(),
      fs.readFileSync(filepath, 'utf-8') // @todo use async mode
    );
  });

});
