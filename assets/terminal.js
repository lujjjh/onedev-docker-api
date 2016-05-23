var docker = require('docker-browser-console');
var websocket = require('websocket-stream');
var pump = require('pump');

window.terminal = {};

window.terminal.attach = function (path, guid, elem) {
  var terminal = docker();

  var ws = websocket('ws://' + path);
  ws.write(new Buffer(guid));
  pump(terminal, ws, terminal);
  terminal.appendTo(elem);
};
