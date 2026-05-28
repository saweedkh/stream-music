import { LOCALE_STORAGE_KEY } from "@/lib/i18n/types";

export function LocaleInitScript() {
  const script = `
(function () {
  try {
    var locale = localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});
    if (locale === "fa") {
      document.documentElement.lang = "fa";
      document.documentElement.dir = "rtl";
    } else {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
    }
  } catch (e) {}
  document.documentElement.style.opacity = "0";
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
