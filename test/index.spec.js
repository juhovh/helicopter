const assert = require('chai').assert;
const helicopter = require('../src');

describe('Helicopter', function() {
  describe('with no timer', function() {
    const instance = helicopter();
    it('should resolve action immediately for no reducers', function(done) {
      instance.sendAction().then(result => done(), done);
    });
    it('should pass the action and initial state to the result when no reducers', function(done) {
      instance.sendAction('action', 'state').then(result => {
        assert.deepEqual(result, { type: 'SUCCESS', action: 'action', state: 'state' });
        done();
      }, done);
    });
    it('should resolve when sendResult resolves', function(done) {
      function sendResult(action, state, callbacks) {
        if (state === 42) return callbacks.resolve();
      }
      function eventReducer(action, state, event) {
        return event.value;
      }
      instance.sendAction('action', 0, sendResult, eventReducer).then(result => {
        assert.deepEqual(result, { type: 'SUCCESS', action: 'action', state: 42 });
        done();
      }, done);
      instance.processEvent({ value: 10 });
      instance.processEvent({ value: 16 });
      instance.processEvent({ value: 100 });
      instance.processEvent({ value: 42 });
      instance.processEvent({ value: 19 });
    });
    it('should interrupt when a same type of an action is sent', function(done) {
      function sendResult(action, state, callbacks) {
        if (state.interruptedBy) return callbacks.interrupt();
        if (action.degrees === state.degrees) return callbacks.resolve();
      }
      function eventReducer(action, state, event) {
        if (event.type === 'TURN') state.degrees = event.degrees;
        return state;
      }
      function actionReducer(action, state, nextAction) {
        if (action.type === nextAction.type) state.interruptedBy = nextAction;
        return state;
      }
      instance.sendAction({ type: 'TURN', degrees: 90 }, {}, sendResult, eventReducer, actionReducer).then(result => {
        assert.deepEqual(result, {
          type: 'INTERRUPTED',
          action: { type: 'TURN', degrees: 90 },
          state: { degrees: 45, interruptedBy: { type: 'TURN', degrees: 65 } }
        });
      }, done);
      instance.processEvent({ type: 'TURN', degrees: 15 });
      instance.processEvent({ type: 'TURN', degrees: 30 });
      instance.processEvent({ type: 'TURN', degrees: 45 });
      instance.sendAction({ type: 'TURN', degrees: 65 }, {}, sendResult, eventReducer, actionReducer).then(result => {
        assert.deepEqual(result, {
          type: 'SUCCESS',
          action: { type: 'TURN', degrees: 65 },
          state: { degrees: 65 }
        });
        done();
      }, done);
      instance.processEvent({ type: 'TURN', degrees: 60 });
      instance.processEvent({ type: 'TURN', degrees: 65 });
    });
  });
  describe('with timer', function() {
    const instance = helicopter({ timeout: 100 });
    it('should give empty events frequently enough', function(done) {
      const errorTimeout = 1500;
      function sendResult(action, state, callbacks) {
        if (state.elapsed > errorTimeout) return callbacks.reject();
      }
      function eventReducer(action, state, event) {
        state.elapsed = Date.now() - state.start;
        return state;
      }
      instance.sendAction('action', { start: Date.now() }, sendResult, eventReducer).then(done, result => {
        assert.strictEqual(result.type, 'ERROR');
        assert.strictEqual(result.action, 'action');
        assert.isAbove(result.state.elapsed, errorTimeout);
        done();
      });
    });
  });
});
