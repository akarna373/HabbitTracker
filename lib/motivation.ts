// Fixed pools of short lines mixing two angles - health facts and the
// family-appeal framing the user asked for. No real family data exists in
// this app, so these stay generic rather than personalized.
const SMOKING_MESSAGES = [
  "20 minutes without a cigarette and your heart rate is already dropping back to normal.",
  "Every one you skip is more time with the people waiting for you at home.",
  "In 12 hours, the carbon monoxide in your blood drops back to normal and oxygen levels rise.",
  "Someone who loves you would rather have more years with you than watch you light this one.",
  "Your sense of taste and smell start coming back within a few days of cutting down.",
  "The money this one costs could go toward something your family actually remembers.",
  "In a couple of weeks, your circulation and lung function start to improve.",
  "The next time your kids or family ask you to play, you'll have more breath for it.",
  "Cravings peak for a few minutes and then fade - this urge will pass whether you smoke or not.",
  "A year smoke-free roughly halves your added risk of heart disease compared to today.",
];

const ALCOHOL_MESSAGES = [
  "Your liver starts repairing itself within days of a drink-free stretch.",
  "Every one you skip is a clearer conversation with the people waiting for you at home.",
  "A night without drinking means real, restorative sleep instead of a false sense of rest.",
  "Someone who loves you would rather have more clear-headed years with you than watch you pour this one.",
  "The money this one costs could go toward something your family actually remembers.",
  "Cravings peak for a few minutes and then fade - this urge will pass whether you drink or not.",
  "Cutting back lowers your blood pressure and lets your body rebuild energy it's been spending on recovery.",
  "The next time your kids or family need you sharp, you'll have it to give.",
  "A sober year roughly halves your added long-term liver and heart risk compared to today.",
  "Tomorrow's you doesn't have to deal with tonight's decision.",
];

const PANMASALA_MESSAGES = [
  "Your gums start healing within days of skipping a chew.",
  "Every one you skip is less risk to your mouth and jaw long term.",
  "In a few weeks, mouth sores and irritation from chewing start to fade.",
  "Someone who loves you would rather have more healthy years with you than watch you chew this one.",
  "The money this one costs could go toward something your family actually remembers.",
  "Cravings peak for a few minutes and then fade - this urge will pass whether you chew or not.",
  "Cutting back lowers your long-term risk of oral cancer and gum disease.",
  "Your teeth and gums look and feel better the longer you go without it.",
  "A year chew-free meaningfully lowers your added oral cancer risk compared to today.",
  "Tomorrow's you doesn't have to deal with tonight's decision.",
];

const MESSAGES_BY_TEMPLATE: Record<string, string[]> = {
  smoking: SMOKING_MESSAGES,
  alcohol: ALCOHOL_MESSAGES,
  panmasala: PANMASALA_MESSAGES,
};

export function pickMotivationMessage(templateId?: string): string {
  const pool = (templateId && MESSAGES_BY_TEMPLATE[templateId]) || SMOKING_MESSAGES;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
