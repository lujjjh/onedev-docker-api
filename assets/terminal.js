var docker = require('../docker-browser-console/browser');
var websocket = require('websocket-stream');
var pump = require('pump');

window.terminal = {};

window.terminal.attach = function (path, guid, elem) {
  var ws = websocket('ws://' + path);
  var terminal = docker({ guid: guid });
  pump(terminal, ws, terminal);
  terminal.appendTo(elem);
};
