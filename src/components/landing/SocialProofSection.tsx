export type SocialProofItem = {
  quote: string;
  name: string;
  context?: string;
};

export function SocialProofSection({ items }: { items: SocialProofItem[] }) {
  if (!items.length) return null;

  return (
    <section className="border-b border-[#1f2d29]/40 bg-[#0b0f0e] py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {items.map((item) => (
            <figure key={`${item.name}-${item.quote}`} className="rounded-xl border border-[#1f2d29] bg-[#111816] p-5">
              <blockquote className="text-sm leading-relaxed text-[#d1d5db]">“{item.quote}”</blockquote>
              <figcaption className="mt-4 text-xs text-[#9ca3af]">
                <span className="font-semibold text-[#f4f4f5]">{item.name}</span>
                {item.context ? ` · ${item.context}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
