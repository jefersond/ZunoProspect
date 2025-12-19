import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { LazyImage } from "./LazyImage";

interface FeatureSectionProps {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  reversed?: boolean;
  bullets?: string[];
  ctaText?: string;
  ctaAction?: () => void;
}

export function FeatureSection({
  title,
  description,
  image,
  imageAlt,
  reversed = false,
  bullets = [],
  ctaText,
  ctaAction
}: FeatureSectionProps) {
  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className={`grid lg:grid-cols-2 gap-12 items-center ${reversed ? "lg:flex-row-reverse" : ""}`}>
          {/* Image */}
          <div className={`${reversed ? "lg:order-2" : "lg:order-1"}`}>
            <div className="relative overflow-hidden rounded-xl border border-border/50 shadow-xl bg-card">
              <LazyImage
                src={image}
                alt={imageAlt}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Content */}
          <div className={`space-y-6 ${reversed ? "lg:order-1" : "lg:order-2"}`}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
              {title}
            </h2>
            <p className="text-lg text-muted-foreground">
              {description}
            </p>

            {bullets.length > 0 && (
              <ul className="space-y-3">
                {bullets.map((bullet, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {ctaText && ctaAction && (
              <Button 
                size="lg" 
                variant="success" 
                onClick={ctaAction}
                className="mt-4"
              >
                {ctaText}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
