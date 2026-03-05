/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
      },
      colors: {
        pixel: {
          bg: "#1a1a2e",
          panel: "#16213e",
          border: "#0f3460",
          accent: "#e94560",
          green: "#4ade80",
          yellow: "#fbbf24",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
