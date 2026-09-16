import type { TrackingMethod } from "./types";

export type IconSet = "ionicons" | "material" | "image";

export interface GoodTemplate {
  id: string;
  name: string;
  description: string;
  unit: string;
  targetAmount: number;
  microtasks: string[];
  iconSet: IconSet;
  icon: string;
  // Cost tracking for a "good" habit (e.g. Medication) - reuses the same
  // hasCost/pricePerItem fields and costForAmount math already built for
  // quit habits, just wired up for a good habit for the first time.
  hasCost?: boolean;
  defaultPricePerItem?: number;
  // Defaults to "amount" (the existing behavior) when omitted.
  trackingMethod?: TrackingMethod;
}

export const HEALTH_TEMPLATES: GoodTemplate[] = [
  {
    id: "medication",
    name: "Take medication",
    description: "Never miss a dose, and see what it costs",
    unit: "doses",
    targetAmount: 1,
    microtasks: [
      "Get your pillbox",
      "Take today's dose",
      "Mark it done",
      "You can also mark it done in notification panel",
    ],
    iconSet: "image",
    icon: "medication",
    hasCost: true,
    defaultPricePerItem: 20,
  },
  {
    id: "vitals_log",
    name: "Vitals log",
    description: "Track your blood pressure day to day",
    unit: "check-ins",
    targetAmount: 1,
    microtasks: ["Sit still for a minute first", "Take your reading", "Log it"],
    iconSet: "ionicons",
    icon: "pulse-outline",
    trackingMethod: "checkin",
  },
  {
    id: "doctor_checkup",
    name: "Doctor checkups",
    description: "A periodic reminder so a checkup never slips",
    unit: "check-ins",
    targetAmount: 1,
    microtasks: ["Call and book the appointment", "Write down what to ask", "Go"],
    iconSet: "ionicons",
    icon: "medkit-outline",
    trackingMethod: "checkin",
  },
];

export const CUSTOM_HEALTH_TEMPLATE_ID = "custom-health";

// Weight/waist, systolic/diastolic - two numbers logged together for one
// day. Template-constant display labels, not per-habit state.
export const DUAL_METRIC_LABELS: Record<string, { labelA: string; unitA: string; labelB: string; unitB: string }> = {
  weightloss_journey: { labelA: "Weight", unitA: "kg", labelB: "Waist", unitB: "cm" },
  vitals_log: { labelA: "Systolic", unitA: "mmHg", labelB: "Diastolic", unitB: "mmHg" },
};
export const DUAL_METRIC_TEMPLATE_IDS = Object.keys(DUAL_METRIC_LABELS);

export const STUDY_TEMPLATES: GoodTemplate[] = [
  {
    id: "exam_countdown",
    name: "Track your Exam",
    description: "A countdown to exam day, plus daily study time",
    unit: "minutes",
    targetAmount: 30,
    microtasks: ["Open your notes or textbook", "Pick a topic", "Study for ten minutes"],
    iconSet: "ionicons",
    icon: "school-outline",
  },
  {
    id: "syllabus_progress",
    name: "Track your Syllabus and progress",
    description: "Turn your syllabus into a day-by-day checklist with any AI chat app",
    unit: "minutes",
    targetAmount: 20,
    microtasks: ["Open your syllabus", "Pick the next topic", "Work through it for ten minutes"],
    iconSet: "ionicons",
    icon: "clipboard-outline",
  },
  {
    id: "attendance",
    name: "Attendance Tracker",
    description: "How many classes you can still miss and stay on target",
    unit: "check-ins",
    targetAmount: 1,
    microtasks: ["Check today's class schedule", "Go", "Log it after"],
    iconSet: "ionicons",
    icon: "checkbox-outline",
    trackingMethod: "checkin",
  },
];

export const CUSTOM_STUDY_TEMPLATE_ID = "custom-study";

export const FITNESS_TEMPLATES: GoodTemplate[] = [
  {
    id: "walking_jogging",
    name: "Walking and Jogging",
    description: "A morning-walk check-in, with a smart reminder",
    unit: "check-ins",
    targetAmount: 1,
    microtasks: ["Put on your shoes", "Step outside the door", "Walk or jog for five minutes"],
    iconSet: "material",
    icon: "run-fast",
    // Simple done/not-done for today, not a minutes count - matches the
    // "I went for a walk" one-tap notification action.
    trackingMethod: "checkin",
  },
  {
    id: "weightloss_journey",
    name: "Track your weightloss journey",
    description: "Weight and waist, together - waist catches what the scale alone misses",
    unit: "check-ins",
    targetAmount: 1,
    microtasks: ["Weigh in first thing, before eating", "Measure your waist at the navel", "Log both"],
    iconSet: "ionicons",
    icon: "body-outline",
    trackingMethod: "checkin",
  },
];

export const CUSTOM_FITNESS_TEMPLATE_ID = "custom-fitness";

export const PROJECT_TEMPLATES: GoodTemplate[] = [
  {
    id: "build_project",
    name: "Build your project",
    description: "Ship something new, one session at a time - like building this app",
    unit: "minutes",
    targetAmount: 30,
    microtasks: ["Open your project", "Pick one task", "Work for fifteen minutes"],
    iconSet: "ionicons",
    icon: "hammer-outline",
  },
  {
    id: "learn_skill",
    name: "Learn a new skill",
    description: "Courses, tutorials or deliberate practice",
    unit: "minutes",
    targetAmount: 20,
    microtasks: ["Open your course or notes", "Pick up where you left off", "Practice for ten minutes"],
    iconSet: "ionicons",
    icon: "bulb-outline",
  },
  {
    id: "side_hustle",
    name: "Freelance or side work",
    description: "Grow something of your own",
    unit: "minutes",
    targetAmount: 30,
    microtasks: ["Open your task list", "Pick the next task", "Work for fifteen minutes"],
    iconSet: "ionicons",
    icon: "briefcase-outline",
  },
  {
    id: "portfolio",
    name: "Build your portfolio",
    description: "Resume, portfolio site or personal brand",
    unit: "minutes",
    targetAmount: 20,
    microtasks: ["Open your portfolio project", "Pick one section to improve", "Work for ten minutes"],
    iconSet: "ionicons",
    icon: "document-text-outline",
  },
];

export const CUSTOM_PROJECT_TEMPLATE_ID = "custom-project";

export interface QuitTemplate {
  id: string;
  name: string;
  description: string;
  unit: string;
  hasCost: boolean;
  defaultBaselineQuantity: number;
  defaultPricePerItem: number;
  iconSet: IconSet;
  icon: string;
  // Overrides the generic URGE_MICROTASKS default with wording specific to
  // this habit, shown as the "when an urge appears" steps during setup.
  urgeMicrotasks?: string[];
  // Habit-specific copy for the detail/motivate/summary screens - falls back
  // to the smoking wording (see getQuitCopy) when omitted, so scrolling and
  // any custom quit habit still read sensibly without extra work.
  verb?: string; // "You {verb} 2 less than yesterday"
  daysLabel?: string; // "{n} {daysLabel}" this week
  motivateSubtitle?: string;
}

export const QUIT_TEMPLATES: QuitTemplate[] = [
  { id: "smoking", name: "Smoking cigarettes", description: "Track quantity, cost and smoke-free days", unit: "sticks", hasCost: true, defaultBaselineQuantity: 5, defaultPricePerItem: 20, iconSet: "material", icon: "smoking-off" },
  {
    id: "alcohol",
    name: "Drinking alcohol",
    description: "Track drinks, spending and sober days",
    unit: "drinks",
    hasCost: true,
    defaultBaselineQuantity: 2,
    defaultPricePerItem: 150,
    iconSet: "ionicons",
    icon: "wine-outline",
    urgeMicrotasks: ["Drink a glass of water first", "Step outside or change rooms", "Open the app and press Motivate me"],
    verb: "drank",
    daysLabel: "sober days",
    motivateSubtitle: "Before you pour one, read this.",
  },
  {
    id: "panmasala",
    name: "Chewing pan masala",
    description: "Example: Rajnigandha; track packets and cost",
    unit: "packets",
    hasCost: true,
    defaultBaselineQuantity: 3,
    defaultPricePerItem: 10,
    iconSet: "material",
    icon: "tooth-outline",
    urgeMicrotasks: ["Rinse your mouth with water", "Chew gum or saunf instead", "Step away for a few minutes"],
    verb: "chewed",
    daysLabel: "chew-free days",
    motivateSubtitle: "Before you chew one, read this.",
  },
  { id: "scrolling", name: "Reduce scrolling", description: "Track time and urge alternatives", unit: "minutes", hasCost: false, defaultBaselineQuantity: 60, defaultPricePerItem: 0, iconSet: "ionicons", icon: "phone-portrait-outline" },
];

const DEFAULT_QUIT_COPY = { verb: "smoked", daysLabel: "smoke-free days", motivateSubtitle: "Before you light up, read this." };

// Central lookup so the detail/motivate/summary screens all read the same
// habit-specific wording instead of each hardcoding smoking's terms.
export function getQuitCopy(templateId?: string | null): { verb: string; daysLabel: string; motivateSubtitle: string } {
  const template = QUIT_TEMPLATES.find((t) => t.id === templateId);
  return {
    verb: template?.verb ?? DEFAULT_QUIT_COPY.verb,
    daysLabel: template?.daysLabel ?? DEFAULT_QUIT_COPY.daysLabel,
    motivateSubtitle: template?.motivateSubtitle ?? DEFAULT_QUIT_COPY.motivateSubtitle,
  };
}

export const CUSTOM_QUIT_TEMPLATE_ID = "custom-quit";

export interface CategoryOption {
  id: string;
  title: string;
  subtitle: string;
  enabled: boolean;
}

export const CATEGORIES: CategoryOption[] = [
  { id: "quit", title: "Quit a bad habit", subtitle: "Smoking, alcohol, chewing products or custom", enabled: true },
  { id: "health", title: "Health", subtitle: "Medication, checkups and more", enabled: true },
  { id: "fitness", title: "Fitness", subtitle: "Walking, jogging and more", enabled: true },
  { id: "study", title: "Study", subtitle: "Exams, syllabus and attendance", enabled: true },
  { id: "projects", title: "Projects", subtitle: "Category planned for a later release", enabled: false },
  { id: "custom", title: "Create a Custom Template", subtitle: "Coming later", enabled: false },
];

export const URGE_MICROTASKS = ["Pause and take five breaths", "Change your surroundings", "Message your supporter"];
