'use strict';

var io = require('socket.io');
var express = require('express');
var path = require('path');
var app = express();
var _ = require('lodash');



var logger = require('winston');
var config = require('./config')(logger);

app.use(express.static(path.resolve(__dirname, './public')));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

var server = app.listen(config.server.port, function() {
  logger.info('Server listening on %s', config.server.port);
});

var sio = io(server);

sio.set('authorization', function(handshakeData, accept) {
  // @todo use something else than a private `query`
  handshakeData.isAdmin = handshakeData._query.access_token === config.auth.token;
  accept(null, true);
});

function Viewers(sio) {
  var data = [];

  function notifyChanges() {
    sio.emit('viewers:updated', data);
  }

  return {
    add: function add(nickname) {
      data.push(nickname);
      notifyChanges();
    },
    remove: function remove(nickname) {
      var idx = data.indexOf(nickname);
      if (idx > -1) {
        data.splice(idx, 1);
      }
      notifyChanges();
      console.log('-->', data);
    }
  };
}

function Messages(sio) {
  var msg = [];

  function notifyChanges() {
    sio.emit('message:update', msg);
  }

  return {
    add: function add(message) {
      msg.push(message);
      notifyChanges();
    },
  };
}


var viewers = Viewers(sio);
var messages = Messages(sio);
// This object is used to store in real-time the teacher (relay.js) in order to send him file each time a student use relayEtu.js
var teacher = new Object();


// @todo extract in its own
sio.on('connection', function(socket) {

  // This is only called by the relay.js (not the Etu one), to store the socket ID into the object
  socket.on('teacher:co', function(){
    teacher.id = socket.id;
    console.log("Teacher socket ID : "+teacher.id+"");
  });

    socket.on('etu:co', function(){
      teacher.id = socket.id;
      console.log("New student socket open with ID : "+teacher.id+"");
  });


  socket.on('file:etuChange', function(filename, timestamp, content){
    console.log("tentative envoie fichier");
    console.log("ID socket emmeteur : "+socket.id);
    console.log(filename);
    console.log(timestamp);

    sio.sockets.connected[teacher.id].emit('etu:send', filename, timestamp, content);
  });

  // console.log('nouvelle connexion', socket.id);
  socket.on('viewer:new', function(nickname) {
    socket.nickname = nickname;
    viewers.add(nickname);
    console.log('new viewer with nickname %s', nickname, viewers);
  });

  socket.on('disconnect', function() {
    viewers.remove(socket.nickname);
    console.log('viewer disconnected %s\nremaining:', socket.nickname, viewers);
  });


  socket.on('message:updating', function(message) {
    messages.add(socket.nickname+" : "+ message);
  });


  socket.on('file:changed', function() {
    if (!socket.conn.request.isAdmin) {
      // if the user is not admin
      // skip this
      return socket.emit('error:auth', 'Unauthorized :)');
    }

    // forward the event to everyone
    sio.emit.apply(sio, ['file:changed'].concat(_.toArray(arguments)));
  });

  socket.visibility = 'visible';

  socket.on('user-visibility:changed', function(state) {
    socket.visibility = state;
    sio.emit('users:visibility-states', getVisibilityCounts());
  });
});

function getVisibilityCounts() {
  return _.chain(sio.sockets.sockets).values().countBy('visibility').value();
}
