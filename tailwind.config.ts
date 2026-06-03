import type { Config } from 'tailwindcss'
// Tailwind is installed but not actively used for styling.
// All styles are pure inline React styles for reliability.
// This config is kept only for any residual class usage.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {} },
  plugins: [],
}
export default config
