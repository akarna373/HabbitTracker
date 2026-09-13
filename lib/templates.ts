export type IconSet = "ionicons" | "material";

export interface GoodTemplate {
  id: string;
  name: string;
  description: string;
  unit: string;
  targetAmount: number;
  microtasks: string[];
  iconSet: IconSet;
  icon: string;
}

export const GOOD_TEMPLATES: GoodTemplate[] = [
  {
    id: "read",
    name: "Read a little",
    description: "Track pages or minutes",
    unit: "minutes",
    targetAmount: 10,
    microtasks: ["Put the book on the desk", "Open to the saved page", "Read for two minutes"],
    iconSet: "ionicons",
    icon: "book-outline",
  },
  {
    id: "walking_jogging",
    name: "Walking and Jogging",
    description: "Track minutes spent walking or jogging outdoors",
    unit: "minutes",
    targetAmount: 20,
    microtasks: ["Put on your shoes", "Step outside the door", "Walk or jog for five minutes"],
    iconSet: "material",
    icon: "run-fast",
  },
  {
    id: "mindfulness",
    name: "Practice mindfulness",
    description: "Meditation or breathing",
    unit: "minutes",
    targetAmount: 10,
    microtasks: ["Find a quiet spot", "Sit and close your eyes", "Breathe for one minute"],
    iconSet: "ionicons",
    icon: "leaf-outline",
  },
];

export const CUSTOM_GOOD_TEMPLATE_ID = "custom-good";

export const STUDY_TEMPLATES: GoodTemplate[] = [
  {
    id: "practice_problems",
    name: "Practice problems",
    description: "Work through exercises or past papers",
    unit: "minutes",
    targetAmount: 30,
    microtasks: ["Open your practice set", "Pick where you left off", "Solve for ten minutes"],
    iconSet: "ionicons",
    icon: "create-outline",
  },
  {
    id: "syllabus",
    name: "Track Syllabus and revision",
    description: "Work through your syllabus, topic by topic",
    unit: "minutes",
    targetAmount: 20,
    microtasks: ["Open your syllabus", "Pick the next topic", "Revise it for ten minutes"],
    iconSet: "ionicons",
    icon: "clipboard-outline",
  },
  {
    id: "read_chapter",
    name: "Read a chapter",
    description: "Textbooks, papers or course material",
    unit: "minutes",
    targetAmount: 25,
    microtasks: ["Open your textbook or reading", "Find your bookmark", "Read for ten minutes"],
    iconSet: "ionicons",
    icon: "library-outline",
  },
  {
    id: "watch_lecture",
    name: "Watch a lecture",
    description: "Video courses, recorded classes or tutorials",
    unit: "minutes",
    targetAmount: 20,
    microtasks: ["Open your lecture or course", "Find where you paused", "Watch for ten minutes"],
    iconSet: "ionicons",
    icon: "videocam-outline",
  },
];

export const CUSTOM_STUDY_TEMPLATE_ID = "custom-study";

export const FITNESS_TEMPLATES: GoodTemplate[] = [
  {
    id: "medication",
    name: "Take medication",
    description: "Never miss a dose",
    unit: "doses",
    targetAmount: 1,
    microtasks: ["Get your pillbox", "Take today's dose", "Mark it done"],
    iconSet: "ionicons",
    icon: "medical-outline",
  },
  {
    id: "stretch",
    name: "Stretch",
    description: "Loosen up and prevent stiffness",
    unit: "minutes",
    targetAmount: 5,
    microtasks: ["Clear a small space", "Stretch your legs and back", "Breathe and relax"],
    iconSet: "ionicons",
    icon: "body-outline",
  },
  {
    id: "sleep",
    name: "Sleep on time",
    description: "Protect tomorrow's energy",
    unit: "check-ins",
    targetAmount: 1,
    microtasks: ["Set a bedtime alarm", "Put your phone away", "Lights off"],
    iconSet: "ionicons",
    icon: "moon-outline",
  },
  {
    id: "nutrition",
    name: "Eat a fruit or vegetable",
    description: "One small step toward better nutrition",
    unit: "servings",
    targetAmount: 3,
    microtasks: ["Wash a fruit or vegetable", "Add it to your plate", "Eat it before your next meal"],
    iconSet: "ionicons",
    icon: "nutrition-outline",
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
  { id: "good", title: "Build a good habit", subtitle: "Health, study, routines or custom", enabled: true },
  { id: "finance", title: "Finance", subtitle: "Category planned for a later release", enabled: false },
  { id: "study", title: "Study", subtitle: "Category planned for a later release", enabled: false },
  { id: "meditation", title: "Meditation", subtitle: "Category planned for a later release", enabled: false },
  { id: "growth", title: "Personal growth", subtitle: "Category planned for a later release", enabled: false },
  { id: "career", title: "Career", subtitle: "Category planned for a later release", enabled: false },
];

export const URGE_MICROTASKS = ["Pause and take five breaths", "Change your surroundings", "Message your supporter"];
