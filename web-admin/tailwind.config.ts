import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#6D5EF7",
        bg: "#0B0F1A",
        surface: "#121A2A",
        surface2: "#0F1626",
        border: "#202A3C",
        text: "#EAF0FF",
        text2: "#A9B4CC",
        danger: "#FF5C7A",
      },
      borderRadius: {
        brand: "16px",
      },
    },
  },
};

export default config;
