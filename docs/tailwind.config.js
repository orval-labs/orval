// tailwind.config.js

import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./src/**/*.ts', './src/**/*.tsx'],
  theme: {
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
      sans: ['Inter', ...defaultTheme.fontFamily.sans],
      serif: ['Inter', ...defaultTheme.fontFamily.serif],
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1400px',
    },
    rotate: {
      ...defaultTheme.rotate,
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
  },
};
