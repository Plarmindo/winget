import React from 'react';

const AppLogo = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" />
    <path d="M3 7L12 12L21 7" />
    <path d="M12 22V12" />
    <path d="M7.5 14.5L12 17L16.5 14.5" strokeOpacity="0.5" />
    <path d="M12 2V12" strokeOpacity="0" /> 
  </svg>
);

export default AppLogo;
