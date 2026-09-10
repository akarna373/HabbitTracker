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
  { id: "water", name: "Drink water", description: "Track glasses or millilitres", unit: "glasses", targetAmount: 8, microtasks: [], iconSet: "ionicons", icon: "water-outline" },
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
  { id: "move", name: "Move your body", description: "Walk, run, stretch or exercise", unit: "minutes", targetAmount: 20, microtasks: [], iconSet: "ionicons", icon: "walk-outline" },
  { id: "study", name: "Study consistently", description: "Useful for Loksewa preparation", unit: "minutes", targetAmount: 30, microtasks: [], iconSet: "ionicons", icon: "school-outline" },
  { id: "mindfulness", name: "Practice mindfulness", description: "Meditation or breathing", unit: "minutes", targetAmount: 10, microtasks: [], iconSet: "ionicons", icon: "leaf-outline" },
];

export const CUSTOM_GOOD_TEMPLATE_ID = "custom-good";

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
}

export const QUIT_TEMPLATES: QuitTemplate[] = [
  { id: "smoking", name: "Smoking cigarettes", description: "Track quantity, cost and smoke-free days", unit: "sticks", hasCost: true, defaultBaselineQuantity: 5, defaultPricePerItem: 20, iconSet: "material", icon: "smoking-off" },
  { id: "alcohol", name: "Drinking alcohol", description: "Track drinks, spending and sober days", unit: "drinks", hasCost: true, defaultBaselineQuantity: 2, defaultPricePerItem: 150, iconSet: "ionicons", icon: "wine-outline" },
  { id: "panmasala", name: "Chewing pan masala", description: "Example: Rajnigandha; track packets and cost", unit: "packets", hasCost: true, defaultBaselineQuantity: 3, defaultPricePerItem: 10, iconSet: "material", icon: "tooth-outline" },
  { id: "scrolling", name: "Reduce scrolling", description: "Track time and urge alternatives", unit: "minutes", hasCost: false, defaultBaselineQuantity: 60, defaultPricePerItem: 0, iconSet: "ionicons", icon: "phone-portrait-outline" },
];

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
