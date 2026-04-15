export const STORAGE_KEY = "diet-user-profile";

export type Sex = "female" | "male";
export type GoalType = "fat_loss" | "muscle_gain";
export type ActivityLevel = "sedentary" | "light" | "active";
export type MacroKey = "protein" | "carbs" | "fat" | "fiber";
export type GoalPaceDirection = "maintain" | "deficit" | "surplus";

export interface UserProfile {
  username: string;
  age: number | null;
  sex: Sex;
  heightCm: number | null;
  weightKg: number | null;
  goal: GoalType;
  targetWeightKg: number | null;
  targetDays: number | null;
  activityLevel: ActivityLevel;
}

export interface MacroItem {
  key: MacroKey;
  label: string;
  grams: number;
  kcal: number;
  color: string;
}

export interface NutritionPlan {
  isComplete: boolean;
  completionMessage: string;
  bmr: number;
  tdee: number;
  dailyCalories: number;
  macros: MacroItem[];
}

export interface GoalPacePlan {
  direction: GoalPaceDirection;
  weightDeltaKg: number;
  totalKcalChange: number;
  requiredDailyGap: number;
  safeDailyGap: number;
  appliedDailyGap: number;
  safeRate: number;
  wasAdjusted: boolean;
  estimatedDaysAtSafePace: number;
}

export interface SavedProfileSnapshot {
  profile: UserProfile;
  nutritionPlan: NutritionPlan;
  savedAt: string;
}

export const defaultProfile: UserProfile = {
  username: "",
  age: null,
  sex: "female",
  heightCm: null,
  weightKg: null,
  goal: "fat_loss",
  targetWeightKg: null,
  targetDays: null,
  activityLevel: "light"
};

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55
};

const goalRatios: Record<GoalType, { protein: number; carbs: number; fat: number }> = {
  fat_loss: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  muscle_gain: { protein: 0.25, carbs: 0.55, fat: 0.2 }
};

export const macroPalette: Record<MacroKey, string> = {
  protein: "#D86A4A",
  carbs: "#E9A86F",
  fat: "#9D6B58",
  fiber: "#8DA56C"
};

const KG_TO_KCAL = 7700;

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function mergeProfileWithDefaults(profile?: Partial<UserProfile> | null): UserProfile {
  return {
    ...defaultProfile,
    ...profile
  };
}

function createMacro(key: MacroKey, grams: number, kcal: number): MacroItem {
  const labelMap: Record<MacroKey, string> = {
    protein: "蛋白质",
    carbs: "碳水",
    fat: "脂肪",
    fiber: "膳食纤维"
  };

  return {
    key,
    label: labelMap[key],
    grams,
    kcal,
    color: macroPalette[key]
  };
}

function buildEmptyPlan(message: string, sex: Sex): NutritionPlan {
  const fiberTarget = sex === "female" ? 25 : 38;

  return {
    isComplete: false,
    completionMessage: message,
    bmr: 0,
    tdee: 0,
    dailyCalories: 0,
    macros: [
      createMacro("protein", 0, 0),
      createMacro("carbs", 0, 0),
      createMacro("fat", 0, 0),
      createMacro("fiber", fiberTarget, 0)
    ]
  };
}

function calculateBmr(profile: UserProfile) {
  const bmrBase =
    10 * profile.weightKg! + 6.25 * profile.heightCm! - 5 * profile.age! + (profile.sex === "male" ? 5 : -161);

  return round(bmrBase);
}

export function calculateGoalPace(profile: UserProfile, providedTdee?: number): GoalPacePlan | null {
  if (!profile.weightKg || !profile.targetWeightKg || !profile.targetDays) {
    return null;
  }

  const weightDeltaKg = round(profile.targetWeightKg - profile.weightKg, 3);

  if (weightDeltaKg === 0) {
    return {
      direction: "maintain",
      weightDeltaKg,
      totalKcalChange: 0,
      requiredDailyGap: 0,
      safeDailyGap: 0,
      appliedDailyGap: 0,
      safeRate: 0,
      wasAdjusted: false,
      estimatedDaysAtSafePace: 0
    };
  }

  const bmr = calculateBmr(profile);
  const resolvedTdee = providedTdee ?? round(bmr * activityMultipliers[profile.activityLevel]);
  const totalKcalChange = round(Math.abs(weightDeltaKg) * KG_TO_KCAL);
  const requiredDailyGap = round(totalKcalChange / profile.targetDays);
  const direction: GoalPaceDirection = weightDeltaKg < 0 ? "deficit" : "surplus";
  const safeRate = direction === "deficit" ? 0.25 : 0.15;
  const safeDailyGap = round(resolvedTdee * safeRate);
  const appliedDailyGap = round(Math.min(requiredDailyGap, safeDailyGap));
  const wasAdjusted = requiredDailyGap > safeDailyGap;
  const estimatedDaysAtSafePace = appliedDailyGap > 0 ? Math.ceil(totalKcalChange / appliedDailyGap) : 0;

  return {
    direction,
    weightDeltaKg,
    totalKcalChange,
    requiredDailyGap,
    safeDailyGap,
    appliedDailyGap,
    safeRate,
    wasAdjusted,
    estimatedDaysAtSafePace
  };
}

export function calculateNutritionPlan(profile: UserProfile): NutritionPlan {
  const missingFields = [
    !profile.username && "用户名",
    !profile.age && "年龄",
    !profile.heightCm && "身高",
    !profile.weightKg && "体重",
    !profile.targetWeightKg && "目标体重",
    !profile.targetDays && "预计达成天数"
  ].filter(Boolean) as string[];

  if (missingFields.length > 0) {
    return buildEmptyPlan(`还需补充：${missingFields.join("、")}`, profile.sex);
  }

  const bmr = calculateBmr(profile);
  const tdee = round(bmr * activityMultipliers[profile.activityLevel]);
  const pacePlan = calculateGoalPace(profile, tdee);
  const ratio = goalRatios[profile.goal];
  const fiberTarget = profile.sex === "female" ? 25 : 38;

  let dailyCalories = tdee;
  let completionMessage = "已根据当前档案生成营养计划。";

  if (pacePlan?.direction === "deficit") {
    dailyCalories = round(tdee - pacePlan.appliedDailyGap);
    completionMessage = pacePlan.wasAdjusted
      ? "已根据目标体重和预计天数生成营养计划，已为您优化为更健康的达成速度。"
      : "已根据目标体重和预计天数生成营养计划。";
  } else if (pacePlan?.direction === "surplus") {
    dailyCalories = round(tdee + pacePlan.appliedDailyGap);
    completionMessage = pacePlan.wasAdjusted
      ? "已根据目标体重和预计天数生成营养计划，已为您优化为更健康的达成速度。"
      : "已根据目标体重和预计天数生成营养计划。";
  } else if (pacePlan?.direction === "maintain") {
    completionMessage = "当前体重与目标体重一致，已按维持热量生成营养计划。";
  }

  const proteinKcal = round(dailyCalories * ratio.protein);
  const carbsKcal = round(dailyCalories * ratio.carbs);
  const fatKcal = round(dailyCalories * ratio.fat);

  return {
    isComplete: true,
    completionMessage,
    bmr,
    tdee,
    dailyCalories,
    macros: [
      createMacro("protein", round(proteinKcal / 4), proteinKcal),
      createMacro("carbs", round(carbsKcal / 4), carbsKcal),
      createMacro("fat", round(fatKcal / 9), fatKcal),
      createMacro("fiber", fiberTarget, 0)
    ]
  };
}

export function getMacroTarget(plan: NutritionPlan, key: MacroKey) {
  return plan.macros.find((macro) => macro.key === key) ?? createMacro(key, 0, 0);
}

export function formatGoalLabel(goal: GoalType) {
  return goal === "fat_loss" ? "减脂" : "增肌";
}

export function formatActivityLabel(activityLevel: ActivityLevel) {
  switch (activityLevel) {
    case "sedentary":
      return "久坐";
    case "light":
      return "轻度运动";
    case "active":
      return "经常运动";
    default:
      return activityLevel;
  }
}
