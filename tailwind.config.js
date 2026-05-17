/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.12)",
        glow: "0 0 0 1px rgba(148, 163, 184, 0.15), 0 12px 30px rgba(15, 23, 42, 0.12)",
      },
      backgroundImage: {
        "dashboard-radial":
          "radial-gradient(circle at top left, rgba(56, 189, 248, 0.22), transparent 28%), radial-gradient(circle at 80% 10%, rgba(14, 165, 233, 0.18), transparent 22%), linear-gradient(135deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.96))",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
