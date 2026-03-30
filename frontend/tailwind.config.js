/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                proios: {
                    accent: '#13a6b8', // Cyan/Teal logo accent
                    dark: '#374151',   // Dark gray text
                    bg: '#f3f4f6',     // Light industrial background
                    card: '#ffffff',   // White panels
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
