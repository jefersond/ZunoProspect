import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { DEPOIMENTOS } from "./data";
import { LazyImage } from "./LazyImage";
export function DepoimentosSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 3;
  const totalPages = Math.ceil(DEPOIMENTOS.length / itemsPerPage);
  const nextSlide = () => setCurrentIndex(prev => (prev + 1) % totalPages);
  const prevSlide = () => setCurrentIndex(prev => (prev - 1 + totalPages) % totalPages);
  const visibleDepoimentos = DEPOIMENTOS.slice(currentIndex * itemsPerPage, (currentIndex + 1) * itemsPerPage);
  return <section id="depoimentos" className="py-20 bg-secondary/20 dark:bg-secondary/10">
      
    </section>;
}