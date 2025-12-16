interface LogoProps {
  className?: string;
}

export const Logo = ({ className = "" }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2 group cursor-pointer ${className}`}>
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
      >
        <defs>
          <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Quadrado arredondado */}
        <rect 
          x="2" y="2" width="28" height="28" 
          rx="6" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className="text-foreground"
        />
        
        {/* Z vazado */}
        <path 
          d="M 8 8 L 24 8 M 24 8 L 8 24 M 8 24 L 24 24" 
          fill="none"
          stroke="currentColor" 
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground"
        />
        
        {/* Ponto verde com glow */}
        <circle 
          cx="24" cy="8" r="2.5" 
          fill="#22c55e" 
          filter="url(#greenGlow)"
        />
      </svg>
      <span className="text-xl font-bold text-foreground transition-colors duration-300">
        Zuno
      </span>
      <span className="text-xl font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
        Propect
      </span>
    </div>
  );
};
