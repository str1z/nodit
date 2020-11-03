const Nodit = require("./nodit");
const fs = require("fs");
const path = require("path");
const clipboardy = require("clipboardy");

const LINE_SPLIT_RE = /\r?\n+/g;
const SPECIAL_KEYS = {
  backspace: (editor) => editor.doBackspace(),
  left: (editor, key) => {
    editor.doSelection(key);
    editor.cursorLeft();
  },
  right: (editor, key) => {
    editor.doSelection(key);
    editor.cursorRight();
  },
  down: (editor, key) => {
    editor.doSelection(key);
    editor.cursorDown();
  },
  up: (editor, key) => {
    editor.doSelection(key);
    editor.cursorUp();
  },
  return: (editor) => editor.doReturn(),
};

class EBuffer {
  constructor(nodit = new Nodit()) {
    this.nodit = nodit;
    this.style = {
      lineBarFg: 250,
      lineBarBg: 234,
      contentFg: 250,
      contentBg: 233,
      infoBarFg: 250,
      infoBarBg: 236,
    };

    this.scrollX = 0;
    this.scrollY = 0;
    this.cursorX = 0;
    this.cursorY = 0;
    this.selectX = 0;
    this.selectY = 0;
    this.isSelection = false;

    this.content = [""];
    this.loadFile(__dirname + "/ansi-colors.json");
    this.resize();
    this.listenEvents();
  }

  resize() {
    let lineBarWidth = 6;
    let bounds = {};
    this.bounds = bounds;
    // all editor
    bounds.x1 = 10;
    bounds.y1 = 1;
    bounds.x2 = 100;
    bounds.y2 = this.nodit.height - 1;
    // info bar
    bounds.ix1 = bounds.x1;
    bounds.iy1 = bounds.y2 - 1;
    bounds.ix2 = bounds.x2;
    bounds.iy2 = bounds.y2;
    // line bar
    bounds.lx1 = bounds.x1;
    bounds.ly1 = bounds.y1;
    bounds.lx2 = bounds.x1 + lineBarWidth;
    bounds.ly2 = bounds.y2 - 1;
    // content
    bounds.cx1 = bounds.x1 + lineBarWidth;
    bounds.cy1 = bounds.y1;
    bounds.cx2 = bounds.x2;
    bounds.cy2 = bounds.y2 - 1;
    bounds.cw = bounds.cx2 - bounds.cx1;
  }

  loadFile(filePath) {
    this.fileName = path.basename(filePath);
    let raw = fs.readFileSync(filePath, { encoding: "utf-8" });
    this.content = raw.split(LINE_SPLIT_RE);
  }

  listenEvents() {
    this.nodit.eventEmitter.addListener("keypress", this.onkeypress.bind(this));
    this.nodit.eventEmitter.addListener("init", () => this.render());
  }

  onkeypress(char, key) {
    if (key) {
      if (SPECIAL_KEYS[key.name]) SPECIAL_KEYS[key.name](this, key);
      else if (key.ctrl) {
        if (key.name == "v") this.doMultilineInsert(clipboardy.readSync());
      } else if (char) this.doInsert(char);
    } else if (char) this.doInsert(char);
    this.needScroll();
    this.render();
    fs.writeFileSync(
      __dirname + "/debug.json",
      JSON.stringify({ char, key, content: this.content, size: this.nodit.size, cursorX: this.cursorX, cursorY: this.cursorY, scrollX: this.scrollX, scrollY: this.scrollY }, null, 2)
    );
  }

  drawStyle() {
    // infor bar
    this.nodit.fg = this.style.infoBarFg;
    this.nodit.bg = this.style.infoBarBg;
    this.nodit.style(this.bounds.ix1, this.bounds.iy1, this.bounds.ix2, this.bounds.iy2);
    // line bar
    this.nodit.fg = this.style.lineBarFg;
    this.nodit.bg = this.style.lineBarBg;
    this.nodit.style(this.bounds.lx1, this.bounds.ly1, this.bounds.lx2, this.bounds.ly2);
    // content
    this.nodit.fg = this.style.contentFg;
    this.nodit.bg = this.style.contentBg;
    this.nodit.style(this.bounds.cx1, this.bounds.cy1, this.bounds.cx2, this.bounds.cy2);
  }
  drawContent() {
    let i = this.scrollY;
    for (let y = this.bounds.cy1; y < this.bounds.cy2; y++)
      if (i < this.content.length) this.nodit.text(String(i + 1).padStart(5) + " " + this.content[i++].substring(this.scrollX), this.bounds.x1, y, this.bounds.x2, this.bounds.y2);
    this.nodit.text(
      ` ${this.fileName}:${this.cursorY}:${this.cursorX}   scroll:${this.scrollY}:${this.scrollX}   select:${this.isSelection}`,
      this.bounds.ix1,
      this.bounds.iy1,
      this.bounds.ix2,
      this.bounds.iy2
    );
  }
  drawSlection() {
    let fromX = this.selectX;
    let fromY = this.selectY;
    let toX = this.cursorX;
    let toY = this.cursorY;
    let flip = () => {
      fromX = this.cursorX;
      fromY = this.cursorY;
      toX = this.selectX;
      toY = this.selectY;
    };
    if (toY < fromY) flip();
    else if (toY == fromY && toX < fromX) flip();
    if (toY == fromY) {
      let x1 = fromX + this.bounds.cx1 - this.scrollX;
      let y1 = fromY + this.bounds.cy1 - this.scrollY;
      let x2 = toX + this.bounds.cx1 - this.scrollX;
      let y2 = toY + 1 + this.bounds.cy1 - this.scrollY;
      this.nodit.style(x1, y1, x2, y2);
    } else {
      let x1, x2, y1, y2;
      x1 = fromX + this.bounds.cx1 - this.scrollX;
      y1 = fromY + this.bounds.cy1 - this.scrollY;
      x2 = this.content[fromY].length + this.bounds.cx1 - this.scrollX;
      y2 = fromY + 1 + this.bounds.cy1 - this.scrollY;
      this.nodit.style(x1, y1, x2, y2);
      for (let y = fromY + 1; y < toY; y++) {
        x1 = this.bounds.cx1 - this.scrollX;
        y1 = y + this.bounds.cy1 - this.scrollY;
        x2 = this.content[y].length + this.bounds.cx1 - this.scrollX;
        y2 = y + 1 + this.bounds.cy1 - this.scrollY;
        this.nodit.style(x1, y1, x2, y2);
      }
      x1 = this.bounds.cx1 - this.scrollX;
      y1 = toY + this.bounds.cy1 - this.scrollY;
      x2 = toX + this.bounds.cx1 - this.scrollX;
      y2 = toY + 1 + this.bounds.cy1 - this.scrollY;
      this.nodit.style(x1, y1, x2, y2);
    }
  }
  drawCursor() {
    this.nodit.decor = 7;
    if (this.isSelection) this.drawSlection();
    else {
      let x1 = this.cursorX + this.bounds.cx1 - this.scrollX;
      let y1 = this.cursorY + this.bounds.cy1 - this.scrollY;
      let x2 = this.cursorX + this.bounds.cx1 + 1 - this.scrollX;
      let y2 = this.cursorY + 1 + this.bounds.cy1 - this.scrollY;
      this.nodit.style(x1, y1, x2, y2);
    }
    this.nodit.decor = 0;
  }

  render() {
    this.drawStyle();
    this.drawCursor();
    this.drawContent();
  }

  doSelection(key) {
    if (key.shift) {
      if (!this.isSelection) {
        this.isSelection = true;
        this.selectX = this.cursorX;
        this.selectY = this.cursorY;
      }
    } else this.isSelection = false;
  }

  getLine() {
    return this.content[this.cursorY];
  }

  doInsert(string) {
    this.isSelection = false;
    let line = this.getLine();
    this.content[this.cursorY] = line.substring(0, this.cursorX) + string + line.substr(this.cursorX);
    this.cursorX += string.length;
  }

  doMultilineInsert(string) {
    this.isSelection = false;
    let array = string.split(LINE_SPLIT_RE);
    if (array.length == 1) this.doInsert(array[0]);
    else {
      for (let i = 0; i < array.length - 1; i++) {
        this.doInsert(array[i]);
        this.doReturn();
      }
      this.doInsert(array[array.length - 1]);
    }
  }

  doBackspace() {
    let line = this.getLine();
    this.content[this.cursorY] = line.substring(0, this.cursorX - 1) + line.substr(this.cursorX);
    if (this.cursorX == 0 && this.cursorY > 0) {
      let line = this.getLine();
      this.content.splice(this.cursorY--, 1);
      this.cursorEnd();
      this.content[this.cursorY] += line;
      this.needScrollUp();
    } else {
      this.cursorLeft();
    }
  }

  doReturn() {
    let line = this.getLine();
    this.content[this.cursorY] = line.substring(0, this.cursorX);
    this.content.splice(this.cursorY + 1, 0, line.substr(this.cursorX));
    this.cursorStart();
    this.cursorDown();
  }

  cursorUp() {
    if (this.cursorY > 0) this.cursorY--;
    if (this.cursorX > this.getLine().length) this.cursorEnd();
  }

  cursorDown() {
    if (this.cursorY < this.content.length - 1) this.cursorY++;
    if (this.cursorX > this.getLine().length) this.cursorEnd();
  }

  cursorEnd() {
    this.cursorX = this.getLine().length;
  }

  cursorStart() {
    this.cursorX = 0;
  }

  cursorLeft() {
    if (this.cursorX > 0) this.cursorX--;
    else {
      if (this.cursorY > 0) {
        this.cursorY--;
        this.cursorEnd();
      }
      if (this.cursorX > this.getLine().length) this.cursorEnd();
    }
  }

  cursorRight() {
    if (this.cursorX < this.getLine().length) this.cursorX++;
    else {
      if (this.cursorY < this.content.length - 1) {
        this.cursorY++;
        this.cursorStart();
      }
      if (this.cursorX > this.getLine().length) this.cursorEnd();
    }
  }

  needScrollUp() {
    if (this.cursorY <= this.scrollY - this.bounds.cy1) this.scrollY--;
  }
  needScrollDown() {
    if (this.cursorY >= this.scrollY + this.bounds.cy2 - this.bounds.cy1) this.scrollY++;
  }
  needScrollLeft() {
    if (this.cursorX < this.scrollX) this.scrollX--;
    if (this.cursorX < this.scrollX) this.scrollX = this.cursorX;
  }
  needScrollRight() {
    if (this.cursorX >= this.scrollX + this.bounds.cw) this.scrollX++;
    if (this.cursorX >= this.scrollX + this.bounds.cw) this.scrollX = this.cursorX - this.bounds.cw + 1;
  }
  needScroll() {
    this.needScrollUp();
    this.needScrollDown();
    this.needScrollLeft();
    this.needScrollRight();
  }
}

module.exports = EBuffer;
