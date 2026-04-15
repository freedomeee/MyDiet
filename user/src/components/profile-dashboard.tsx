"use client";

import { useEffect, useState } from "react";
import { Activity, Flame, Sparkles, Target, UserRound } from "lucide-react";

import {
  calculateGoalPace,
  calculateNutritionPlan,
  formatActivityLabel,
  formatGoalLabel,
  type GoalType,
  type Sex,
  type UserProfile
} from "@/lib/profile";
import { useProfileStore } from "@/store/profile-store";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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

function buildGoalNote(profile: UserProfile) {
  if (!profile.weightKg || !profile.targetWeightKg || !profile.targetDays) {
    return "填写当前体重、目标体重和预计达成天数后，这里会提示目标节奏。";
  }

  const pacePlan = calculateGoalPace(profile);

  if (!pacePlan) {
    return "填写当前体重、目标体重和预计达成天数后，这里会提示目标节奏。";
  }

  if (pacePlan.direction === "maintain") {
    return "当前体重已经等于目标体重，每日预算将按维持热量计算。";
  }

  const modeLabel = pacePlan.direction === "deficit" ? "热量缺口" : "热量盈余";

  if (pacePlan.wasAdjusted) {
    return `按当前设定，需要累计 ${pacePlan.totalKcalChange.toLocaleString("zh-CN", {
      maximumFractionDigits: 1
    })} kcal ${modeLabel}，原计划每日 ${pacePlan.requiredDailyGap.toLocaleString("zh-CN", {
      maximumFractionDigits: 1
    })} kcal。已为您优化为更健康的达成速度，当前按每日 ${pacePlan.appliedDailyGap.toLocaleString("zh-CN", {
      maximumFractionDigits: 1
    })} kcal 计算，预计约 ${pacePlan.estimatedDaysAtSafePace} 天更稳妥。`;
  }

  return `按当前设定，需要累计 ${pacePlan.totalKcalChange.toLocaleString("zh-CN", {
    maximumFractionDigits: 1
  })} kcal ${modeLabel}，折合每日 ${pacePlan.requiredDailyGap.toLocaleString("zh-CN", {
    maximumFractionDigits: 1
  })} kcal。`;
}

function buildDailyBudgetDescription(profile: UserProfile) {
  const pacePlan = calculateGoalPace(profile);

  if (!pacePlan || pacePlan.direction === "maintain") {
    return `${formatGoalLabel(profile.goal)}目标自动换算`;
  }

  if (pacePlan.wasAdjusted) {
    return `已按安全范围调整为 ${pacePlan.appliedDailyGap.toLocaleString("zh-CN", {
      maximumFractionDigits: 1
    })} kcal/天`;
  }

  return `按目标体重与天数换算 ${pacePlan.appliedDailyGap.toLocaleString("zh-CN", {
    maximumFractionDigits: 1
  })} kcal/天`;
}

function Field({
  label,
  hint,
  children,
  isEmpty
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className={isEmpty ? 'text-red-500 font-semibold' : ''}>
        {label}
        {isEmpty && <span className="ml-1 text-red-500">*必填</span>}
      </Label>
      <div className={isEmpty ? '[&>input]:border-red-500 [&>input]:border-2 [&>select]:border-red-500 [&>select]:border-2' : ''}>
        {children}
      </div>
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  unit,
  description,
  icon: Icon
}: {
  title: string;
  value: string;
  unit: string;
  description: string;
  icon: typeof Flame;
}) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 shrink-0 text-primary" />
      </div>
      <div className="mt-4 flex items-end gap-2 whitespace-nowrap">
        <span className="text-[clamp(2rem,3vw,3.25rem)] font-semibold leading-none text-foreground">{value}</span>
        <span className="pb-1 text-lg font-medium text-foreground">{unit}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function MacroCard({ label, grams, kcal, color }: { label: string; grams: number; kcal: number; color: string }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-foreground">
        {grams.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} g
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {kcal > 0
          ? `${kcal.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} kcal`
          : "固定摄入目标，不计入热量预算"}
      </p>
    </div>
  );
}

function MacroDonutChart({
  items
}: {
  items: Array<{
    label: string;
    kcal: number;
    color: string;
  }>;
}) {
  const total = items.reduce((sum, item) => sum + item.kcal, 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-border/80 bg-white/55 text-sm text-muted-foreground">
        确认并计算后显示热量分布
      </div>
    );
  }

  let current = 0;
  const gradient = items
    .map((item) => {
      const start = current;
      const end = current + (item.kcal / total) * 100;
      current = end;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative h-44 w-44 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-[22%] flex items-center justify-center rounded-full bg-[#FFF6F0] text-center shadow-inner">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{Math.round(total)}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-full bg-white/70 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </div>
            <span className="text-muted-foreground">{Math.round(item.kcal)} kcal</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroBarChart({
  items
}: {
  items: Array<{
    label: string;
    grams: number;
    color: string;
  }>;
}) {
  const maxValue = Math.max(...items.map((item) => item.grams), 1);

  return (
    <div className="flex h-full items-end gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex h-full flex-1 flex-col justify-end">
          <div className="mb-3 text-center text-xs text-muted-foreground">
            {item.grams.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} g
          </div>
          <div className="flex h-full items-end justify-center rounded-[20px] bg-white/60 p-3">
            <div
              className="w-full rounded-[16px]"
              style={{
                height: `${Math.max((item.grams / maxValue) * 100, 6)}%`,
                backgroundColor: item.color
              }}
            />
          </div>
          <div className="mt-3 text-center text-sm font-medium text-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function updateNumericField<K extends keyof UserProfile>(
  field: K,
  value: string,
  updateField: (field: K, value: UserProfile[K]) => void
) {
  updateField(field, parseNumber(value) as UserProfile[K]);
}

export function ProfileDashboard() {
  const { profile, appliedProfile, isHydrated, applyMessage, loadFromStorage, updateField, applyProfile } =
    useProfileStore();
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const currentProfile = appliedProfile ?? profile;
  const plan = calculateNutritionPlan(currentProfile);

  function getEmptyRequiredFields() {
    const emptyFields: string[] = [];
    if (!profile.username?.trim()) emptyFields.push('username');
    if (profile.age === null || profile.age === undefined) emptyFields.push('age');
    if (!profile.sex) emptyFields.push('sex');
    if (profile.heightCm === null || profile.heightCm === undefined) emptyFields.push('heightCm');
    if (profile.weightKg === null || profile.weightKg === undefined) emptyFields.push('weightKg');
    if (profile.targetWeightKg === null || profile.targetWeightKg === undefined) emptyFields.push('targetWeightKg');
    if (profile.targetDays === null || profile.targetDays === undefined) emptyFields.push('targetDays');
    if (!profile.goal) emptyFields.push('goal');
    if (!profile.activityLevel) emptyFields.push('activityLevel');
    return emptyFields;
  }

  function handleApplyProfile() {
    const emptyFields = getEmptyRequiredFields();
    setHasAttemptedSubmit(true);
    
    if (emptyFields.length === 0) {
      applyProfile();
    }
  }

  const emptyFields = getEmptyRequiredFields();
  const isFieldEmpty = (field: string) => hasAttemptedSubmit && emptyFields.includes(field);

  if (!isHydrated) {
    return <div className="mx-auto max-w-6xl px-6 py-20 text-center text-muted-foreground">正在加载你的档案空间...</div>;
  }

  return (
    <main className="min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardNav />

        <section className="overflow-hidden rounded-[36px] border border-white/60 bg-hero-glow p-8 shadow-soft">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="relative overflow-hidden rounded-[30px] border border-white/60 bg-white/45 px-8 py-10 backdrop-blur-sm">
              <div className="absolute -left-10 top-6 h-24 w-24 rounded-full bg-[#f6cdb4]/35 blur-2xl" />
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/55 blur-3xl" />
              <h1 className="relative text-center font-sans text-[clamp(2rem,4.4vw,3.7rem)] font-semibold tracking-[0.12em] text-[#3a2721]">
                你的健康管理助手
              </h1>
            </div>

            <Card className="bg-white/80">
              <CardHeader>
                <CardTitle className="text-lg">当前档案摘要</CardTitle>
                <CardDescription>{plan.completionMessage}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">用户名</p>
                  <p className="mt-1 text-lg font-semibold">{currentProfile.username || "未填写"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">目标方向</p>
                  <p className="mt-1 text-lg font-semibold">{formatGoalLabel(currentProfile.goal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">活动强度</p>
                  <p className="mt-1 text-lg font-semibold">{formatActivityLabel(currentProfile.activityLevel)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">当前体重</p>
                  <p className="mt-1 text-lg font-semibold">
                    {currentProfile.weightKg ? `${currentProfile.weightKg} kg` : "未填写"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">目标节奏提示</p>
                  <p className="mt-1 text-sm leading-6 text-foreground">{buildGoalNote(currentProfile)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  用户基础资料
                </CardTitle>
                <CardDescription>资料会自动保存，点击按钮后刷新右侧结果。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="用户名" isEmpty={isFieldEmpty('username')}>
                  <Input value={profile.username} onChange={(event) => updateField("username", event.target.value)} placeholder="例如：小周" />
                </Field>

                <Field label="年龄" isEmpty={isFieldEmpty('age')}>
                  <Input
                    type="number"
                    min="0"
                    value={toInputValue(profile.age)}
                    onChange={(event) => updateNumericField("age", event.target.value, updateField)}
                    placeholder="25"
                  />
                </Field>

                <Field label="性别" isEmpty={isFieldEmpty('sex')}>
                  <Select value={profile.sex} onChange={(event) => updateField("sex", event.target.value as Sex)}>
                    <option value="female">女性</option>
                    <option value="male">男性</option>
                  </Select>
                </Field>

                <Field label="活动强度" hint="用于计算 TDEE：久坐 1.2 / 轻度运动 1.375 / 经常运动 1.55" isEmpty={isFieldEmpty('activityLevel')}>
                  <Select
                    value={profile.activityLevel}
                    onChange={(event) => updateField("activityLevel", event.target.value as UserProfile["activityLevel"])}
                  >
                    <option value="sedentary">一周无运动（久坐）</option>
                    <option value="light">一周 1-3 次（轻度运动）</option>
                    <option value="active">一周 4-7 次（经常运动）</option>
                  </Select>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  身体信息
                </CardTitle>
                <CardDescription>采用 Mifflin-St Jeor 公式所需的基础参数。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="身高 (cm)" isEmpty={isFieldEmpty('heightCm')}>
                  <Input
                    type="number"
                    min="0"
                    value={toInputValue(profile.heightCm)}
                    onChange={(event) => updateNumericField("heightCm", event.target.value, updateField)}
                    placeholder="165"
                  />
                </Field>

                <Field label="体重 (kg)" isEmpty={isFieldEmpty('weightKg')}>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={toInputValue(profile.weightKg)}
                    onChange={(event) => updateNumericField("weightKg", event.target.value, updateField)}
                    placeholder="58"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  目标设定
                </CardTitle>
                <CardDescription>
                  每日预算会结合目标体重和预计达成天数计算；减重按 TDEE 的 25% 封顶，增重按 TDEE 的 15% 封顶。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="目标方向" isEmpty={isFieldEmpty('goal')}>
                  <Select value={profile.goal} onChange={(event) => updateField("goal", event.target.value as GoalType)}>
                    <option value="fat_loss">减脂</option>
                    <option value="muscle_gain">增肌</option>
                  </Select>
                </Field>

                <Field label="预计达成天数" isEmpty={isFieldEmpty('targetDays')}>
                  <Input
                    type="number"
                    min="1"
                    value={toInputValue(profile.targetDays)}
                    onChange={(event) => updateNumericField("targetDays", event.target.value, updateField)}
                    placeholder="90"
                  />
                </Field>

                <Field label="目标体重 (kg)" isEmpty={isFieldEmpty('targetWeightKg')}>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={toInputValue(profile.targetWeightKg)}
                    onChange={(event) => updateNumericField("targetWeightKg", event.target.value, updateField)}
                    placeholder="54"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card className="bg-[#2f211c] text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="h-5 w-5 text-[#f3c4a9]" />
                  确认并计算
                </CardTitle>
                <CardDescription className="text-[#e7c9bb]">{applyMessage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasAttemptedSubmit && emptyFields.length > 0 && (
                  <div className="rounded-[12px] bg-red-50/20 border border-red-300/50 p-3 text-sm text-red-200">
                    ⚠️ 请填写所有必填字段（标红项）
                  </div>
                )}
                <div className="flex items-center justify-end">
                  <Button type="button" size="lg" onClick={handleApplyProfile}>
                    确认并计算
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>每日预算总览</CardTitle>
                <CardDescription>点击确认后，这里的热量结果会按当前资料刷新。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-3">
                <StatCard
                  title="基础代谢 BMR"
                  value={plan.bmr.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}
                  unit="kcal"
                  description="Mifflin-St Jeor 公式"
                  icon={Flame}
                />
                <StatCard
                  title="全天总消耗 TDEE"
                  value={plan.tdee.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}
                  unit="kcal"
                  description={`活动系数：${formatActivityLabel(currentProfile.activityLevel)}`}
                  icon={Activity}
                />
                <StatCard
                  title="每日摄入预算"
                  value={plan.dailyCalories.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}
                  unit="kcal"
                  description={buildDailyBudgetDescription(currentProfile)}
                  icon={Target}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>饮食结构</CardTitle>
                <CardDescription>
                  {currentProfile.goal === "fat_loss"
                    ? "减脂比例：蛋白质 / 碳水 / 脂肪 = 3 : 4 : 3，纤维按固定目标补充"
                    : "增肌比例：蛋白质 / 碳水 / 脂肪 = 2.5 : 5.5 : 2，纤维按固定目标补充"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {plan.macros.map((macro) => (
                    <MacroCard key={macro.key} label={macro.label} grams={macro.grams} kcal={macro.kcal} color={macro.color} />
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="h-72 rounded-[24px] border border-white/70 bg-white/75 p-4">
                    <p className="mb-4 text-sm font-medium text-foreground">热量分布</p>
                    <MacroDonutChart items={plan.macros.filter((item) => item.kcal > 0)} />
                  </div>

                  <div className="h-72 rounded-[24px] border border-white/70 bg-white/75 p-4">
                    <p className="mb-4 text-sm font-medium text-foreground">克数目标</p>
                    <MacroBarChart items={plan.macros.map(({ label, grams, color }) => ({ label, grams, color }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
