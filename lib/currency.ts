import * as Localization from "expo-localization";

let cachedSymbol: string | null = null;

// Cost-tracking habits (smoking/alcohol/pan masala) were built assuming
// Rupees, but the app is meant to work anywhere - derive the symbol from
// the device's own region/locale instead of hardcoding one currency.
export function getCurrencySymbol(): string {
  if (cachedSymbol) return cachedSymbol;
  try {
    const locale = Localization.getLocales()[0];
    cachedSymbol = locale.currencySymbol ?? locale.currencyCode ?? "$";
  } catch {
    cachedSymbol = "$";
  }
  return cachedSymbol;
}

export function formatMoney(amount: number): string {
  return `${getCurrencySymbol()} ${amount.toFixed(0)}`;
}

// Alcohol has no universal serving unit (unlike a cigarette) - South Asia
// commonly measures by bottle fraction (quarter/half/full), most other
// regions by serving type. Quick-pick suggestions only - the user can still
// type anything else into the unit field.
export function getAlcoholUnitSuggestions(): string[] {
  try {
    const region = Localization.getLocales()[0]?.regionCode;
    if (region === "NP" || region === "IN") return ["Quarter", "Half", "Full"];
  } catch {
    // fall through to default suggestions
  }
  return ["Shot", "Can", "Glass", "Bottle"];
}
