import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        violet: {
          50: { value: "#f5f3ff" },
          100: { value: "#ede9fe" },
          200: { value: "#ddd6fe" },
          300: { value: "#c4b5fd" },
          400: { value: "#a78bfa" },
          500: { value: "#8b5cf6" },
          600: { value: "#7c3aed" },
          700: { value: "#6d28d9" },
          800: { value: "#5b21b6" },
          900: { value: "#4c1d95" },
          950: { value: "#2e1065" },
        },
        space: {
          50: { value: "#2a2a2a" },
          100: { value: "#232323" },
          200: { value: "#1e1e1e" },
          300: { value: "#181818" },
          400: { value: "#141414" },
          500: { value: "#101010" },
          600: { value: "#0c0c0c" },
          700: { value: "#080808" },
          800: { value: "#050505" },
          900: { value: "#030405" },
        },
      },
    },
    semanticTokens: {
      colors: {
        violet: {
          solid: { value: "{colors.violet.500}" },
          fg: { value: "{colors.violet.400}" },
          muted: { value: "{colors.violet.900}" },
        },
        bg: {
          DEFAULT: { value: "{colors.space.900}" },
          muted: { value: "{colors.space.700}" },
          panel: { value: "{colors.space.600}" },
        },
        fg: {
          DEFAULT: { value: "#e5e5e5" },
          muted: { value: "#8a8a8a" },
        },
        border: {
          DEFAULT: { value: "rgba(255, 255, 255, 0.08)" },
          emphasized: { value: "rgba(139, 92, 246, 0.25)" },
        },
      },
    },
  },
  globalCss: {
    "html, body": {
      bg: "#080809",
      color: "fg",
      fontFamily: "'Geist', 'Aptos', 'Segoe UI Variable', sans-serif",
    },
    "*::selection": {
      bg: "violet.600",
      color: "white",
    },
  },
})

export const system = createSystem(defaultConfig, config)

export const glassCardStyle = {
  bg: "#100d13",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "16px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
}
