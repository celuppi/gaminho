import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";
import scrollbar from "tailwind-scrollbar";

export default {
  content: ["./src/**/*.tsx"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plus-jakarta-sans), Plus Jakarta Sans"],
      },
      fontSize: {
        sm: "0.8rem",
      },
      boxShadow: {
        "3xl-dark": "0px 16px 70px rgba(0, 0, 0, 0.5)",
        "3xl-light":
          "rgba(0, 0, 0, 0.12) 0px 4px 30px, rgba(0, 0, 0, 0.04) 0px 3px 17px, rgba(0, 0, 0, 0.04) 0px 2px 8px, rgba(0, 0, 0, 0.04) 0px 1px 1px",
      },
      animation: {
        "border-spin": "border-spin 4s linear infinite",
        "fade-down": "fade-down 0.5s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        scroll: "scroll 40s linear infinite",
      },

      keyframes: {
        "border-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "fade-down": {
          "0%": {
            opacity: "0",
            transform: "translateY(-20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
          },
          "100%": {
            opacity: "1",
          },
        },
        scroll: {
          "0%": {
            transform: "translateX(0)",
          },
          "100%": {
            transform: "translateX(calc(-50% - 1.5rem))",
          },
        },
      },
      colors: {
        "dark-50": "#020617",
        "dark-100": "#0f172a",
        "dark-200": "#1e293b",
        "dark-300": "#334155",
        "dark-400": "#475569",
        "dark-500": "#64748b",
        "dark-600": "#94a3b8",
        "dark-700": "#cbd5e1",
        "dark-800": "#e2e8f0",
        "dark-900": "#f1f5f9",
        "dark-950": "#f8fafc",
        "dark-1000": "#ffffff",
        "light-50": "#f8fafc",
        "light-100": "#f1f5f9",
        "light-200": "#e2e8f0",
        "light-300": "#cbd5e1",
        "light-400": "#94a3b8",
        "light-500": "#64748b",
        "light-600": "#475569",
        "light-700": "#334155",
        "light-800": "#1e293b",
        "light-900": "#0f172a",
        "light-950": "#020617",
        "light-1000": "#000000",
        "brand-50": "#eef2ff",
        "brand-100": "#e0e7ff",
        "brand-200": "#c7d2fe",
        "brand-300": "#a5b4fc",
        "brand-400": "#818cf8",
        "brand-500": "#6366f1",
        "brand-600": "#4f46e5",
        "brand-700": "#4338ca",
        "brand-800": "#3730a3",
        "brand-900": "#312e81",
        "brand-950": "#1e1b4b",
      },
      screens: {
        "2xl": "1600px",
      },
    },
  },
  plugins: [forms, scrollbar],
} satisfies Config;
