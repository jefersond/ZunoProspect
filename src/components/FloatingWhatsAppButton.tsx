import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/lib/tracking";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  ZUNO_OFFICIAL_WHATSAPP,
  WHATSAPP_LANDING_HELP_MESSAGE,
  WHATSAPP_APP_SUPPORT_MESSAGE,
  WHATSAPP_BUSINESS_HOURS,
  buildWhatsAppUrl,
} from "@/config/whatsapp";
import { cn } from "@/lib/utils";

interface FloatingWhatsAppButtonProps {
  message?: string;
  className?: string;
}

const isWithinBusinessHours = (): boolean => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Segunda a Sexta, 8h às 18h
  const isWeekday = day >= 1 && day <= 5;
  const isBusinessHour =
    hour >= WHATSAPP_BUSINESS_HOURS.openingHour &&
    hour < WHATSAPP_BUSINESS_HOURS.closingHour;

  return isWeekday && isBusinessHour;
};

// Rotas administrativas internas onde o botão flutuante não deve aparecer
const HIDE_WHATSAPP_PATHS = ["/admin"];

const LANDING_PATHS = ["/", "/landing", "/fundador", "/pricing", "/precos"];

export const FloatingWhatsAppButton = ({
  message,
  className,
}: FloatingWhatsAppButtonProps) => {
  const [isOnline, setIsOnline] = useState(isWithinBusinessHours());
  const location = useLocation();

  const isLanding = useMemo(() => {
    return (
      LANDING_PATHS.includes(location.pathname) ||
      location.pathname === ""
    );
  }, [location.pathname]);

  const defaultMessageForRoute = isLanding
    ? WHATSAPP_LANDING_HELP_MESSAGE
    : WHATSAPP_APP_SUPPORT_MESSAGE;

  const activeMessage = message || defaultMessageForRoute;
  const whatsappUrl = buildWhatsAppUrl(activeMessage, ZUNO_OFFICIAL_WHATSAPP);

  const handleWhatsAppClick = () => {
    trackEvent("WhatsApp_Support_Click", {
      source: isLanding ? "landing" : "app",
      path: location.pathname,
      channel: "whatsapp",
    });
    trackMetaCustomEvent("WhatsApp_Support_Click", {
      source: isLanding ? "landing" : "app",
      path: location.pathname,
    });
  };

  // Atualiza o status de atendimento a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setIsOnline(isWithinBusinessHours());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (HIDE_WHATSAPP_PATHS.some((path) => location.pathname.startsWith(path))) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsAppClick}
          className={cn(
            // No mobile: posicionado em bottom-20 right-4 para nunca cobrir a StickyCtaBar nem outros controles.
            // No desktop: sm:bottom-6 sm:right-6 com formato pill exibindo "Fale com o Zuno".
            "fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-[#128C7E] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100D]",
            // Mobile: circular discreto (48px x 48px)
            "h-12 w-12 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5",
            className
          )}
          aria-label="Fale com o Zuno no WhatsApp"
        >
          {/* Indicador de status de expediente */}
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#07100D] transition-colors",
              isOnline ? "bg-emerald-400" : "bg-zinc-400"
            )}
            title={isOnline ? "Atendimento disponível agora" : "Fora do horário comercial"}
          />

          <WhatsAppIcon className="h-6 w-6 shrink-0 fill-current text-white" />

          {/* Rótulo visível apenas no desktop */}
          <span className="hidden sm:inline-block font-semibold text-sm tracking-tight text-white whitespace-nowrap">
            Fale com o Zuno
          </span>
        </a>
      </TooltipTrigger>
      <TooltipContent side="left" className="bg-[#0D1713] text-[#F3F7F5] border border-[#20312A] shadow-xl">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"
            )}
          />
          <p className="font-medium text-xs">
            {isOnline ? "Atendimento Zuno Online" : "Atendimento Zuno Offline"}
          </p>
        </div>
        <p className="text-[11px] text-[#A9B8B1] mt-1">
          {isOnline
            ? "Fale conosco para dúvidas ou ajuda com a ferramenta."
            : "Retornaremos no próximo horário comercial."}
        </p>
        <p className="text-[10px] text-[#A9B8B1]/70 mt-1">
          Seg-Sex: 8h às 18h (Brasília)
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
