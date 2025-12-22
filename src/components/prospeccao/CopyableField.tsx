import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CopyableFieldProps {
  value: string;
  displayValue?: string;
  className?: string;
  iconClassName?: string;
  showToast?: boolean;
  children?: React.ReactNode;
}

export const CopyableField = ({ 
  value, 
  displayValue, 
  className,
  iconClassName,
  showToast = true,
  children 
}: CopyableFieldProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      
      if (showToast) {
        toast({
          title: "Copiado!",
          description: `"${displayValue || value}" copiado para a área de transferência`,
          duration: 2000,
        });
      }
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1 group", className)}>
      {children || <span>{displayValue || value}</span>}
      <button
        onClick={handleCopy}
        className={cn(
          "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted",
          copied && "opacity-100",
          iconClassName
        )}
        title="Copiar"
        type="button"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        )}
      </button>
    </span>
  );
};
