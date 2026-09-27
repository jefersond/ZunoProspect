export type SocialProofItem = {
  quote: string;
  name: string;
  context?: string;
};

export function SocialProofSection({ items }: { items: SocialProofItem[] }) {
  if (!items.length) return null;

  return (
    <section className="border-b border-[#20312A]/40 bg-[#07100D] py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {items.map((item) => (
            <figure key={`${item.name}-${item.quote}`} className="rounded-xl border border-[#20312A] bg-[#0D1713] p-5">
              <blockquote className="text-sm leading-relaxed text-[#A9B8B1]">“{item.quote}”</blockquote>
              <figcaption className="mt-4 text-xs text-[#A9B8B1]">
                <span className="font-semibold text-[#F3F7F5]">{item.name}</span>
                {item.context ? ` · ${item.context}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
