import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export type CreativePreviewPost = {
  id: string;
  hook: string;
  alt_text: string | null;
  media_url: string | null;
  media_urls: string[];
  agent_trace?: Record<string, unknown>;
};

type ReviewNotes = Record<string, string>;

function getPostMedia(post: CreativePreviewPost) {
  const media = post.media_urls?.length
    ? post.media_urls
    : post.media_url
      ? [post.media_url]
      : [];

  return [...new Set(media.filter(Boolean))];
}

function getReviewNotes(post: CreativePreviewPost | null): ReviewNotes {
  const creativeReview = post?.agent_trace?.creative_review;
  if (!creativeReview || typeof creativeReview !== "object") return {};
  const notes = (creativeReview as { notes?: unknown }).notes;
  return notes && typeof notes === "object" ? notes as ReviewNotes : {};
}

export function CreativeThumbnail({ post, className, imageClassName, onOpen }: {
  post: CreativePreviewPost;
  className?: string;
  imageClassName: string;
  onOpen: () => void;
}) {
  const media = getPostMedia(post);
  const preview = media[0];
  const issueCount = Object.values(getReviewNotes(post)).filter((note) => note.trim()).length;
  if (!preview) return null;

  return (
    <button type="button" className={`group relative block w-full overflow-hidden text-left ${className || ""}`} onClick={onOpen} aria-label={`Abrir criativo de ${post.hook}`}>
      <img src={preview} alt={post.alt_text || post.hook} className={`${imageClassName} transition duration-200 group-hover:scale-[1.02] group-hover:brightness-75`} />
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm font-medium text-white shadow-lg">
          <Maximize2 className="h-4 w-4" /> Ver criativo
        </span>
      </span>
      {media.length > 1 && <Badge className="absolute right-3 top-3 bg-black/75 text-white hover:bg-black/75">1/{media.length}</Badge>}
      {issueCount > 0 && (
        <Badge className="absolute left-3 top-3 gap-1 bg-red-600 text-white hover:bg-red-600">
          <AlertCircle className="h-3 w-3" /> {issueCount} ajuste{issueCount > 1 ? "s" : ""}
        </Badge>
      )}
    </button>
  );
}

const quickIssues = [
  "Texto sobreposto",
  "Texto cortado",
  "Erro de portugues",
  "Alinhamento incorreto",
  "Imagem com baixa qualidade",
];

export function CreativePreviewDialog({ post, onClose, onSaveReview }: {
  post: CreativePreviewPost | null;
  onClose: () => void;
  onSaveReview: (postId: string, slideIndex: number, note: string) => Promise<void>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const media = post ? getPostMedia(post) : [];
  const reviewNotes = getReviewNotes(post);
  const savedNote = reviewNotes[String(activeIndex)] || "";

  useEffect(() => {
    setActiveIndex(0);
    setZoom(1);
  }, [post?.id]);

  useEffect(() => {
    setNote(savedNote);
  }, [post?.id, activeIndex, savedNote]);

  useEffect(() => {
    if (!post || media.length < 2) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + media.length) % media.length);
        setZoom(1);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % media.length);
        setZoom(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [post, media.length]);

  const changeSlide = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + media.length) % media.length);
    setZoom(1);
  };

  const addQuickIssue = (issue: string) => {
    setNote((current) => current.includes(issue) ? current : [current.trim(), issue].filter(Boolean).join("; "));
  };

  const saveReview = async () => {
    if (!post) return;
    setSaving(true);
    try {
      await onSaveReview(post.id, activeIndex, note.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(post)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[95vh] w-[96vw] max-w-[1400px] flex-col gap-3 overflow-hidden border-white/10 bg-zinc-950 p-3 sm:rounded-2xl sm:p-5">
        <DialogHeader className="shrink-0 pr-10 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="line-clamp-1 text-base sm:text-lg">{post?.hook || "Visualizar criativo"}</DialogTitle>
            {media.length > 1 && <Badge variant="secondary">Carrossel &middot; {activeIndex + 1}/{media.length}</Badge>}
          </div>
          <DialogDescription>Veja todos os slides, use o zoom e indique o slide exato que precisa de ajuste.</DialogDescription>
        </DialogHeader>

        {post && media.length > 0 && (
          <>
            <div className="relative min-h-[240px] flex-1 overflow-auto rounded-xl bg-black/60">
              <div className="flex min-h-full min-w-full items-center justify-center p-2 sm:p-4">
                <img src={media[activeIndex]} alt={`${post.alt_text || post.hook}${media.length > 1 ? ` - slide ${activeIndex + 1}` : ""}`} className="max-h-full max-w-full select-none object-contain transition-transform duration-200" style={{ transform: `scale(${zoom})` }} />
              </div>
              {media.length > 1 && (
                <>
                  <Button type="button" size="icon" variant="secondary" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-lg sm:left-4" onClick={() => changeSlide(-1)} aria-label="Criativo anterior"><ChevronLeft className="h-5 w-5" /></Button>
                  <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-lg sm:right-4" onClick={() => changeSlide(1)} aria-label="Proximo criativo"><ChevronRight className="h-5 w-5" /></Button>
                </>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {media.length > 1 ? (
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {media.map((url, index) => {
                    const hasIssue = Boolean(reviewNotes[String(index)]?.trim());
                    return (
                      <button type="button" key={`${url}-${index}`} onClick={() => { setActiveIndex(index); setZoom(1); }} className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${activeIndex === index ? "border-emerald-400" : hasIssue ? "border-red-500" : "border-transparent opacity-60 hover:opacity-100"}`} aria-label={`Abrir slide ${index + 1}`}>
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        {hasIssue && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-black" />}
                      </button>
                    );
                  })}
                </div>
              ) : <span />}
              <div className="flex items-center justify-center gap-1 rounded-lg border bg-background/80 p-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((current) => Math.max(1, current - 0.25))} disabled={zoom === 1} aria-label="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Button>
                <button type="button" onClick={() => setZoom(1)} className="min-w-14 px-1 text-center text-xs font-medium" title="Restaurar zoom">{Math.round(zoom * 100)}%</button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((current) => Math.min(3, current + 0.25))} disabled={zoom === 3} aria-label="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className={`shrink-0 rounded-xl border p-3 ${savedNote ? "border-red-500/40 bg-red-500/5" : "bg-background/50"}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className={`h-4 w-4 ${savedNote ? "text-red-400" : "text-muted-foreground"}`} />
                  Apontar erro no slide {activeIndex + 1}
                </div>
                {savedNote && <Badge variant="destructive">Ajuste pendente</Badge>}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickIssues.map((issue) => (
                  <Button key={issue} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addQuickIssue(issue)}>{issue}</Button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="min-h-16 resize-none" placeholder="Ex.: a segunda frase ficou em cima da primeira; reduzir o texto e aumentar o espacamento." />
                <Button type="button" className="shrink-0" onClick={saveReview} disabled={saving || note.trim() === savedNote.trim()}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {note.trim() ? "Salvar apontamento" : "Remover apontamento"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
