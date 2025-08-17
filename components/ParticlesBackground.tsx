import React, { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// This needs to be declared because particlesJS is a global from a script tag
declare var particlesJS: any;

const ParticlesBackground: React.FC = () => {
    const { theme } = useTheme();

    useEffect(() => {
        const lightThemeConfig = {
            particles: {
              number: { value: 60, density: { enable: true, value_area: 800 } },
              color: { value: "#2563eb" },
              shape: { type: "circle" },
              opacity: { value: 0.12, random: true },
              size: { value: 4, random: true },
              line_linked: { enable: true, distance: 150, color: "#8b5cf6", opacity: 0.1, width: 1 },
              move: { enable: true, speed: 2, direction: "none", random: false, out_mode: "out" }
            },
            interactivity: {
              detect_on: "canvas",
              events: {
                onhover: { enable: true, mode: "repulse" },
                onclick: { enable: true, mode: "push" }
              },
              modes: {
                repulse: { distance: 100, duration: 0.4 },
                push: { particles_nb: 3 }
              }
            },
            retina_detect: true
        };

        const darkThemeConfig = {
             particles: {
              number: { value: 60, density: { enable: true, value_area: 800 } },
              color: { value: "#f1f5f9" }, // slate-100
              shape: { type: "circle" },
              opacity: { value: 0.15, random: true },
              size: { value: 4, random: true },
              line_linked: { enable: true, distance: 150, color: "#94a3b8", opacity: 0.1, width: 1 }, // slate-400
              move: { enable: true, speed: 2, direction: "none", random: false, out_mode: "out" }
            },
            interactivity: {
              detect_on: "canvas",
              events: {
                onhover: { enable: true, mode: "repulse" },
                onclick: { enable: true, mode: "push" }
              },
              modes: {
                repulse: { distance: 100, duration: 0.4 },
                push: { particles_nb: 3 }
              }
            },
            retina_detect: true
        };

        if (typeof particlesJS !== 'undefined') {
            particlesJS("particles-js", theme === 'light' ? lightThemeConfig : darkThemeConfig);
        }

    }, [theme]);

    return null; // This component doesn't render anything itself
};

export default ParticlesBackground;
