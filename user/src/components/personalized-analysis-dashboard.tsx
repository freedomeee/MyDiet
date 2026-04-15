"use client";

import { useEffect, useMemo } from "react";
import { CalendarDays, Flame, HeartPulse, Sparkles, Target } from "lucide-react";

import {
  MOOD_MAX_SCORE_PER_DAY,
  calculateDailyTotals,
  formatDateLabel,
  type DailyLog
} from "@/lib/daily-log";
import { calculateNutritionPlan, formatGoalLabel } from "@/lib/profile";
import { useDailyIntakeStore } from "@/store/daily-intake-store";
import { useProfileStore } from "@/store/profile-store";
import { DashboardNav } from "@/components/dashboard-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendPoint {
  date: string;
  shortDate: string;
  calories: number;
  moodScore: number;
}

interface RecommendationCard {
  title: string;
  emoji: string;
  description: string;
  calories: string;
  accent: string;
  background: string;
}

function formatAmount(value: number) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}

function buildTrendPoints(logs: Record<string, DailyLog>) {
  return Object.values(logs)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((log) => {
      const totals = calculateDailyTotals(log);

      return {
        date: log.date,
        shortDate: log.date.slice(5).replace("-", "/"),
        calories: totals.calories,
        moodScore: totals.moodScore,
        completedMeals: totals.completedMeals,
        hasMood: totals.moodEntries > 0
      };
    })
    .filter((item) => item.completedMeals > 0 || item.hasMood)
    .slice(-14);
}

function buildAnalysisMessage(points: TrendPoint[], planDailyCalories: number) {
  if (points.length === 0) {
    return "先在饮食记录页切换不同日期，录入多天的四餐和每日心情，这里就会生成摄入与心情的对比曲线。";
  }

  const averageCalories = points.reduce((sum, point) => sum + point.calories, 0) / points.length;
  const averageMood = points.reduce((sum, point) => sum + point.moodScore, 0) / points.length;
  const lowMoodHighCalorieDays = points.filter(
    (point) => point.moodScore > 0 && point.moodScore <= 45 && point.calories > planDailyCalories * 1.08
  ).length;
  const lowMoodLowCalorieDays = points.filter(
    (point) => point.moodScore > 0 && point.moodScore <= 45 && point.calories < planDailyCalories * 0.78
  ).length;

  if (lowMoodHighCalorieDays >= 2) {
    return "你在心情偏低的日子里，更容易吃到超过预算。建议提前准备低负担的安慰型食物，比如热汤、酸奶杯和高纤主食，既有满足感也更稳。";
  }

  if (lowMoodLowCalorieDays >= 2) {
    return "你在心情偏低时也会出现吃得过少的情况，后续可以优先安排温热、容易入口的小份餐，帮助把能量慢慢补回来。";
  }

  if (averageMood >= 85 && Math.abs(averageCalories - planDailyCalories) <= planDailyCalories * 0.1) {
    return "最近这段时间你的心情和摄入都比较稳定，说明你已经找到适合自己的节奏，可以继续沿用现在的备餐方式。";
  }

  if (averageCalories > planDailyCalories * 1.1) {
    return "最近整体摄入略高于预算，建议把高热量零食换成蛋白质更足、纤维更高的替代品，这样更容易兼顾心情和计划。";
  }

  return "你的心情和饮食有一定波动，但已经能看出规律了。继续坚持多天记录，我们会更容易帮你找到最适合自己的饮食安抚方式。";
}

function buildRecommendations(points: TrendPoint[], goalLabel: string): RecommendationCard[] {
  const averageMood =
    points.length > 0 ? points.reduce((sum, point) => sum + point.moodScore, 0) / points.length : 0;

  if (goalLabel === "增肌") {
    if (averageMood > 0 && averageMood <= 45) {
      return [
        {
          title: "三文鱼土豆能量碗",
          emoji: "🍣",
          description: "温热好入口，蛋白质和优质脂肪都更充足，适合心情低落时补充能量。",
          calories: "约 520 kcal",
          accent: "#5E728D",
          background: "#EAF0F7"
        },
        {
          title: "香蕉花生酱酸奶杯",
          emoji: "🥣",
          description: "口感柔和，能量密度适中，适合作为加餐稳住状态。",
          calories: "约 360 kcal",
          accent: "#8E6B3E",
          background: "#FBF1DE"
        },
        {
          title: "牛肉藜麦饭",
          emoji: "🍱",
          description: "主食和蛋白质都有，适合在需要恢复精力时当作正餐。",
          calories: "约 580 kcal",
          accent: "#8C5F67",
          background: "#F9E8EC"
        }
      ];
    }

    return [
      {
        title: "鸡蛋金枪鱼三明治",
        emoji: "🥪",
        description: "高蛋白又方便，适合状态不错时继续保持稳定进食。",
        calories: "约 430 kcal",
        accent: "#5C8A3A",
        background: "#EEF7E8"
      },
      {
        title: "希腊酸奶莓果燕麦杯",
        emoji: "🍓",
        description: "训练后或下午加餐都合适，能帮助你更轻松补足蛋白质。",
        calories: "约 320 kcal",
        accent: "#8E6B3E",
        background: "#FBF1DE"
      },
      {
        title: "鸡腿肉糙米饭",
        emoji: "🍛",
        description: "主食与蛋白质比例均衡，适合继续推进增肌计划。",
        calories: "约 560 kcal",
        accent: "#5E728D",
        background: "#EAF0F7"
      }
    ];
  }

  if (averageMood > 0 && averageMood <= 45) {
    return [
      {
        title: "南瓜燕麦浓汤",
        emoji: "🎃",
        description: "温热又有饱腹感，适合心情低落时做一顿轻负担正餐。",
        calories: "约 280 kcal",
        accent: "#8E6B3E",
        background: "#FBF1DE"
      },
      {
        title: "鸡胸肉蔬菜卷",
        emoji: "🌯",
        description: "热量友好，蛋白质足，能减少低落时想吃太多零食的冲动。",
        calories: "约 330 kcal",
        accent: "#5C8A3A",
        background: "#EEF7E8"
      },
      {
        title: "热酸奶水果杯",
        emoji: "🍎",
        description: "适合作为安慰型加餐，口感柔和，也方便控制总热量。",
        calories: "约 220 kcal",
        accent: "#8C5F67",
        background: "#F9E8EC"
      }
    ];
  }

  return [
    {
      title: "虾仁时蔬全麦意面",
      emoji: "🍝",
      description: "在心情稳定时很适合作为轻盈主餐，能量和饱腹感都比较平衡。",
      calories: "约 410 kcal",
      accent: "#5C8A3A",
      background: "#EEF7E8"
    },
    {
      title: "低糖酸奶莓果杯",
      emoji: "🫐",
      description: "适合作为下午加餐，帮助你把饮食节奏维持在舒服的范围里。",
      calories: "约 190 kcal",
      accent: "#5E728D",
      background: "#EAF0F7"
    },
    {
      title: "鸡胸牛油果能量碗",
      emoji: "🥗",
      description: "蛋白质、纤维和健康脂肪都更均衡，适合继续推进减脂计划。",
      calories: "约 390 kcal",
      accent: "#8E6B3E",
      background: "#FBF1DE"
    }
  ];
}

function ComparisonChart({ points, planDailyCalories }: { points: TrendPoint[]; planDailyCalories: number }) {
  if (points.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[24px] border border-dashed border-border/80 bg-white/60 text-sm text-muted-foreground">
        暂无多天数据，先去饮食记录页补录不同日期吧。
      </div>
    );
  }

  const width = 820;
  const height = 320;
  const padding = { top: 24, right: 56, bottom: 42, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const calorieMax = Math.max(planDailyCalories, ...points.map((point) => point.calories), 1200);
  const moodMax = MOOD_MAX_SCORE_PER_DAY;

  const xFor = (index: number) =>
    points.length === 1 ? padding.left + plotWidth / 2 : padding.left + (plotWidth / (points.length - 1)) * index;
  const yForCalories = (value: number) => padding.top + plotHeight * (1 - value / calorieMax);
  const yForMood = (value: number) => padding.top + plotHeight * (1 - value / moodMax);

  const caloriePolyline = points.map((point, index) => `${xFor(index)},${yForCalories(point.calories)}`).join(" ");
  const moodPolyline = points.map((point, index) => `${xFor(index)},${yForMood(point.moodScore)}`).join(" ");
  const targetY = yForCalories(planDailyCalories);

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/80 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d86a4a]" />
          每日摄入热量
        </span>
        <span className="inline-flex items-center gap-2 text-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-[#7f6ff2]" />
          每日心情分
        </span>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="h-px w-5 border-t border-dashed border-[#d86a4a]" />
          热量预算参考线
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full">
        {[0, 1, 2, 3, 4].map((step) => {
          const y = padding.top + (plotHeight / 4) * step;
          const calorieValue = Math.round(calorieMax - (calorieMax / 4) * step);
          const moodValue = Math.round(moodMax - (moodMax / 4) * step);

          return (
            <g key={step}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#E9DED8" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#8A7C74">
                {calorieValue}
              </text>
              <text x={width - padding.right + 10} y={y + 4} fontSize="11" fill="#8A7C74">
                {moodValue}
              </text>
            </g>
          );
        })}

        <line
          x1={padding.left}
          y1={targetY}
          x2={width - padding.right}
          y2={targetY}
          stroke="#D86A4A"
          strokeDasharray="6 6"
          strokeWidth="1.5"
          opacity="0.75"
        />

        <polyline fill="none" stroke="#D86A4A" strokeWidth="4" strokeLinecap="round" points={caloriePolyline} />
        <polyline fill="none" stroke="#7F6FF2" strokeWidth="4" strokeLinecap="round" points={moodPolyline} />

        {points.map((point, index) => {
          const x = xFor(index);
          return (
            <g key={point.date}>
              <circle cx={x} cy={yForCalories(point.calories)} r="5" fill="#D86A4A" />
              <circle cx={x} cy={yForMood(point.moodScore)} r="5" fill="#7F6FF2" />
              <text x={x} y={height - 14} textAnchor="middle" fontSize="11" fill="#6F625C">
                {point.shortDate}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function PersonalizedAnalysisDashboard() {
  const {
    profile,
    appliedProfile,
    isHydrated: isProfileHydrated,
    loadFromStorage: loadProfileFromStorage
  } = useProfileStore();
  const { logs, isHydrated: isLogHydrated, loadFromStorage: loadLogsFromStorage, syncToday } = useDailyIntakeStore();

  useEffect(() => {
    loadProfileFromStorage();
    loadLogsFromStorage();
  }, [loadLogsFromStorage, loadProfileFromStorage]);

  useEffect(() => {
    syncToday();
  }, [syncToday]);

  const currentProfile = appliedProfile ?? profile;
  const plan = useMemo(() => calculateNutritionPlan(currentProfile), [currentProfile]);
  const trendPoints = useMemo(() => buildTrendPoints(logs), [logs]);
  const analysisMessage = useMemo(
    () => buildAnalysisMessage(trendPoints, Math.max(plan.dailyCalories, 1)),
    [plan.dailyCalories, trendPoints]
  );
  const recommendations = useMemo(
    () => buildRecommendations(trendPoints, formatGoalLabel(currentProfile.goal)),
    [currentProfile.goal, trendPoints]
  );
  const averageCalories =
    trendPoints.length > 0 ? trendPoints.reduce((sum, point) => sum + point.calories, 0) / trendPoints.length : 0;
  const averageMood =
    trendPoints.length > 0 ? trendPoints.reduce((sum, point) => sum + point.moodScore, 0) / trendPoints.length : 0;
  const latestPoint = trendPoints[trendPoints.length - 1];

  if (!isProfileHydrated || !isLogHydrated) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-center text-muted-foreground">正在加载个性化分析...</div>;
  }

  return (
    <main className="min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardNav />

        <section className="overflow-hidden rounded-[36px] border border-white/60 bg-hero-glow p-8 shadow-soft">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden rounded-[30px] border border-white/60 bg-white/50 px-8 py-8 backdrop-blur-sm">
              <div className="absolute -left-8 top-5 h-24 w-24 rounded-full bg-[#f6cdb4]/35 blur-2xl" />
              <div className="absolute right-2 top-2 h-28 w-28 rounded-full bg-white/50 blur-3xl" />
              <p className="relative text-xs uppercase tracking-[0.32em] text-muted-foreground">Personal Insight</p>
              <h1 className="relative mt-4 text-[clamp(2rem,4.6vw,3.7rem)] font-semibold tracking-[0.06em] text-[#3a2721]">
                个性化分析
              </h1>
              <p className="relative mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                这里会把你多天记录下来的摄入热量和每日心情分放到同一张对比曲线上，帮助你看清楚心情与饮食之间的联系。
              </p>
              <div className="relative mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2">
                  <Target className="h-4 w-4" />
                  当前目标：{formatGoalLabel(currentProfile.goal)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2">
                  <CalendarDays className="h-4 w-4" />
                  已纳入 {trendPoints.length} 天数据
                </span>
              </div>
            </div>

            <Card className="bg-white/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  温心建议
                </CardTitle>
                <CardDescription>{analysisMessage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[24px] bg-[#fff6f0] p-5">
                  <p className="text-sm text-muted-foreground">最近一次记录</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {latestPoint ? formatDateLabel(latestPoint.date) : "还没有多天记录"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-foreground">
                    {latestPoint
                      ? `当天摄入 ${formatAmount(latestPoint.calories)} kcal，每日心情分 ${latestPoint.moodScore} 分。`
                      : "去饮食记录页选择不同日期录入数据后，这里会自动更新。"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                记录天数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-foreground">{trendPoints.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">最近最多展示 14 天趋势</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                平均摄入
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-foreground">{Math.round(averageCalories)}</p>
              <p className="mt-2 text-sm text-muted-foreground">kcal / 天，预算为 {Math.round(plan.dailyCalories)} kcal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" />
                平均心情
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-foreground">{Math.round(averageMood)}</p>
              <p className="mt-2 text-sm text-muted-foreground">分 / 天，满分 {MOOD_MAX_SCORE_PER_DAY} 分</p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>每日心情与摄入对比曲线</CardTitle>
            <CardDescription>橙色代表摄入热量，紫色代表每日心情分，虚线代表你的每日热量预算。</CardDescription>
          </CardHeader>
          <CardContent>
            <ComparisonChart points={trendPoints} planDailyCalories={Math.max(plan.dailyCalories, 1)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>个性化美食推荐</CardTitle>
            <CardDescription>会结合你的目标方向、最近心情和摄入节奏，给出更贴近当下状态的选择。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {recommendations.map((item) => (
              <div
                key={item.title}
                className="overflow-hidden rounded-[26px] border border-white/70 p-5"
                style={{ backgroundColor: item.background }}
              >
                <div
                  className="flex h-28 items-center justify-center rounded-[22px] text-5xl"
                  style={{ background: `linear-gradient(135deg, ${item.accent}22, rgba(255,255,255,0.78))` }}
                >
                  {item.emoji}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#5c4c44]">{item.description}</p>
                <p className="mt-4 text-sm font-medium" style={{ color: item.accent }}>
                  {item.calories}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
