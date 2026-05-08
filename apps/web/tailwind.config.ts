import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/react-tailwindcss-datepicker/dist/index.esm.js'
  ],
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--border))',
        input: 'rgb(var(--input))',
        ring: 'rgb(var(--ring))',
        background: {
          DEFAULT: 'rgb(var(--background))',
          secondary: 'rgb(var(--background-secondary))'
        },
        foreground: 'rgb(var(--foreground))',
        surface: {
          DEFAULT: 'rgb(var(--surface))',
          warm: {
            DEFAULT: 'rgb(var(--surface-warm))',
            soft: 'rgb(var(--surface-warm-soft))'
          }
        },
        primary: {
          DEFAULT: 'rgb(var(--primary))',
          soft: {
            DEFAULT: 'rgb(var(--primary-soft))',
            foreground: 'rgb(var(--primary-soft-foreground))'
          },
          foreground: 'rgb(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary))',
          soft: 'rgb(var())',
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
          foreground: 'rgb(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted))',
          soft: 'rgb(var())',
          foreground: 'rgb(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover))',
          foreground: 'rgb(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'rgb(var(--card))',
          foreground: 'rgb(var(--card-foreground))',
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
      }
    },
  },
  plugins: [],
}

export default config
