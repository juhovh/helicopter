const winston = require('winston');

function getResolve(pendingAction, resolve, reject) {
  return function() {
    if (pendingAction.inactive) {
      winston.error(`Resolving a non-active action ${JSON.stringify(pendingAction.action)}`);
      throw new Error('Tried to resolve a non-active action');
    }
    winston.debug(`Resolving action ${JSON.stringify(pendingAction.action)} with state: ${JSON.stringify(pendingAction.state)}`);
    pendingAction.inactive = true;
    resolve({
      type: 'SUCCESS',
      action: pendingAction.action,
      state: pendingAction.state
    });
  };
}

function getInterrupt(pendingAction, resolve, reject) {
  return function() {
    if (pendingAction.inactive) {
      winston.error(`Interrupting a non-active action ${JSON.stringify(pendingAction.action)}`);
      throw new Error('Tried to interrupt a non-active action');
    }
    winston.debug(`Interrupting action ${JSON.stringify(pendingAction.action)} with state: ${JSON.stringify(pendingAction.state)}`);
    pendingAction.inactive = true;
    resolve({
      type: 'INTERRUPTED',
      action: pendingAction.action,
      state: pendingAction.state
    });
    return true;
  };
}

function getReject(pendingAction, resolve, reject) {
  return function() {
    if (pendingAction.inactive) {
      winston.error(`Rejecting a non-active action ${JSON.stringify(pendingAction.action)}`);
      throw new Error('Tried to resolve a non-active action');
    }
    winston.debug(`Rejecting action ${JSON.stringify(pendingAction.action)} with state: ${JSON.stringify(pendingAction.state)}`);
    pendingAction.inactive = true;
    reject({
      type: 'ERROR',
      action: pendingAction.action,
      state: pendingAction.state
    });
    return true;
  };
}

function startTimeoutFeeder(timeoutms, feedCallback) {
  if (timeoutms <= 0) return;

  let timeout = null;
  function timeoutFeeder() {
    feedCallback();
    setTimeout(timeoutFeeder, timeoutms);
  }
  timeout = setTimeout(timeoutFeeder, timeoutms);
}

module.exports = function createInstance(options = {}) {
  const timeoutms = options.timeout || 0;
  let pendingActions = [];

  function processResults() {
    pendingActions.forEach(obj => obj.sendResult(obj.action, obj.state, obj.callbacks));
    pendingActions = pendingActions.filter(obj => !obj.inactive);
  }

  function sendAction(action, initialState, sendResult, eventReducer, actionReducer) {
    if (!sendResult) sendResult = (action, state, callbacks) => callbacks.resolve(state);
    if (!actionReducer) actionReducer = (action, state, input) => state;
    if (!eventReducer) eventReducer = (action, state, input) => state;

    pendingActions.forEach(obj => {
      obj.state = obj.actionReducer(obj.action, obj.state, action);
    });

    return new Promise((resolve, reject) => {
      const pendingAction = {
        state: initialState,
        action,
        sendResult,
        actionReducer,
        eventReducer,
      };
      pendingAction.callbacks = {
        resolve: getResolve(pendingAction, resolve, reject),
        interrupt: getInterrupt(pendingAction, resolve, reject),
        reject: getReject(pendingAction, resolve, reject)
      };
      pendingActions.push(pendingAction);
      processResults();
    });
  }

  function processEvent(event) {
    pendingActions.forEach(obj => {
      obj.state = obj.eventReducer(obj.action, obj.state, event);
    });
    processResults();
  }

  function getPendingActions() {
    return pendingActions.map(obj => obj.action);
  }

  startTimeoutFeeder(timeoutms, processEvent);
  return {
    sendAction,
    processEvent,
    getPendingActions,
  };
};
