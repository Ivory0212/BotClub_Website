import type { Locale } from "../constants";
import { en } from "./en";
import { zhTW } from "./zh-TW";

export const messagesByLocale: Record<Locale, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  "zh-TW": zhTW as unknown as Record<string, unknown>,
};

export { en, zhTW };
export type { Messages } from "./en";
