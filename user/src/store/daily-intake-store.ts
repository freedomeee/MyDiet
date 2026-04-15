"use client";

import { create } from "zustand";

import {
  DAILY_LOGS_STORAGE_KEY,
  createEmptyDailyLog,
  getLocalDateKey,
  mergeDailyLog,
  type DailyLog,
  type MealMood,
  type MealRecord,
  type MealType
} from "@/lib/daily-log";

interface DailyIntakeState {
  dateKey: string;
  logs: Record<string, DailyLog>;
  isHydrated: boolean;
  loadFromStorage: () => void;
  syncToday: () => void;
  setActiveDate: (dateKey: string) => void;
  saveDailyMood: (mood: MealMood) => void;
  saveMeal: (mealType: MealType, meal: Omit<MealRecord, "mealType" | "savedAt">) => void;
  removeMeal: (mealType: MealType) => void;
}

function persistLogs(logs: Record<string, DailyLog>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DAILY_LOGS_STORAGE_KEY, JSON.stringify(logs, null, 2));
}

function ensureLog(logs: Record<string, DailyLog>, dateKey: string) {
  if (logs[dateKey]) {
    return logs;
  }

  return {
    ...logs,
    [dateKey]: createEmptyDailyLog(dateKey)
  };
}

export const useDailyIntakeStore = create<DailyIntakeState>((set, get) => ({
  dateKey: getLocalDateKey(),
  logs: {},
  isHydrated: false,
  loadFromStorage: () => {
    if (typeof window === "undefined") {
      return;
    }

    const todayKey = getLocalDateKey();

    try {
      const saved = window.localStorage.getItem(DAILY_LOGS_STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as Record<string, DailyLog>) : {};
      const mergedLogs = Object.fromEntries(
        Object.entries(parsed).map(([key, log]) => [key, mergeDailyLog(log, key)])
      ) as Record<string, DailyLog>;
      const nextLogs = ensureLog(mergedLogs, todayKey);

      set({
        dateKey: todayKey,
        logs: nextLogs,
        isHydrated: true
      });

      persistLogs(nextLogs);
    } catch (error) {
      console.error("Failed to load daily logs", error);
      const nextLogs = ensureLog({}, todayKey);

      set({
        dateKey: todayKey,
        logs: nextLogs,
        isHydrated: true
      });

      persistLogs(nextLogs);
    }
  },
  syncToday: () => {
    const todayKey = getLocalDateKey();
    const state = get();
    const nextLogs = ensureLog(state.logs, todayKey);

    if (nextLogs !== state.logs) {
      persistLogs(nextLogs);
      set({ logs: nextLogs });
    }
  },
  setActiveDate: (dateKey) =>
    set((state) => {
      const safeDateKey = dateKey || getLocalDateKey();
      const nextLogs = ensureLog(state.logs, safeDateKey);
      persistLogs(nextLogs);

      return {
        dateKey: safeDateKey,
        logs: nextLogs
      };
    }),
  saveDailyMood: (mood) =>
    set((state) => {
      const dateKey = state.dateKey || getLocalDateKey();
      const currentLog = mergeDailyLog(state.logs[dateKey], dateKey);
      const nextLog: DailyLog = {
        ...currentLog,
        dailyMood: mood,
        updatedAt: new Date().toISOString()
      };
      const nextLogs = {
        ...state.logs,
        [dateKey]: nextLog
      };

      persistLogs(nextLogs);

      return {
        logs: nextLogs
      };
    }),
  saveMeal: (mealType, meal) =>
    set((state) => {
      const dateKey = state.dateKey || getLocalDateKey();
      const currentLog = mergeDailyLog(state.logs[dateKey], dateKey);
      const nextLog: DailyLog = {
        ...currentLog,
        meals: {
          ...currentLog.meals,
          [mealType]: {
            ...meal,
            mealType,
            savedAt: new Date().toISOString()
          }
        },
        updatedAt: new Date().toISOString()
      };
      const nextLogs = {
        ...state.logs,
        [dateKey]: nextLog
      };

      persistLogs(nextLogs);

      return {
        logs: nextLogs
      };
    }),
  removeMeal: (mealType) =>
    set((state) => {
      const dateKey = state.dateKey || getLocalDateKey();
      const currentLog = mergeDailyLog(state.logs[dateKey], dateKey);
      const nextLog: DailyLog = {
        ...currentLog,
        meals: {
          ...currentLog.meals,
          [mealType]: null
        },
        updatedAt: new Date().toISOString()
      };
      const nextLogs = {
        ...state.logs,
        [dateKey]: nextLog
      };

      persistLogs(nextLogs);

      return {
        logs: nextLogs
      };
    })
}));
