import React from 'react';
import logo from '../assets/logo.png';

export default function LogoSpinner({ size = "w-12 h-12" }) {
    return (
        <div className="flex items-center justify-center">
            <img 
                src={logo} 
                alt="Cargando..." 
                className={`${size} animate-pulse object-contain`} 
            />
        </div>
    );
}
