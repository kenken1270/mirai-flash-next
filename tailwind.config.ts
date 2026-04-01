import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        mirai: {
          yellow:  '#F59E0B',
          cream:   '#FFFBEB',
          brown:   '#92400E',
          success: '#10B981',
          danger:  '#EF4444',
          soft:    '#FEF3C7',
        },
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
