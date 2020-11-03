const ANSI_DECORS = require("./ansi-decors.json");
const { EventEmitter } = require("events");

function Nodit(options = { plugins: [] }) {
  this.stdout = process.stdout;
  this.stdin = process.stdin;
  this.fg = 0;
  this.bg = 0;
  this.decor = 0;
  this.eventEmitter = new EventEmitter();
  this.stdin.setRawMode(true);
  this.stdout.write("\033c\x1B[?25l");
  this.createBuffer();
  require("keypress")(this.stdin);
  this.stdin.on("keypress", (char, key) => {
    if (key && key.name == "escape") {
      let willExit = true;
      let prevent = () => (willExit = false);
      this.eventEmitter.emit("exit", prevent);
      if (willExit) process.exit();
    }
    this.eventEmitter.emit("keypress", char, key);
    this.render();
  });
  this.plugins = {};
  for (let plugin of options.plugins || []) new plugin(this);
  this.eventEmitter.emit("init");
  this.render();
}
Nodit.prototype.createBuffer = function () {
  this.width = this.stdout.columns;
  this.height = this.stdout.rows;
  this.size = this.width * this.height;
  // context buffers
  this.fgBuffer = new Uint8Array(this.size);
  this.bgBuffer = new Uint8Array(this.size);
  this.decorBuffer = new Uint8Array(this.size);
  this.charBuffer = new Uint16Array(this.size);
  // previous to compare
  this.oldFgBuffer = new Uint8Array(this.size);
  this.oldBgBuffer = new Uint8Array(this.size);
  this.oldDecorBuffer = new Uint8Array(this.size);
  this.oldCharBuffer = new Uint16Array(this.size).fill(32);
};
Nodit.prototype.style = function (x, y, x1, y2) {
  for (let i = y; i < y2; i++)
    for (let j = x; j < x1; j++) {
      let p = this.width * i + j;
      this.fgBuffer[p] = this.fg;
      this.bgBuffer[p] = this.bg;
      this.decorBuffer[p] = this.decor;
    }
};
Nodit.prototype.text = function (string, x, y, x1, y2) {
  let p = 0;
  for (let i = y; i < y2; i++) for (let j = x; j < x1; j++) this.charBuffer[this.width * i + j] = string.charCodeAt(p++) || 32;
};
Nodit.prototype.renderCell = function (i) {
  if (this.oldFgBuffer[i] != this.fgBuffer[i] || this.oldBgBuffer[i] != this.bgBuffer[i] || this.oldCharBuffer[i] != this.charBuffer[i] || this.oldDecorBuffer[i] != this.decorBuffer[i]) {
    this.oldFgBuffer[i] = this.fgBuffer[i];
    this.oldBgBuffer[i] = this.bgBuffer[i];
    this.oldCharBuffer[i] = this.charBuffer[i];
    this.oldDecorBuffer[i] = this.decorBuffer[i];
    this.stdout.cursorTo(i % this.width, Math.floor(i / this.width));
    this.stdout.write(ANSI_DECORS[this.decorBuffer[i]] + "\u001b[38;5;" + this.fgBuffer[i] + "m\u001b[48;5;" + this.bgBuffer[i] + "m" + String.fromCharCode(this.charBuffer[i]));
  }
};
Nodit.prototype.render = function () {
  // this.stdout.write("\033c\x1B[?25l");

  for (let i = 0; i < this.size; i++) this.renderCell(i);
};
Nodit.prototype.renderRect = function (x, y, x1, y2) {
  for (let j = y; j < y2; j++) for (let i = x; i < x1; i++) this.renderCell(this.width * j + i);
};

module.exports = Nodit;
