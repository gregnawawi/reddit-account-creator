class Script {
  constructor() {
    this.actions = [];
  }
  add(action) {
    this.actions.push(action);
  }
}

class Action {
  constructor(fn, params) {
    this.fn = fn;
    this.params = params;
  }
}

function test(a, b) {
  return a + b;
}

const s = new Script();
