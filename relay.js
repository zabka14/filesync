'use strict';
var io = require('socket.io-client');
var gaze = require('gaze');
var fs = require('fs');
var path = require('path');
var logger = require('winston');
var config = require('./config')(logger);
var prompt = require('prompt');
var open = require("open");

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
  logger.info('connected!');
  sio.emit('teacher:co');
});



sio.on('etu:send', function(filename, timestamp, content) {
  console.log("You received a file from a student :");
  console.log("File's name : "+filename);
  console.log("Send at : "+ timestamp);
  console.log("The file will be stored on /tmp/filesync");
  console.log("Would you like to save ? Y/N");
  inputHandler(filename, content);
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
    sio.emit('file:changed',
      path.basename(filepath),
      Date.now(),
      fs.readFileSync(filepath, 'utf-8') // @todo use async mode
    );
  });

  // On file added
  this.on('added', function(filepath) {
    console.log(filepath + ' was added');
  });

  // On file deleted
  this.on('deleted', function(filepath) {
    console.log(filepath + ' was deleted');
  });

  // On changed/added/deleted
  this.on('all', function(event, filepath) {
    console.log(filepath + ' was ' + event);
  });

  // Get watched files with relative paths
  this.relative(function(err, files) {
    console.log(files);
  });

});


prompt.start();
var filename;
var content;

function inputHandler(filename, content){

  prompt.get(['save'], function (err, result) {
      if (result.save == 'y') {
        storeFile(filename, content);
      }
      else {
        console.log("File has been rejected");
      }
   });
}

function openHandler(filename){
  console.log("Would you like to open this file ? Y/N");
  prompt.get(['open'], function (err, result) {
      if (result.open == 'y') {
        openFile(filename);
      }
      else {
        console.log("File is still available in /tmp/filesync.");
      }
   });
}

function sendHandler(filename){
  console.log("Would you like to send this file to the server ? Y/N");
  prompt.get(['send'], function (err, result) {
      if (result.send == 'y') {
        sendFile(filename);
      }
      else {
        console.log("File is still available in /tmp/filesync.");
      }
   });
}


function storeFile(filename, content){
  if (!fs.exists('/tmp/filesync/')) {
    fs.mkdir('/tmp/filesync/', function(error) {
      console.log("MKDIR working ...");
    })
  }
  fs.writeFile('/tmp/filesync/'+filename, content, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("The file was saved!");
    openHandler(filename);
  });
}

function openFile(filename){
  open('/tmp/filesync/'+filename);
  sendHandler(filename);
}

function sendFile(filename){
  gaze('/tmp/filesync/'+filename, function(err, watcher) {
    if (err) {
      throw err;
    }

    // Get all watched files
    this.watched(function(err, watched) {
      console.log(watched);
    });

    // On file changed
      sio.emit('file:changed',
        '/tmp/filesync/'+filename,
        Date.now(),
        fs.readFileSync('/tmp/filesync/'+filename, 'utf-8') // @todo use async mode
      );

  });
}
