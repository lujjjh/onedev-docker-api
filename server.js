var express = require('express');
var bodyParser = require('body-parser');
var Guid = require('guid');
var docker = require('docker-browser-console');
var WebSocketServer = require('ws').Server;
var websocket = require('websocket-stream');
var pump = require('pump');
var redis = require("redis").createClient();

var REDIS_GUID_PREFIX = 'onedev.docker.api.';

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/guids/generate', function (req, res) {
  var guid = Guid.raw();
  redis.set(REDIS_GUID_PREFIX + guid, JSON.stringify(req.body),
    'EX', 120, function (err) {
      res.send({ 'guid': guid });
    });
});

app.listen(3000, '127.0.0.1', function () {
  console.log('listening on 127.0.0.1:3000');
});

var wss = new WebSocketServer({ port: 8081 });

wss.on('connection', function (socket) {
  socket.once('message', function (guid) {
    if (!Guid.isGuid(guid)) {
      socket.close();
      return;
    }

    redis.get(REDIS_GUID_PREFIX + guid, function (err, options) {
      if (!options) {
        socket.close();
        return;
      }

      options = JSON.parse(options);

      var stream = websocket(socket);
      pump(stream, docker(options.image), stream);
    });
  });
});

console.log('listening on 0.0.0.0:8081');
