import { Globe, Sparkles, MapPin, MessageCircle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getKiwifyCheckoutUrl } from "@/config/kiwifyLinks";

interface UsaAddonUpsellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string;
  userName?: string;
}

export function UsaAddonUpsell({ 
  open, 
  onOpenChange, 
  userEmail, 
  userName 
}: UsaAddonUpsellProps) {
  const handleActivate = () => {
    const checkoutUrl = getKiwifyCheckoutUrl("usa_addon", false, userEmail, userName);
    window.open(checkoutUrl, "_blank");
    onOpenChange(false);
  };

  const benefits = [
    "Access to all 50 US states + DC",
    "Detailed analysis in Portuguese",
    "Prospecting plan and CTA in English",
    "Easy to send messages to American leads",
    "Same powerful AI analysis",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              Unlock USA Prospecting 🇺🇸
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Expand your reach to the American market with our USA prospecting add-on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span>Just +R$ 57/month</span>
          </div>

          <ul className="space-y-2">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Search leads in cities like Miami, New York, Los Angeles, and more!
            </span>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Messages ready in English for direct outreach
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleActivate} className="w-full" size="lg">
            <Globe className="mr-2 h-4 w-4" />
            Activate USA Prospecting
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
