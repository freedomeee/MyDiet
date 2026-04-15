"use client";

import { create } from "zustand";

import {
  STORAGE_KEY,
  calculateNutritionPlan,
  defaultProfile,
  mergeProfileWithDefaults,
  type SavedProfileSnapshot,
  type UserProfile
} from "@/lib/profile";

interface ProfileState {
  profile: UserProfile;
  appliedProfile: UserProfile | null;
  savedSnapshot: SavedProfileSnapshot | null;
  isHydrated: boolean;
  applyMessage: string;
  updateField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void;
  loadFromStorage: () => void;
  applyProfile: () => void;
  saveProfile: () => void;
}

function persistSnapshot(profile: UserProfile) {
  if (typeof window === "undefined") {
    return null;
  }

  const snapshot: SavedProfileSnapshot = {
    profile,
    nutritionPlan: calculateNutritionPlan(profile),
    savedAt: new Date().toISOString()
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: defaultProfile,
  appliedProfile: null,
  savedSnapshot: null,
  isHydrated: false,
  applyMessage: "填写或修改资料后，点击“确认并计算”更新右侧结果。",
  updateField: (field, value) =>
    set((state) => {
      const nextProfile = {
        ...state.profile,
        [field]: value
      };
      const snapshot = persistSnapshot(nextProfile);

      return {
        profile: nextProfile,
        savedSnapshot: snapshot ?? state.savedSnapshot,
        applyMessage: "资料已修改，点击“确认并计算”刷新右侧结果。"
      };
    }),
  loadFromStorage: () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        set({ isHydrated: true });
        return;
      }

      const parsed = JSON.parse(saved) as SavedProfileSnapshot;
      const mergedProfile = mergeProfileWithDefaults(parsed.profile);

      set({
        profile: mergedProfile,
        appliedProfile: mergedProfile,
        savedSnapshot: {
          ...parsed,
          profile: mergedProfile,
          nutritionPlan: calculateNutritionPlan(mergedProfile)
        },
        isHydrated: true,
        applyMessage: "已载入上次资料，可继续修改并重新计算。"
      });
    } catch (error) {
      console.error("Failed to load profile snapshot", error);
      set({
        isHydrated: true,
        applyMessage: "填写或修改资料后，点击“确认并计算”更新右侧结果。"
      });
    }
  },
  applyProfile: () => {
    const profile = mergeProfileWithDefaults(get().profile);

    set({
      appliedProfile: profile,
      applyMessage: "右侧结果已按当前资料更新。"
    });
  },
  saveProfile: () => {
    const snapshot = persistSnapshot(get().profile);

    if (!snapshot) {
      return;
    }

    set({
      savedSnapshot: snapshot
    });
  }
}));
