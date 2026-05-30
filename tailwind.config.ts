import type { Config } from "tailwindcss";

/**
 * Design tokens mirror design.md (Coinbase-inspired system):
 * white canvas + ink + a single brand voltage (Coinbase Blue #0052ff),
 * pill CTAs, rounded-xl (24px) cards, Inter for text, JetBrains Mono for numbers.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand & semantic colors stay FIXED across themes (so /opacity
        // modifiers keep working and the brand voltage never shifts).
        primary: {
          DEFAULT: "#0052ff",
          active: "#003ecc",
          disabled: "#a8b8cc",
        },
        "on-primary": "#ffffff",
        "on-dark": "#ffffff",
        "on-dark-soft": "#a8acb3",
        up: "#05b169",
        down: "#cf202f",
        // Accent yellow — promoted to a usable secondary action color.
        warn: {
          DEFAULT: "#f4b000",
          active: "#d89e00",
          ink: "#0a0b0d", // text that sits on yellow (always dark)
        },

        // Themeable neutrals — RGB channel vars that flip under `.dark`.
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: {
          soft: "rgb(var(--surface-soft) / <alpha-value>)",
          strong: "rgb(var(--surface-strong) / <alpha-value>)",
          dark: "#0a0b0d", // explicit dark panels (login hero) — fixed
          "dark-elevated": "#16181c",
        },
        hairline: {
          DEFAULT: "rgb(var(--hairline) / <alpha-value>)",
          soft: "rgb(var(--hairline-soft) / <alpha-value>)",
        },
        ink: "rgb(var(--ink) / <alpha-value>)",
        body: "rgb(var(--body) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          soft: "rgb(var(--muted-soft) / <alpha-value>)",
        },
        // Always-dark scrim for modal overlays (correct in both themes).
        scrim: "rgb(10 11 13 / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        pill: "100px",
      },
      letterSpacing: {
        display: "-0.015em",
      },
      boxShadow: {
        soft: "0 4px 12px rgba(0, 0, 0, 0.04)",
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
