var express = require('express');
var docker = require('docker-browser-console');
var WebSocketServer = require('ws').Server;
var websocket = require('websocket-stream');
var pump = require('pump');

var app = express();
var http = require('http').Server(app);

var wss = new WebSocketServer({ server: http });

wss.on('connection', function (socket) {
	var stream = websocket(socket);
	pump(stream, docker('onedev/c'), stream);
});

app.engine('.html', require('ejs').__express);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.render('index');
});

http.listen(3000, function () {
	console.log('listening on *:3000');
});
