// Compatibility entry: importing this module registers all bundled languages.
import { localeActions } from './locales';
import bn from './locales/bn';
import de from './locales/de';
import es from './locales/es';
import fi from './locales/fi';
import fr from './locales/fr';
import hi from './locales/hi';
import hu_HU from './locales/hu';
import id from './locales/id';
import it from './locales/it';
import ja from './locales/ja';
import ko from './locales/ko';
import pt_BR from './locales/pt-br';
import ru from './locales/ru';
import tr from './locales/tr';
import vi from './locales/vi';
import zh_CN from './locales/zh-cn';
import zh_TW from './locales/zh-tw';

/** Bundled languages, most widely spoken first. English is always registered. */
const BUNDLED = {
  zh_CN,
  zh_TW,
  hi,
  es,
  fr,
  bn,
  pt_BR,
  ru,
  id,
  de,
  ja,
  tr,
  vi,
  ko,
  it,
  hu_HU,
  fi,
};

for (const [language, messages] of Object.entries(BUNDLED)) {
  localeActions.setMessage(language, messages);
}

export { localeActions, translate, useLocale, en } from './locales';
export { zh_CN, zh_TW, hi, es, fr, bn, pt_BR, ru, id, de, ja, tr, vi, ko, it, hu_HU, fi };
