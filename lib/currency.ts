import * as Localization from "expo-localization";

let cachedSymbol: string | null = null;

// The currency code saved in the financial settings (set from the store when it
// loads or changes). When set it is shown everywhere money is formatted; only
// before it is known does the device locale decide.
let activeCurrencyCode: string | null = null;

export function setActiveCurrencyCode(code: string | null): void {
  activeCurrencyCode = code;
}

// Explicit choices that beat whatever the platform's currency data says:
// Nepal writes its rupee as "Rs", and the data only offers the bare code "NPR".
const SYMBOL_OVERRIDES: Record<string, string> = { NPR: "Rs" };

// Used only if the platform has no Intl currency support at all.
const FALLBACK_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹", NPR: "Rs", PKR: "Rs", LKR: "Rs", BDT: "৳",
  KRW: "₩", CNY: "CN¥", RUB: "₽", TRY: "₺", THB: "฿", PHP: "₱", VND: "₫", NGN: "₦", UAH: "₴",
  ILS: "₪", AUD: "A$", CAD: "CA$", NZD: "NZ$", HKD: "HK$", MXN: "MX$", BRL: "R$", ZAR: "R",
};

const symbolCache = new Map<string, string>();

function intlCurrencySymbol(code: string, display: "symbol" | "narrowSymbol"): string | null {
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: display }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? null;
  } catch {
    return null;
  }
}

// The symbol people actually write for a currency code: "USD" -> "$", "INR" ->
// "₹", "JPY" -> "¥", "EUR" -> "€", "NPR" -> "Rs". Shared-symbol currencies keep
// a prefix so they stay distinguishable ("AUD" -> "A$"). A currency with no
// known symbol shows its code instead, so a number is never left unlabelled.
export function currencySymbolFor(code: string): string {
  const upper = code.trim().toUpperCase();
  const cached = symbolCache.get(upper);
  if (cached) return cached;

  let symbol: string | null = SYMBOL_OVERRIDES[upper] ?? null;
  if (!symbol) {
    const standard = intlCurrencySymbol(upper, "symbol");
    if (standard && standard !== upper) symbol = standard;
  }
  if (!symbol) {
    const narrow = intlCurrencySymbol(upper, "narrowSymbol");
    if (narrow && narrow !== upper) symbol = narrow;
  }
  const resolved = symbol ?? FALLBACK_SYMBOLS[upper] ?? upper;
  symbolCache.set(upper, resolved);
  return resolved;
}

// "$1,250" and "₹1,250" sit tight against the number; symbols made of letters
// get a space: "Rs 1,250", "CHF 1,250".
export function withCurrencySymbol(symbol: string, amountText: string): string {
  return /[A-Za-z]$/.test(symbol) ? `${symbol} ${amountText}` : `${symbol}${amountText}`;
}

// Cost-tracking habits (smoking/alcohol/pan masala) were built assuming
// Rupees, but the app is meant to work anywhere. Once the saved currency is
// known its symbol is used everywhere; only before that does the device's own
// region/locale decide.
export function getCurrencySymbol(): string {
  if (activeCurrencyCode) return currencySymbolFor(activeCurrencyCode);
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
  return withCurrencySymbol(getCurrencySymbol(), amount.toFixed(0));
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Whole amounts show without decimals, fractional ones with two ("Rs 12.50"),
// with thousands separators either way ("Rs 12.50", "$1,234") - for places where the exact figure
// matters (e.g. a screen reader label), unlike formatMoney's rounded whole units.
export function formatMoneyFull(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const [whole, fraction] = abs.toFixed(2).split(".");
  const text = fraction === "00" ? groupThousands(whole) : `${groupThousands(whole)}.${fraction}`;
  return `${negative ? "-" : ""}${withCurrencySymbol(getCurrencySymbol(), text)}`;
}

// formatMoneyFull until the figure gets long enough to crowd a small card, then
// abbreviated: 125,400 -> "Rs 125.4K", 1,250,000 -> "$1.25M". Nothing below
// 100,000 is ever abbreviated.
export function formatMoneyCompact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  if (abs < 100_000) return formatMoneyFull(safe);
  const sign = safe < 0 ? "-" : "";
  const trim = (n: number, places: number) => n.toFixed(places).replace(/\.?0+$/, "");
  // 999,950+ would round to "1000K", so it switches to millions a little early.
  const text = abs >= 999_950 ? `${trim(abs / 1_000_000, 2)}M` : `${trim(abs / 1_000, 1)}K`;
  return `${sign}${withCurrencySymbol(getCurrencySymbol(), text)}`;
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
