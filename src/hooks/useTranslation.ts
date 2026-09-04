import { useGov } from "../context/GovContext";
import { t as translate, TranslationKey } from "../i18n/translations";

export function useTranslation() {
  const { language } = useGov();

  const t = (key: TranslationKey | string): string => {
    return translate(key, language);
  };

  return { t, language };
}
