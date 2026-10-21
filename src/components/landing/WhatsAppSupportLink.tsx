import React from "react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  buildWhatsAppUrl,
  WHATSAPP_SUBSCRIPTION_HELP_MESSAGE,
} from "@/config/whatsapp";
import { trackEvent } from "@/lib/tracking";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { cn } from "@/lib/utils";

interface WhatsAppSupportLinkProps {
  message?: string;
  sourceLocation?: "pricing" | "faq" | string;
  className?: string;
  variant?: "banner" | "inline";
}

export const WhatsAppSupportLink: React.FC<WhatsAppSupportLinkProps> = ({
  message = WHATSAPP_SUBSCRIPTION_HELP_MESSAGE,
  sourceLocation = "pricing",
  className,
  variant = "banner",
}) => {
  const whatsappUrl = buildWhatsAppUrl(message);

  const handleClick = () => {
    trackEvent("whatsapp_clicked", {
      source: sourceLocation,
      type: "subscription_help",
      channel: "whatsapp",
    });
    trackMetaCustomEvent("WhatsApp_Support_Click", {
      source: sourceLocation,
      type: "subscription_help",
    });
  };

  if (variant === "inline") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 text-sm text-[#A9B8B1]", className)}>
        <span>Dúvidas ou problemas para assinar?</span>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 font-medium text-[#12D98B] hover:text-[#21E6A0] transition-colors underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12D98B]"
          aria-label="Fale no WhatsApp sobre dúvidas ou problemas para assinar"
        >
          <WhatsAppIcon className="h-4 w-4 fill-current shrink-0" />
          <span>Fale no WhatsApp</span>
        </a>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 rounded-lg border border-[#20312A] bg-[#0D1713]/80 px-5 py-3.5 text-center transition-colors hover:border-[#12D98B]/30",
        className
      )}
    >
      <span className="text-xs sm:text-sm text-[#A9B8B1]">
        Dúvidas ou problemas para assinar?
      </span>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#12D98B] hover:text-[#21E6A0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12D98B] rounded"
        aria-label="Fale no WhatsApp sobre dúvidas ou problemas para assinar"
      >
        <WhatsAppIcon className="h-4 w-4 fill-current shrink-0" />
        <span>Fale no WhatsApp</span>
      </a>
    </div>
  );
};
