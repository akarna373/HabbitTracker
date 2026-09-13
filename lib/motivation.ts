// A fixed pool of short lines mixing two angles - health facts and the
// family-appeal framing the user asked for. No real family data exists in
// this app, so these stay generic rather than personalized.
const MOTIVATION_MESSAGES = [
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

export function pickMotivationMessage(): string {
  const index = Math.floor(Math.random() * MOTIVATION_MESSAGES.length);
  return MOTIVATION_MESSAGES[index];
}
