import {Subject, BehaviorSubject} from 'rxjs';
import { isPromise as rxIsPromise } from 'rxjs/util/isPromise';

const state = {
  a: 1,
  b: 'hello'
};

function isActions(v) {
  return Array.isArray(v);
}

function isPromise(v) {
  return rxIsPromise(v);
}

class Dispatcher {
  constructor() {
    this.begin = new Subject();
    this.continue = new Subject();
    this.complete = new Subject();
  }

  emit(action) {
    if (isActions(action)) {
      this.emitAll(action);
      return;
    }
    this.emitAll([action]);
  }

  emitAll(actions) {
    const queueStack = actions.map((action, i) => {
      const actionQueue = new Subject();
      actionQueue.subscribe((state) => {
        const result = actions[i](state);
        if (isPromise(result)) {
          result.then((resultSt) => {
            if (!queueStack[i + 1]) {
              this.continue.next({result: resultSt, queue: this.complete});
            }
            this.continue.next({result: resultSt, queue: queueStack[i + 1]});
          });
          return;
        }
        if (!queueStack[i + 1]) {
          this.continue.next({result, queue: this.complete});
        }
        this.continue.next({result, queue: queueStack[i + 1]});
      });

      return actionQueue;
    });

    this.begin.next(queueStack[0]);
  }

  beginSubscribe(observer) {
    this.begin.subscribe((actionQueue) => {
      observer(actionQueue);
    });
  }

  continueSubscribe(observer) {
    this.continue.subscribe((resultState) => {
      observer(resultState);
    });
  }

  completeSubscribe(observer) {
    this.complete.subscribe((resultState) => {
      observer(resultState);
    });
  }
}

class Store {
  constructor(dispatcher) {
    this.dispatcher = dispatcher;
    const initState = state;
    //
    this.stateRef    = Object.assign({}, initState);
    this._observable = new BehaviorSubject(this.stateRef);

    this.dispatcher.beginSubscribe((actionQueue) => {
      actionQueue.next(Object.assign({}, this.stateRef));
    });
    this.dispatcher.continueSubscribe((params) => {
      this.stateRef = Object.assign({}, this.stateRef, params.result);
      params.queue.next(this.stateRef);
    });
    this.dispatcher.completeSubscribe((params) => {
      this.stateRef = Object.assign({}, this.stateRef, params.result);
      this._observable.next(this.stateRef);
    });
  }

  get observable() {
    return this._observable;
  }
}

const dispatcher = new Dispatcher();
const store = new Store(dispatcher);
store.observable.subscribe(s => console.log(s));

// console.log(1);
// dispatcher.emit((st) => {
//   return new Promise((resolve) => {
//     resolve({a: st.a + 10});
//   });
// });

console.log(2);
dispatcher.emitAll([
  (st) => {
    console.log(10);
    return {a: st.a + 1};
  },
  (st) => {
    return new Promise((resolve) => {
      console.log(20);
      setTimeout(() => {
        console.log(25);
        resolve({a: st.a + 1});
      }, 1000);
    });
  },
  (st) => {
    console.log(30);
    return {a: st.a + 1};
  }
]);
//
// console.log(3);
// dispatcher.emit((st) => {
//   console.log(JSON.stringify(st));
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       console.log(JSON.stringify(st));
//       resolve({a: st.a / 3})
//     }, 3000);
//   });
// });
//
// console.log(4);
// dispatcher.emit((st) => {
//   return {a: st.a + 1};
// });
//
// console.log(4);
// dispatcher.emit((st) => {
//   return {a: st.a + 1};
// });
