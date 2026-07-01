export default {
  content: ["./src/**/*.{ts,tsx}", "./*.html"],
  theme: {
    extend: {
      fontFamily: { lexend: ["Lexend", "sans-serif"] },
      colors: {
        brand: {
          50:"#f0f7ff", 100:"#e0effe", 200:"#bae0fd",
          300:"#7cc8fb", 400:"#36abf7", 500:"#0c91e8",
          600:"#0072c6", 700:"#015aa1", 800:"#064d85", 900:"#0b416e"
        }
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideUp: { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        fadeIn:  "fadeIn 0.2s ease-out",
        slideUp: "slideUp 0.25s ease-out",
      }
    },
  },
  plugins: [],
};
