"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ImagePlus,
  NotebookPen,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  Waves,
  X
} from "lucide-react";

import {
  MOOD_MAX_SCORE_PER_DAY,
  buildDailyAdvice,
  buildMacroProgress,
  buildMealContribution,
  buildMealHighlight,
  calculateDailyTotals,
  createEmptyDailyLog,
  createEmptyMeal,
  formatDateLabel,
  getLocalDateKey,
  getMealMeta,
  getMoodMeta,
  moodOptions,
  type MealMood,
  type MealRecord,
  type MealType
} from "@/lib/daily-log";
import { calculateNutritionPlan, formatGoalLabel } from "@/lib/profile";
import { useDailyIntakeStore } from "@/store/daily-intake-store";
import { useProfileStore } from "@/store/profile-store";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MealDraft = Omit<MealRecord, "mealType" | "savedAt">;

const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function toInputValue(value: number | null) {
  return value ?? "";
}

function parseNumber(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatAmount(value: number) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(value, 100));
}

function buildDraftFromMeal(meal: MealRecord | null, mealType: MealType): MealDraft {
  const base = createEmptyMeal(mealType);

  if (!meal) {
    return {
      title: "",
      imageDataUrl: null,
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      note: ""
    };
  }

  return {
    title: meal.title ?? base.title,
    imageDataUrl: meal.imageDataUrl ?? base.imageDataUrl,
    calories: meal.calories ?? base.calories,
    protein: meal.protein ?? base.protein,
    carbs: meal.carbs ?? base.carbs,
    fat: meal.fat ?? base.fat,
    fiber: meal.fiber ?? base.fiber,
    note: meal.note ?? base.note
  };
}

function buildPreviewMeal(mealType: MealType, draft: MealDraft): MealRecord {
  return {
    mealType,
    title: draft.title.trim(),
    imageDataUrl: draft.imageDataUrl,
    calories: draft.calories,
    protein: draft.protein,
    carbs: draft.carbs,
    fat: draft.fat,
    fiber: draft.fiber,
    note: draft.note.trim(),
    savedAt: null
  };
}

async function compressImageFile(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = imageUrl;
    });

    const maxWidth = 1400;
    const scale = Math.min(maxWidth / image.width, 1);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    if (!context) {
      throw new Error("无法处理图片");
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function ProgressBar({
  label,
  consumed,
  target,
  unit,
  color
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
}) {
  const percent = target > 0 ? clampPercent((consumed / target) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="whitespace-nowrap text-muted-foreground">
          {formatAmount(consumed)} / {formatAmount(target)} {unit}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MacroPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full bg-[#fff6f0] px-3 py-2 text-xs text-[#6a4b40]">
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MoodBadge({ mood }: { mood: MealMood | null }) {
  const meta = getMoodMeta(mood);

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
      style={{
        color: meta.color,
        backgroundColor: meta.background,
        borderColor: `${meta.color}22`
      }}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
      <span>{meta.score > 0 ? `${meta.score}分` : ""}</span>
    </span>
  );
}

function MoodSelector({
  value,
  onChange
}: {
  value: MealMood | null;
  onChange: (mood: MealMood) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {moodOptions.map((option) => {
        const isActive = value === option.key;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`rounded-[20px] border px-4 py-3 text-left transition-all ${
              isActive ? "scale-[1.01] shadow-soft" : "bg-white/80 hover:bg-white"
            }`}
            style={{
              backgroundColor: isActive ? option.background : undefined,
              borderColor: isActive ? option.color : "rgba(255,255,255,0.7)"
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl">{option.icon}</span>
              <span className="text-sm font-medium" style={{ color: option.color }}>
                {option.score}分
              </span>
            </div>
            <p className="mt-2 text-base font-semibold text-foreground">{option.label}</p>
          </button>
        );
      })}
    </div>
  );
}

function MealCard({
  mealType,
  meal,
  onOpen
}: {
  mealType: MealType;
  meal: MealRecord | null;
  onOpen: () => void;
}) {
  const meta = getMealMeta(mealType);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-[28px] border border-white/60 bg-white/80 p-5 text-left transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{meta.time}</p>
          <h3 className="mt-2 text-2xl font-semibold text-foreground">{meta.label}</h3>
        </div>
        {meal ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eef6e7] px-3 py-1 text-xs font-medium text-[#567240]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已记录
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1e9] px-3 py-1 text-xs font-medium text-[#b45b3e]">
            <ImagePlus className="h-3.5 w-3.5" />
            去填写
          </span>
        )}
      </div>

      {meal?.imageDataUrl ? (
        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/70 bg-[#f7ede6]">
          <img src={meal.imageDataUrl} alt={meal.title || meta.label} className="h-36 w-full object-cover" />
        </div>
      ) : (
        <div className="mt-4 flex h-36 items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-[#f8eee7] text-sm text-muted-foreground">
          <div className="text-center">
            <Camera className="mx-auto h-6 w-6" />
            <p className="mt-3">{meta.prompt}</p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="text-base font-medium text-foreground">{meal?.title || "还没有记录餐食名称"}</p>
        <p className="mt-2 text-sm text-muted-foreground">{buildMealHighlight(meal)}</p>
      </div>

      {meal ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-[20px] bg-[#fff6f0] px-4 py-3">
            <span className="text-sm text-muted-foreground">本餐热量</span>
            <span className="text-lg font-semibold text-foreground">{formatAmount(meal.calories ?? 0)} kcal</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <MacroPill label="蛋白质" value={`${formatAmount(meal.protein ?? 0)}g`} />
            <MacroPill label="碳水" value={`${formatAmount(meal.carbs ?? 0)}g`} />
            <MacroPill label="脂肪" value={`${formatAmount(meal.fat ?? 0)}g`} />
            <MacroPill label="纤维" value={`${formatAmount(meal.fiber ?? 0)}g`} />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[20px] bg-[#fff6f0] px-4 py-3 text-sm text-muted-foreground">
          点击卡片后会弹出填写窗口，在同一个弹窗里完成营养、备注和预览。
        </div>
      )}
    </button>
  );
}

function getEmptyRequiredFields(draft: MealDraft): Array<keyof Omit<MealDraft, 'note' | 'imageDataUrl'>> {
  const emptyFields: Array<keyof Omit<MealDraft, 'note' | 'imageDataUrl'>> = [];
  if (!draft.title.trim()) emptyFields.push('title');
  if (draft.calories === null || draft.calories === undefined || draft.calories === 0) emptyFields.push('calories');
  if (draft.protein === null || draft.protein === undefined) emptyFields.push('protein');
  if (draft.carbs === null || draft.carbs === undefined) emptyFields.push('carbs');
  if (draft.fat === null || draft.fat === undefined) emptyFields.push('fat');
  return emptyFields;
}

function MealEditorModal({
  mealType,
  draft,
  isUploading,
  contribution,
  onClose,
  onImageChange,
  onDraftChange,
  onSave,
  onClear
}: {
  mealType: MealType;
  draft: MealDraft;
  isUploading: boolean;
  contribution: Array<{
    label: string;
    consumed: number;
    target: number;
    unit: string;
  }>;
  onClose: () => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDraftChange: (patch: Partial<MealDraft>) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const meta = getMealMeta(mealType);
  const previewMeal = buildPreviewMeal(mealType, draft);
  const previewRemark = draft.note.trim() || "这里会实时预览你输入的备注。";
  const emptyFields = getEmptyRequiredFields(draft);
  const hasEmptyFields = emptyFields.length > 0;
  const isFieldEmpty = (field: keyof Omit<MealDraft, 'note' | 'imageDataUrl'>) => emptyFields.includes(field);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f211c]/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/70 bg-[#fffaf7] shadow-soft">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{meta.time}</p>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">{meta.label}营养记录</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border/70 bg-white/80 p-2 text-muted-foreground transition hover:bg-white hover:text-foreground"
            aria-label="关闭弹窗"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-92px)] overflow-y-auto px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[24px] border border-white/70 bg-[#fff1e8]">
                {draft.imageDataUrl ? (
                  <img src={draft.imageDataUrl} alt="本餐预览" className="h-72 w-full object-cover" />
                ) : (
                  <div className="flex h-72 items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <ImagePlus className="mx-auto h-8 w-8" />
                      <p className="mt-4 text-sm">上传图片后会显示在这里</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`modal-image-${mealType}`}>上传餐食图片</Label>
                <Input
                  id={`modal-image-${mealType}`}
                  type="file"
                  accept="image/*"
                  onChange={onImageChange}
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  {isUploading ? "正在压缩图片..." : "图片仅用于参考，营养值由你手动记录。"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`modal-title-${mealType}`} className={isFieldEmpty('title') ? 'text-red-500 font-semibold' : ''}>
                  餐食名称
                  {isFieldEmpty('title') && <span className="ml-1 text-red-500">*必填</span>}
                </Label>
                <Input
                  id={`modal-title-${mealType}`}
                  value={draft.title}
                  onChange={(event) => onDraftChange({ title: event.target.value })}
                  placeholder="例如：鸡胸肉沙拉配玉米"
                  className={isFieldEmpty('title') ? 'border-red-500 border-2' : ''}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`modal-calories-${mealType}`} className={isFieldEmpty('calories') ? 'text-red-500 font-semibold' : ''}>
                    热量 (kcal)
                    {isFieldEmpty('calories') && <span className="ml-1 text-red-500">*必填</span>}
                  </Label>
                  <Input
                    id={`modal-calories-${mealType}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={toInputValue(draft.calories)}
                    onChange={(event) => onDraftChange({ calories: parseNumber(event.target.value) })}
                    placeholder="420"
                    className={isFieldEmpty('calories') ? 'border-red-500 border-2' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`modal-protein-${mealType}`} className={isFieldEmpty('protein') ? 'text-red-500 font-semibold' : ''}>
                    蛋白质 (g)
                    {isFieldEmpty('protein') && <span className="ml-1 text-red-500">*必填</span>}
                  </Label>
                  <Input
                    id={`modal-protein-${mealType}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={toInputValue(draft.protein)}
                    onChange={(event) => onDraftChange({ protein: parseNumber(event.target.value) })}
                    placeholder="28"
                    className={isFieldEmpty('protein') ? 'border-red-500 border-2' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`modal-carbs-${mealType}`} className={isFieldEmpty('carbs') ? 'text-red-500 font-semibold' : ''}>
                    碳水 (g)
                    {isFieldEmpty('carbs') && <span className="ml-1 text-red-500">*必填</span>}
                  </Label>
                  <Input
                    id={`modal-carbs-${mealType}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={toInputValue(draft.carbs)}
                    onChange={(event) => onDraftChange({ carbs: parseNumber(event.target.value) })}
                    placeholder="42"
                    className={isFieldEmpty('carbs') ? 'border-red-500 border-2' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`modal-fat-${mealType}`} className={isFieldEmpty('fat') ? 'text-red-500 font-semibold' : ''}>
                    脂肪 (g)
                    {isFieldEmpty('fat') && <span className="ml-1 text-red-500">*必填</span>}
                  </Label>
                  <Input
                    id={`modal-fat-${mealType}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={toInputValue(draft.fat)}
                    onChange={(event) => onDraftChange({ fat: parseNumber(event.target.value) })}
                    placeholder="14"
                    className={isFieldEmpty('fat') ? 'border-red-500 border-2' : ''}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`modal-fiber-${mealType}`}>纤维 (g)</Label>
                  <Input
                    id={`modal-fiber-${mealType}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={toInputValue(draft.fiber)}
                    onChange={(event) => onDraftChange({ fiber: parseNumber(event.target.value) })}
                    placeholder="6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`modal-note-${mealType}`}>这餐备注</Label>
                <textarea
                  id={`modal-note-${mealType}`}
                  value={draft.note}
                  onChange={(event) => onDraftChange({ note: event.target.value })}
                  placeholder="例如：蔬菜量不错，吃完很有饱腹感。"
                  className="min-h-[120px] w-full rounded-[20px] border border-input bg-white px-4 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-white/70 bg-white/80 p-5">
                <p className="text-sm text-muted-foreground">本餐摘要</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{previewMeal.title || "还没有填写餐食名称"}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {buildMealHighlight(
                    previewMeal.calories ||
                      previewMeal.protein ||
                      previewMeal.carbs ||
                      previewMeal.fat ||
                      previewMeal.fiber
                      ? previewMeal
                      : null
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <MacroPill label="热量" value={`${formatAmount(previewMeal.calories ?? 0)} kcal`} />
                  <MacroPill label="蛋白质" value={`${formatAmount(previewMeal.protein ?? 0)}g`} />
                  <MacroPill label="碳水" value={`${formatAmount(previewMeal.carbs ?? 0)}g`} />
                  <MacroPill label="脂肪" value={`${formatAmount(previewMeal.fat ?? 0)}g`} />
                  <MacroPill label="纤维" value={`${formatAmount(previewMeal.fiber ?? 0)}g`} />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/80 p-5">
                <p className="text-sm font-medium text-foreground">本餐对比视图</p>
                <div className="mt-4 space-y-4">
                  {contribution.map((item) => (
                    <ProgressBar
                      key={item.label}
                      label={item.label}
                      consumed={item.consumed}
                      target={item.target}
                      unit={item.unit}
                      color={item.label === "热量" ? "#D86A4A" : "#9D6B58"}
                    />
                  ))}
                </div>
                <div className="mt-5 rounded-[20px] bg-[#2f211c] p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#e8cabb]">备注预览</p>
                  <p className="mt-3 text-sm leading-7 text-[#fff6f0]">{previewRemark}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onClear}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  清空本餐
                </Button>
                <Button type="button" variant="secondary" onClick={onClose}>
                  取消
                </Button>
                {hasEmptyFields && (
                  <div className="w-full rounded-[12px] bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    ⚠️ 请填写所有必填字段（标红项）
                  </div>
                )}
                <Button type="button" onClick={onSave} disabled={isUploading || hasEmptyFields}>
                  {hasEmptyFields ? '请填写必填项' : '保存本餐'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MealRecordDashboard() {
  const {
    profile,
    appliedProfile,
    isHydrated: isProfileHydrated,
    loadFromStorage: loadProfileFromStorage
  } = useProfileStore();
  const {
    dateKey,
    logs,
    isHydrated: isLogHydrated,
    loadFromStorage: loadLogsFromStorage,
    syncToday,
    setActiveDate,
    saveDailyMood,
    saveMeal,
    removeMeal
  } = useDailyIntakeStore();

  const [editingMeal, setEditingMeal] = useState<MealType | null>(null);
  const [draft, setDraft] = useState<MealDraft>(buildDraftFromMeal(null, "breakfast"));
  const [isUploading, setIsUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("记录会自动按日期保存到本地，你可以切换不同日期补录多天数据。");

  useEffect(() => {
    loadProfileFromStorage();
    loadLogsFromStorage();
  }, [loadLogsFromStorage, loadProfileFromStorage]);

  useEffect(() => {
    syncToday();
    const timer = window.setInterval(syncToday, 60_000);
    return () => window.clearInterval(timer);
  }, [syncToday]);

  useEffect(() => {
    if (!editingMeal) {
      return;
    }

    const meal = logs[dateKey]?.meals[editingMeal] ?? null;
    setDraft(buildDraftFromMeal(meal, editingMeal));
  }, [dateKey, editingMeal, logs]);

  useEffect(() => {
    if (!editingMeal) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingMeal(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editingMeal]);

  const activeLog = useMemo(() => logs[dateKey] ?? createEmptyDailyLog(dateKey), [dateKey, logs]);
  const totals = useMemo(() => calculateDailyTotals(activeLog), [activeLog]);
  const plan = useMemo(() => calculateNutritionPlan(appliedProfile ?? profile), [appliedProfile, profile]);
  const macroProgress = useMemo(() => buildMacroProgress(plan, activeLog), [plan, activeLog]);
  const dailyAdvice = useMemo(() => buildDailyAdvice(plan, activeLog), [plan, activeLog]);
  const selectedDateLabel = useMemo(() => formatDateLabel(dateKey), [dateKey]);
  const isToday = dateKey === getLocalDateKey();
  const currentMood = activeLog.dailyMood;
  const currentMoodMeta = getMoodMeta(currentMood);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploading(true);
      const imageDataUrl = await compressImageFile(file);
      setDraft((current) => ({
        ...current,
        imageDataUrl
      }));
      setSaveMessage("图片已上传，你可以继续填写这一餐的营养值。");
    } catch (error) {
      console.error(error);
      setSaveMessage("图片处理失败了，请换一张再试。");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function handleSaveMeal() {
    if (!editingMeal) {
      return;
    }

    saveMeal(editingMeal, {
      ...draft,
      title: draft.title.trim(),
      note: draft.note.trim()
    });

    setSaveMessage(`${selectedDateLabel}的${getMealMeta(editingMeal).label}已保存。`);
    setEditingMeal(null);
  }

  function handleClearMeal() {
    if (!editingMeal) {
      return;
    }

    removeMeal(editingMeal);
    setSaveMessage(`${selectedDateLabel}的${getMealMeta(editingMeal).label}已清空。`);
    setEditingMeal(null);
  }

  function handleChangeDailyMood(mood: MealMood) {
    saveDailyMood(mood);
    setSaveMessage(`${selectedDateLabel}的每日心情已更新为${getMoodMeta(mood).label}。`);
  }

  if (!isProfileHydrated || !isLogHydrated) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-center text-muted-foreground">正在加载饮食记录...</div>;
  }

  const contribution = editingMeal ? buildMealContribution(buildPreviewMeal(editingMeal, draft), plan) : [];
  const moodPercent = clampPercent((totals.moodScore / MOOD_MAX_SCORE_PER_DAY) * 100);

  return (
    <main className="min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardNav />

        <section className="overflow-hidden rounded-[36px] border border-white/60 bg-hero-glow p-8 shadow-soft">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="relative overflow-hidden rounded-[30px] border border-white/60 bg-white/50 px-8 py-8 backdrop-blur-sm">
              <div className="absolute -left-8 top-5 h-24 w-24 rounded-full bg-[#f6cdb4]/35 blur-2xl" />
              <div className="absolute right-2 top-2 h-28 w-28 rounded-full bg-white/50 blur-3xl" />
              <p className="relative text-xs uppercase tracking-[0.32em] text-muted-foreground">Daily Record</p>
              <h1 className="relative mt-4 text-[clamp(2rem,4.6vw,3.8rem)] font-semibold tracking-[0.06em] text-[#3a2721]">
                每日饮食记录
              </h1>
              <p className="relative mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                点击任意一餐会弹出独立填写框，在同一个窗口里完成营养、备注和预览。每日心情改为在总览区域统一选择，记录会按日期自动保存。
              </p>
              <div className="relative mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2">
                  <CalendarDays className="h-4 w-4" />
                  {isToday ? `今天：${dateKey}` : `当前日期：${dateKey}`}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2">
                  <Target className="h-4 w-4" />
                  目标：{plan.isComplete ? formatGoalLabel((appliedProfile ?? profile).goal) : "待完善档案"}
                </span>
              </div>
            </div>

            <Card className="bg-white/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  使用提示
                </CardTitle>
                <CardDescription>{saveMessage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="record-date">选择记录日期</Label>
                  <Input
                    id="record-date"
                    type="date"
                    value={dateKey}
                    onChange={(event) => {
                      setActiveDate(event.target.value);
                      setSaveMessage(`已切换到 ${event.target.value}，你可以继续记录这一天的四餐和心情。`);
                    }}
                  />
                </div>
                <div className="rounded-[24px] bg-[#fff6f0] p-5">
                  <p className="text-sm text-muted-foreground">当前日期建议</p>
                  <p className="mt-3 text-base leading-7 text-foreground">{dailyAdvice}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/70 bg-white/80 p-4">
                    <p className="text-sm text-muted-foreground">已记录餐次</p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {totals.completedMeals}
                      <span className="ml-2 text-base font-medium text-muted-foreground">/ 4</span>
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/70 bg-white/80 p-4">
                    <p className="text-sm text-muted-foreground">今日心情</p>
                    <div className="mt-3">
                      <MoodBadge mood={currentMood} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {!plan.isComplete ? (
          <Card className="border-[#f1d2c1] bg-[#fff8f4]">
            <CardContent className="flex items-start gap-3">
              <NotebookPen className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-7 text-foreground">
                你的档案页还没有完成计算，所以这里暂时无法给出准确的每日目标。先去“用户档案”页填写完整信息并点击“确认并计算”，饮食记录页会自动同步目标值。
              </p>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-primary" />
                {selectedDateLabel}总览
              </CardTitle>
              <CardDescription>当天已摄入热量、每日心情和营养目标会随着你保存内容实时变化。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="flex items-center justify-center">
                  <div
                    className="relative flex h-64 w-64 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#d86a4a 0 ${clampPercent((totals.calories / Math.max(plan.dailyCalories, 1)) * 100)}%, rgba(255,255,255,0.72) ${clampPercent((totals.calories / Math.max(plan.dailyCalories, 1)) * 100)}% 100%)`
                    }}
                  >
                    <div className="flex h-[74%] w-[74%] flex-col items-center justify-center rounded-full bg-[#fff7f2] text-center shadow-inner">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Today</p>
                      <p className="mt-3 text-4xl font-semibold text-foreground">
                        {Math.round(Math.max(plan.dailyCalories - totals.calories, 0))}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">剩余可摄入 kcal</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[24px] border border-white/70 bg-white/80 p-5">
                    <p className="text-sm text-muted-foreground">今日已摄入</p>
                    <div className="mt-3 flex items-end gap-2 whitespace-nowrap">
                      <span className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-foreground">
                        {formatAmount(totals.calories)}
                      </span>
                      <span className="pb-1 text-lg font-medium text-foreground">kcal</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">每日目标 {formatAmount(plan.dailyCalories)} kcal</p>
                  </div>

                  <div className="rounded-[24px] border border-white/70 bg-white/80 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">每日心情分</p>
                      <p className="text-base font-semibold text-foreground">{totals.moodScore} / 100</p>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f3ebe6]">
                      <div className="h-full rounded-full bg-[#9d6b58] transition-all" style={{ width: `${moodPercent}%` }} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {totals.moodEntries > 0 ? `${currentMoodMeta.label}，今天记录已保存` : "请在下面选择今天的心情"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-[26px] border border-white/70 bg-white/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">每日心情选择</p>
                    <p className="mt-1 text-base font-semibold text-foreground">在总览页统一记录今天的情绪状态</p>
                  </div>
                  <MoodBadge mood={currentMood} />
                </div>
                <MoodSelector value={currentMood} onChange={handleChangeDailyMood} />
              </div>

              <div className="grid gap-4">
                {macroProgress.map((item) => (
                  <ProgressBar
                    key={item.key}
                    label={item.label}
                    consumed={item.consumed}
                    target={item.target}
                    unit={item.unit}
                    color={item.color}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                四餐卡片
              </CardTitle>
              <CardDescription>卡片只负责记录餐食营养和备注，不再单独询问心情。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {mealTypes.map((mealType) => (
                <MealCard
                  key={mealType}
                  mealType={mealType}
                  meal={activeLog.meals[mealType]}
                  onOpen={() => setEditingMeal(mealType)}
                />
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      {editingMeal ? (
        <MealEditorModal
          mealType={editingMeal}
          draft={draft}
          isUploading={isUploading}
          contribution={contribution}
          onClose={() => setEditingMeal(null)}
          onImageChange={handleImageChange}
          onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onSave={handleSaveMeal}
          onClear={handleClearMeal}
        />
      ) : null}
    </main>
  );
}
