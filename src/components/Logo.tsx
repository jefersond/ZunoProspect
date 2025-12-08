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
        className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 scale-x-[-1]"
      >
        <defs>
          <linearGradient id="zGradientGraphite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.70 0 0)" />
            <stop offset="50%" stopColor="oklch(0.50 0 0)" />
            <stop offset="100%" stopColor="oklch(0.35 0 0)" />
          </linearGradient>
        </defs>
        <path 
          d="M 8 6 L 24 6 L 24 10 L 16 10 L 24 22 L 24 26 L 8 26 L 8 22 L 16 22 L 8 10 L 8 6 Z" 
          fill="url(#zGradientGraphite)" 
          className="transition-all duration-500" 
        />
      </svg>
      <span className="text-xl font-bold text-foreground transition-colors duration-300">
        Zuno
      </span>
      <span className="text-xl font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
        Prospect
      </span>
    </div>
  );
};
