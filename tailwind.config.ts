import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Plus Jakarta Sans is the Movestock brand typeface (Phase 38).
        // Falls back to system stack on cold-load + Noto fallbacks for non-Latin.
        sans: [
          "var(--font-jakarta)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // Movestock brand palette (Phase 38) — teal-forward, friendly, flat.
        brand: {
          DEFAULT: "#1ABC9C",
          hover: "#15A886",
          dark: "#0F6E56",
          light: "#E1F5EE",
        },
        surface: "#F5F5F5",
        ink: "#1A1A1A",
        line: "#E0E0E0",
        chat: {
          received: "#F0F0F0",
          canvas: "#ECE5DD",
        },
      },
      borderRadius: {
        // Spec radii — utilities below are the canonical sizes.
        // Buttons: rounded-full (50px).  Cards: rounded-2xl (16px).
        // Inputs: rounded-xl (12px).  Icon containers: rounded-[10px].
        // Chat bubbles: rounded-[18px] (with 4px tail corner).
      },
      // Ensure minimum tap target sizes for mobile
      minHeight: {
        touch: "48px",
      },
      minWidth: {
        touch: "48px",
      },
    },
  },
  plugins: [],
};

export default config;
