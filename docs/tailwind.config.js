// tailwind.config.js

import { fontFamily as _fontFamily, rotate as _rotate } from 'tailwindcss/defaultTheme';

export const content = ['./src/**/*.js', './src/**/*.jsx'];
export const theme = {
  extend: {
    colors: {
      coral: {
        light: '#F79D53',
        default: '#6F40C9',
        dark: '#F79D53',
      },
    },
  },
  fontFamily: {
    sans: ['Inter', ..._fontFamily.sans],
    serif: ['Inter', ..._fontFamily.serif],
  },
  screens: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1400px',
  },
  rotate: {
    ..._rotate,
    '-30': '-30deg',
  },
  container: {
    padding: '1rem',
  },
  customForms: (theme) => ({
    sm: {
      'input, textarea, multiselect, select': {
        fontSize: theme('fontSize.sm'),
        padding: `${theme('spacing.1')} ${theme('spacing.2')}`,
      },
      select: {
        paddingRight: `${theme('spacing.4')}`,
      },
      'checkbox, radio': {
        width: theme('spacing.3'),
        height: theme('spacing.3'),
      },
    },
  }),
};
export const plugins = [import('@tailwindcss/forms')];
