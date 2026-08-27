/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Sora", "Manrope", "sans-serif"],
      },
      colors: {
        night: {
          950: "#07110d",
          900: "#0b1813",
          800: "#10241c",
          700: "#163228",
        },
        lime: {
          DEFAULT: "#3ddc84",
          dim: "#1fa85a",
        },
      },
      boxShadow: {
        glow: "0 0 40px rgba(61, 220, 132, 0.18)",
      },
    },
  },
  plugins: [],
};
