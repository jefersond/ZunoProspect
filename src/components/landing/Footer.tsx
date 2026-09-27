import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-[#20312A] bg-[#07100D] py-6 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
          <Logo className="[&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-6 sm:[&_svg]:h-6 [&_span:first-of-type]:text-base sm:[&_span:first-of-type]:text-lg [&_span:last-of-type]:text-base sm:[&_span:last-of-type]:text-lg" />
          <p className="text-center text-xs text-[#A9B8B1] sm:text-sm">
            © {new Date().getFullYear()} Zuno Propect. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
