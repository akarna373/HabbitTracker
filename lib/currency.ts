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
