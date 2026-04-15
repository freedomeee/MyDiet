import { getMacroTarget, type MacroKey, type NutritionPlan } from "@/lib/profile";

export const DAILY_LOGS_STORAGE_KEY = "diet-daily-logs";
export const MOOD_MAX_SCORE_PER_DAY = 100;

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealMood = "happy" | "okay" | "sad" | "depressed";

export interface MealRecord {
  mealType: MealType;
  title: string;
  imageDataUrl: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  note: string;
  savedAt: string | null;
}

export interface DailyLog {
  date: string;
  dailyMood: MealMood | null;
  meals: Record<MealType, MealRecord | null>;
  updatedAt: string | null;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  completedMeals: number;
  moodScore: number;
  moodEntries: number;
  averageMoodScore: number;
}

export interface MacroProgressItem {
  key: MacroKey;
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
  percent: number;
}

const mealMeta: Record<
  MealType,
  {
    label: string;
    time: string;
    prompt: string;
  }
> = {
  breakfast: {
    label: "早餐",
    time: "07:00 - 09:30",
    prompt: "记录今天的第一餐"
  },
  lunch: {
    label: "午餐",
    time: "11:30 - 13:30",
    prompt: "上传午餐照片或补充营养信息"
  },
  dinner: {
    label: "晚餐",
    time: "17:30 - 20:00",
    prompt: "记录今天的晚餐安排"
  },
  snack: {
    label: "加餐",
    time: "任意时间",
    prompt: "别忘了水果、酸奶或其他加餐"
  }
};

const moodMeta: Record<
  MealMood,
  {
    label: string;
    score: number;
    icon: string;
    shortLabel: string;
    color: string;
    background: string;
  }
> = {
  happy: {
    label: "开心",
    score: 100,
    icon: "😄",
    shortLabel: "开心",
    color: "#5C8A3A",
    background: "#EEF7E8"
  },
  okay: {
    label: "一般",
    score: 75,
    icon: "🙂",
    shortLabel: "一般",
    color: "#8E6B3E",
    background: "#FBF1DE"
  },
  sad: {
    label: "伤心",
    score: 45,
    icon: "☹️",
    shortLabel: "伤心",
    color: "#8C5F67",
    background: "#F9E8EC"
  },
  depressed: {
    label: "抑郁",
    score: 20,
    icon: "🌧️",
    shortLabel: "低落",
    color: "#5E728D",
    background: "#EAF0F7"
  }
};

export const moodOptions = Object.entries(moodMeta).map(([key, value]) => ({
  key: key as MealMood,
  ...value
}));

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${year}年${month}月${day}日`;
}

export function createEmptyMeal(mealType: MealType): MealRecord {
  return {
    mealType,
    title: "",
    imageDataUrl: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
    note: "",
    savedAt: null
  };
}

function mergeMealRecord(mealType: MealType, meal: Partial<MealRecord> | null | undefined) {
  if (!meal) {
    return null;
  }

  return {
    ...createEmptyMeal(mealType),
    ...meal,
    mealType
  };
}

export function createEmptyDailyLog(date = getLocalDateKey()): DailyLog {
  return {
    date,
    dailyMood: null,
    meals: {
      breakfast: null,
      lunch: null,
      dinner: null,
      snack: null
    },
    updatedAt: null
  };
}

export function mergeDailyLog(log: Partial<DailyLog> | null | undefined, date = getLocalDateKey()): DailyLog {
  const base = createEmptyDailyLog(date);
  const legacyMeals = Object.values(log?.meals ?? {})
    .filter(Boolean)
    .map((meal) => (meal as Partial<{ mood: MealMood | null }>).mood)
    .filter(Boolean) as MealMood[];
  const fallbackMood = legacyMeals.length > 0 ? legacyMeals[legacyMeals.length - 1] : null;

  return {
    ...base,
    ...log,
    date,
    dailyMood: log?.dailyMood ?? fallbackMood,
    meals: {
      breakfast: mergeMealRecord("breakfast", log?.meals?.breakfast),
      lunch: mergeMealRecord("lunch", log?.meals?.lunch),
      dinner: mergeMealRecord("dinner", log?.meals?.dinner),
      snack: mergeMealRecord("snack", log?.meals?.snack)
    }
  };
}

export function getMealMeta(mealType: MealType) {
  return mealMeta[mealType];
}

export function getMoodMeta(mood: MealMood | null) {
  if (!mood) {
    return {
      label: "未记录",
      score: 0,
      icon: "○",
      shortLabel: "待选",
      color: "#8A7C74",
      background: "#F4ECE7"
    };
  }

  return moodMeta[mood];
}

export function calculateMoodScore(mood: MealMood | null) {
  return mood ? moodMeta[mood].score : 0;
}

function safeNumber(value: number | null | undefined) {
  return value ?? 0;
}

export function calculateDailyTotals(log: DailyLog): DailyTotals {
  const meals = Object.values(log.meals).filter(Boolean) as MealRecord[];
  const moodScore = calculateMoodScore(log.dailyMood);
  const moodEntries = log.dailyMood ? 1 : 0;

  const baseTotals = meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + safeNumber(meal.calories),
      protein: totals.protein + safeNumber(meal.protein),
      carbs: totals.carbs + safeNumber(meal.carbs),
      fat: totals.fat + safeNumber(meal.fat),
      fiber: totals.fiber + safeNumber(meal.fiber),
      completedMeals: totals.completedMeals + 1
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      completedMeals: 0
    }
  );

  return {
    ...baseTotals,
    moodScore,
    moodEntries,
    averageMoodScore: moodScore
  };
}

export function buildMacroProgress(plan: NutritionPlan, log: DailyLog): MacroProgressItem[] {
  const totals = calculateDailyTotals(log);
  const consumedMap: Record<MacroKey, number> = {
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber
  };

  return (["protein", "carbs", "fat", "fiber"] as MacroKey[]).map((key) => {
    const targetMacro = getMacroTarget(plan, key);
    const consumed = consumedMap[key];
    const target = targetMacro.grams;

    return {
      key,
      label: targetMacro.label,
      consumed,
      target,
      unit: "g",
      color: targetMacro.color,
      percent: target > 0 ? Math.min((consumed / target) * 100, 100) : 0
    };
  });
}

export function buildMealHighlight(record: MealRecord | null) {
  if (!record) {
    return "等待记录";
  }

  const protein = safeNumber(record.protein);
  const carbs = safeNumber(record.carbs);
  const fat = safeNumber(record.fat);
  const fiber = safeNumber(record.fiber);

  if (protein >= 30 && carbs <= 40) {
    return "蛋白质表现很稳";
  }

  if (fiber >= 8) {
    return "这餐纤维表现不错";
  }

  if (carbs > protein * 2 && carbs > 50) {
    return "这餐碳水偏多，下一餐可稍微收一点";
  }

  if (fat >= 20) {
    return "这餐脂肪略高，后续可以清淡些";
  }

  return "本餐记录已完成";
}

export function buildDailyAdvice(plan: NutritionPlan, log: DailyLog) {
  if (!plan.isComplete) {
    return "先完善用户档案并点击“确认并计算”，这里会同步出现每日目标与饮食建议。";
  }

  const totals = calculateDailyTotals(log);
  const macroProgress = buildMacroProgress(plan, log);
  const proteinGap = Math.max(getMacroTarget(plan, "protein").grams - totals.protein, 0);
  const carbsGap = Math.max(getMacroTarget(plan, "carbs").grams - totals.carbs, 0);
  const fiberGap = Math.max(getMacroTarget(plan, "fiber").grams - totals.fiber, 0);
  const remainingCalories = Math.max(plan.dailyCalories - totals.calories, 0);
  const fatPercent = macroProgress.find((item) => item.key === "fat")?.percent ?? 0;

  if (totals.completedMeals === 0) {
    return "今天还没有开始记录，先从早餐、午餐、晚餐或加餐里任选一餐填起来。";
  }

  if (totals.moodEntries > 0 && totals.moodScore <= 45) {
    return "今天心情有些低落，后续餐次尽量选温热、稳定能量的食物，比如粥、鸡蛋、鱼类和高纤主食。";
  }

  if (remainingCalories <= 120) {
    return "今天热量已经接近上限了，接下来尽量选择轻食和高纤维食物。";
  }

  if (proteinGap >= 25) {
    return `今天蛋白质还差约 ${Math.round(proteinGap)}g，后续可以补鸡胸肉、鱼、蛋或无糖酸奶。`;
  }

  if (fiberGap >= 8) {
    return `膳食纤维还差约 ${Math.round(fiberGap)}g，下一餐建议多加绿叶菜、菌菇或水果。`;
  }

  if (fatPercent >= 85) {
    return "今天脂肪已经比较靠近目标值了，后续尽量避开油炸和高油酱汁。";
  }

  if (carbsGap >= 35) {
    return `碳水还有 ${Math.round(carbsGap)}g 空间，可以优先选择米饭、土豆或全麦主食。`;
  }

  if (totals.moodScore >= 85) {
    return "今天心情和饮食节奏都很不错，继续保持这样稳定的记录方式就很好。";
  }

  return "今天的营养分配整体比较均衡，继续保持这样的记录节奏就很好。";
}

export function buildMealContribution(record: MealRecord, plan: NutritionPlan) {
  const items = [
    {
      label: "热量",
      consumed: safeNumber(record.calories),
      target: plan.dailyCalories,
      unit: "kcal"
    },
    {
      label: "蛋白质",
      consumed: safeNumber(record.protein),
      target: getMacroTarget(plan, "protein").grams,
      unit: "g"
    },
    {
      label: "碳水",
      consumed: safeNumber(record.carbs),
      target: getMacroTarget(plan, "carbs").grams,
      unit: "g"
    },
    {
      label: "脂肪",
      consumed: safeNumber(record.fat),
      target: getMacroTarget(plan, "fat").grams,
      unit: "g"
    },
    {
      label: "纤维",
      consumed: safeNumber(record.fiber),
      target: getMacroTarget(plan, "fiber").grams,
      unit: "g"
    }
  ];

  return items.map((item) => ({
    ...item,
    percent: item.target > 0 ? Math.min((item.consumed / item.target) * 100, 100) : 0
  }));
}
