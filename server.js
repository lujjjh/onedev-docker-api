var express = require('express');
var bodyParser = require('body-parser');
var Guid = require('guid');
var dockerConsole = require('./docker-browser-console');
var WebSocketServer = require('ws').Server;
var websocket = require('websocket-stream');
var pump = require('pump');
var redis = require("redis").createClient();
var ndjson = require('ndjson');
var duplexify = require('duplexify');
var Docker = require('dockerode');
var docker = new Docker();
var mkdirp = require('mkdirp');
var spawn = require('child_process').spawn;

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

function emitLines (stream) {
  var backlog = ''
  stream.on('data', function (data) {
    backlog += data
    var n = backlog.indexOf('\n')
    // got a \n? emit one or more 'line' events
    while (~n) {
      stream.emit('line', backlog.substring(0, n))
      backlog = backlog.substring(n + 1)
      n = backlog.indexOf('\n')
    }
  })
  stream.on('end', function () {
    if (backlog) {
      stream.emit('line', backlog)
    }
  })
}

app.post('/ports/forward', function (req, res) {
  var guid = req.body.guid;
  var port = req.body.port;
  redis.get(REDIS_GUID_PREFIX + guid + '.id', function (err, id) {
    var container = docker.getContainer(id);
    container.inspect(function (err, data) {
      if (err) {
        res.send({ url: '' });
        return;
      }
      var ip = data.NetworkSettings.IPAddress;
      var child = spawn('docker', ['run', '--rm', 'onedev/ngrok', 'ngrok', '-log=stdout', '-log-level=INFO', ip + ':' + port]);
      emitLines(child.stdout);
      child.stdout.setEncoding('utf8');
      var found = false;
      var re = /Tunnel established at (http:\/\/[^\/]+)/;
      child.stdout.on('line', function (line) {
        if (!found && re.test(line)) {
          found = true;
          var url = line.match(re)[1];
          url = url.replace(/:\d+$/, '');
          res.send({ url: url });
        }
      });
    });
  });
});

app.listen(process.env.PORT || 3000, process.env.HOST || '127.0.0.1');

var wss = new WebSocketServer({ port: process.env.WEBSOCKET_PORT || 8081 });

wss.on('connection', function (socket) {
  var stream = websocket(socket);
  var guid;
  var myDockerConsole = dockerConsole(getOpts, function (myDocker) {
    myDocker.once('spawn', function (id) {
      redis.set(REDIS_GUID_PREFIX + guid + '.id', id);
    });
  });
  pump(stream, myDockerConsole, stream);

  function getOpts(g, callback) {
    guid = g;
    redis.get(REDIS_GUID_PREFIX + guid, function (err, options) {
      if (!options) {
        socket.close();
        return;
      }
      options = JSON.parse(options);
      // for (var host in options.volumes || {}) {
      //   mkdirp.sync(host);
      // }
      callback(options);
    });
  }
});

console.log('Server started');
