/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                proios: {
                    accent: '#13a6b8', // Cyan/Teal logo accent
                    dark: '#374151',   // Dark gray text
                    bg: '#f3f4f6',     // Light industrial background
                    card: '#ffffff',   // White panels
                },
                // Sobrescribimos el color indigo por el del logo para que toda la app se adapte automáticamente
                indigo: {
                    50: '#f0fbfd',
                    100: '#dbf5fa',
                    200: '#baeef5',
                    300: '#89e2ec',
                    400: '#50cce1',
                    500: '#2bb1c8',
                    600: '#13a6b8', // Color primario del logo
                    700: '#117b8b',
                    800: '#136371',
                    900: '#15525e',
                    950: '#093641',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
