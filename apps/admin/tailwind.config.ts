import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/react-tailwindcss-datepicker/dist/index.esm.js',
    '../../node_modules/react-tailwindcss-datepicker/dist/index.esm.js',
  ],
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--border))',
        surface: 'rgb(var(--surface))',
        background: 'rgb(var(--background))',
        foreground: 'rgb(var(--foreground))',
        primary: {
          DEFAULT: 'rgb(var(--primary))',
          foreground: 'rgb(var(--primary-foreground))',
          soft: 'rgb(var(--primary-soft))',
          'soft-foreground': 'rgb(var(--primary-soft-foreground))',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary))',
          foreground: 'rgb(var(--secondary-foreground))',
        },
        info: {
          DEFAULT: 'rgb(var(--info))',
          soft: 'rgb(var(--info-soft))'
        },
        success: {
          DEFAULT: 'rgb(var(--success))',
          soft: 'rgb(var(--success-soft))'
        },
        warning: {
          DEFAULT: 'rgb(var(--warning))',
          soft: 'rgb(var(--warning-soft))',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive))',
          soft: 'rgb(var(--destructive-soft))',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted))',
          soft: 'rgb(var(--muted-soft))',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent))',
          soft: 'rgb(var(--accent-soft))',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover))',
          soft: 'rgb(var(--popover-soft))',
        },
        card: {
          DEFAULT: 'rgb(var(--card))',
          soft: 'rgb(var(--card-soft))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontSize: {
        'xs-tight': '10px',
        'xs': '11px',
        'sm-custom': '0.82rem',
        'base': '15px',
        'lg-loose': '1.75rem',
        'xl-loose': '1.85rem'
      },
    },
  },
  plugins: [],
}

export default config
