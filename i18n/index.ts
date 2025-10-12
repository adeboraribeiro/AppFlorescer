import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import es from './es';
import ptBR from './pt-BR';

const resources = {
  'pt-BR': {
    translation: ptBR
  },
  'en': {
    translation: en
  },
  'es': {
    translation: es
  }
};

i18next
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt-BR', // default language
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false
    },
    compatibilityJSON: 'v4' // This is required for React Native
  });

export default i18next;
