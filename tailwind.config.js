/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#0ea568",
          greenDark: "#0b8857",
          chipBg: "#e9f7f0",
        },
      },
      borderRadius: { "2xl": "1rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.06), 0 1px 1px rgba(16,24,40,.04)",
      },
    },
  },
  plugins: [],
};
