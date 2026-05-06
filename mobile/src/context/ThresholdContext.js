import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "custom_thresholds";

export const DEFAULT_THRESHOLDS = {
  temperature: { warnHigh: 35,   dangerHigh: 40,   warnLow: null, dangerLow: null },
  humidity:    { warnHigh: 80,   dangerHigh: 90,   warnLow: null, dangerLow: null },
  eco2:        { warnHigh: 1000, dangerHigh: 2000, warnLow: null, dangerLow: null },
  tvoc:        { warnHigh: 300,  dangerHigh: 500,  warnLow: null, dangerLow: null },
  battery:     { warnHigh: null, dangerHigh: null, warnLow: 3.3,  dangerLow: 3.0  },
};

const ThresholdContext = createContext({
  getThresholds: () => DEFAULT_THRESHOLDS,
  setThresholds: () => {},
  resetThresholds: () => {},
});

export function ThresholdProvider({ children }) {
  // { [dev_eui]: { temperature: {...}, ... } }
  const [store, setStore] = useState({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setStore(JSON.parse(raw));
    });
  }, []);

  const save = useCallback((next) => {
    setStore(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const getThresholds = useCallback((devEui) => {
    const custom = store[devEui] || {};
    const result = {};
    for (const field of Object.keys(DEFAULT_THRESHOLDS)) {
      result[field] = { ...DEFAULT_THRESHOLDS[field], ...(custom[field] || {}) };
    }
    return result;
  }, [store]);

  const setThresholds = useCallback((devEui, thresholds) => {
    save({ ...store, [devEui]: thresholds });
  }, [store, save]);

  const resetThresholds = useCallback((devEui) => {
    const next = { ...store };
    delete next[devEui];
    save(next);
  }, [store, save]);

  return (
    <ThresholdContext.Provider value={{ getThresholds, setThresholds, resetThresholds }}>
      {children}
    </ThresholdContext.Provider>
  );
}

export function useThreshold() {
  return useContext(ThresholdContext);
}
