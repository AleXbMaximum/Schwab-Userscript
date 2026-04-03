export function createStateMapping(globalStateRefs) {
  if (!globalStateRefs || typeof globalStateRefs !== "object") {
    throw new TypeError("globalStateRefs must be an object");
  }

  return {
    getters: {
      authToken: () => globalStateRefs.authToken,
      accountId: () => globalStateRefs.accountId,
      settings: () => globalStateRefs.settings,
      rawHoldings: () => globalStateRefs.rawHoldings,
      lastUpdate: () => globalStateRefs.lastUpdate,
      betaData: () => globalStateRefs.betaData,
    },

    setters: {
      authToken: (val) => (globalStateRefs.authToken = val),
      accountId: (val) => (globalStateRefs.accountId = val),
      settings: (val) => (globalStateRefs.settings = val),
      rawHoldings: (val) => (globalStateRefs.rawHoldings = val),
      lastUpdate: (val) => (globalStateRefs.lastUpdate = val),
      betaData: (val) => (globalStateRefs.betaData = val),
    },
  };
}

export function getStateValue(mapping, key) {
  const getter = mapping.getters[key];
  return getter ? getter() : undefined;
}

export function setStateValue(mapping, key, value) {
  const setter = mapping.setters[key];
  if (!setter) return false;

  setter(value);
  return true;
}
