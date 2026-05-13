import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

export const DEFAULT_THRESHOLDS = {
  temperature: { warnHigh: 35,   dangerHigh: 40,   warnLow: null, dangerLow: null },
  humidity:    { warnHigh: 80,   dangerHigh: 90,   warnLow: null, dangerLow: null },
  eco2:        { warnHigh: 1000, dangerHigh: 2000, warnLow: null, dangerLow: null },
  tvoc:        { warnHigh: 300,  dangerHigh: 500,  warnLow: null, dangerLow: null },
  battery:     { warnHigh: null, dangerHigh: null, warnLow: 3.3,  dangerLow: 3.0  },
};

const ThresholdContext = createContext({
  getThresholds:    () => DEFAULT_THRESHOLDS,
  setThresholds:    async () => {},
  resetThresholds:  async () => {},
  refreshThresholds: async () => {},
});

export function ThresholdProvider({ children }) {
  const [store, setStore] = useState({});

  const refreshThresholds = useCallback(async () => {
    try {
      const data = await api.getThresholds();
      setStore(data || {});
    } catch {
      // không fetch được, dùng default
    }
  }, []);

  useEffect(() => { refreshThresholds(); }, []);

  const getThresholds = useCallback((devEui) => {
    const custom = store[devEui] || {};
    const result = {};
    for (const field of Object.keys(DEFAULT_THRESHOLDS)) {
      result[field] = { ...DEFAULT_THRESHOLDS[field], ...(custom[field] || {}) };
    }
    return result;
  }, [store]);

  const setThresholds = useCallback(async (devEui, thresholds) => {
    setStore(prev => ({ ...prev, [devEui]: thresholds }));
    await api.setDeviceThresholds(devEui, thresholds);
  }, []);

  const resetThresholds = useCallback(async (devEui) => {
    setStore(prev => ({ ...prev, [devEui]: DEFAULT_THRESHOLDS }));
    await api.setDeviceThresholds(devEui, DEFAULT_THRESHOLDS);
  }, []);

  return (
    <ThresholdContext.Provider value={{ getThresholds, setThresholds, resetThresholds, refreshThresholds }}>
      {children}
    </ThresholdContext.Provider>
  );
}

export function useThreshold() {
  return useContext(ThresholdContext);
}
