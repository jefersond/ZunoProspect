export type InstagramArtworkPost = {
  id: string;
  format: "single" | "carousel";
  pillar: string | null;
  hook: string;
  caption: string;
  cta: string | null;
  slides: Array<{ title?: string; body?: string }>;
};

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 92;
const COLORS = {
  background: "#061612",
  backgroundEnd: "#0b2b22",
  panel: "#0e241e",
  foreground: "#f4f8f6",
  muted: "#a7bbb3",
  primary: "#20c58b",
  primarySoft: "#8de8c7",
  line: "rgba(141, 232, 199, 0.13)",
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const paragraphs = String(text || "").split(/\n+/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minimumSize: number,
  weight = 700
) {
  for (let size = startSize; size >= minimumSize; size -= 2) {
    context.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    const lines = wrapText(context, text, maxWidth);
    if (lines.length <= maxLines) return { lines, size };
  }
  context.font = `${weight} ${minimumSize}px Inter, Arial, sans-serif`;
  const lines = wrapText(context, text, maxWidth).slice(0, maxLines);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 4 ? last.slice(0, -3).trimEnd() + "…" : last;
  }
  return { lines, size: minimumSize };
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  size: number,
  lineHeight: number
) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, COLORS.background);
  gradient.addColorStop(1, COLORS.backgroundEnd);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = COLORS.line;
  context.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 90) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, HEIGHT);
    context.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 90) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WIDTH, y);
    context.stroke();
  }

  const glow = context.createRadialGradient(910, 140, 10, 910, 140, 430);
  glow.addColorStop(0, "rgba(32, 197, 139, 0.24)");
  glow.addColorStop(1, "rgba(32, 197, 139, 0)");
  context.fillStyle = glow;
  context.fillRect(480, 0, 600, 600);
}

function drawBrand(
  context: CanvasRenderingContext2D,
  pillar: string | null,
  page?: string
) {
  context.fillStyle = COLORS.primary;
  roundedRect(context, MARGIN, 78, 176, 50, 25);
  context.fill();
  context.fillStyle = COLORS.background;
  context.font = "800 25px Inter, Arial, sans-serif";
  context.fillText("ZUNO", MARGIN + 48, 111);

  context.fillStyle = COLORS.muted;
  context.font = "600 22px Inter, Arial, sans-serif";
  const label = String(pillar || "PROSPECÇÃO B2B").toUpperCase().slice(0, 38);
  context.fillText(label, MARGIN, 176);

  if (page) {
    context.textAlign = "right";
    context.fillStyle = COLORS.primarySoft;
    context.fillText(page, WIDTH - MARGIN, 111);
    context.textAlign = "left";
  }
}

function drawFooter(context: CanvasRenderingContext2D, hint: string) {
  context.fillStyle = COLORS.primary;
  context.fillRect(MARGIN, HEIGHT - 112, 64, 5);
  context.fillStyle = COLORS.muted;
  context.font = "500 23px Inter, Arial, sans-serif";
  context.fillText(hint, MARGIN, HEIGHT - 66);
  context.textAlign = "right";
  context.fillText("@zunopropect", WIDTH - MARGIN, HEIGHT - 66);
  context.textAlign = "left";
}

function drawCover(
  context: CanvasRenderingContext2D,
  post: InstagramArtworkPost,
  page?: string
) {
  drawBackground(context);
  drawBrand(context, post.pillar, page);

  context.fillStyle = COLORS.primary;
  context.fillRect(MARGIN, 260, 12, 370);

  const fitted = fitText(context, post.hook, WIDTH - MARGIN * 2 - 72, 7, 86, 58, 800);
  context.fillStyle = COLORS.foreground;
  context.font = `800 ${fitted.size}px Inter, Arial, sans-serif`;
  drawLines(context, fitted.lines, MARGIN + 48, 334, fitted.size, fitted.size * 1.13);

  context.fillStyle = COLORS.primarySoft;
  context.font = "600 31px Inter, Arial, sans-serif";
  context.fillText(
    post.format === "carousel" ? "Um guia prático para prospectar melhor." : "Leia a legenda e aplique hoje.",
    MARGIN,
    815
  );

  context.fillStyle = COLORS.panel;
  roundedRect(context, MARGIN, 890, WIDTH - MARGIN * 2, 180, 30);
  context.fill();
  context.fillStyle = COLORS.muted;
  context.font = "500 29px Inter, Arial, sans-serif";
  const supporting = post.format === "carousel"
    ? "Deslize para ver o passo a passo →"
    : String(post.caption || "").replace(/\s+/g, " ").slice(0, 150);
  const support = fitText(context, supporting, WIDTH - MARGIN * 2 - 70, 3, 34, 27, 500);
  context.font = `500 ${support.size}px Inter, Arial, sans-serif`;
  drawLines(context, support.lines, MARGIN + 35, 950, support.size, support.size * 1.35);

  drawFooter(context, post.format === "carousel" ? "DESLIZE PARA CONTINUAR" : "SALVE PARA CONSULTAR");
}

function drawContentSlide(
  context: CanvasRenderingContext2D,
  post: InstagramArtworkPost,
  slide: { title?: string; body?: string },
  index: number,
  total: number
) {
  drawBackground(context);
  drawBrand(context, post.pillar, `${index}/${total}`);

  context.fillStyle = COLORS.primary;
  context.font = "800 30px Inter, Arial, sans-serif";
  context.fillText(String(index).padStart(2, "0"), MARGIN, 292);

  const title = fitText(
    context,
    slide.title || "Próximo passo",
    WIDTH - MARGIN * 2,
    4,
    70,
    50,
    800
  );
  context.fillStyle = COLORS.foreground;
  context.font = `800 ${title.size}px Inter, Arial, sans-serif`;
  drawLines(context, title.lines, MARGIN, 370, title.size, title.size * 1.14);

  const titleBottom = 370 + title.lines.length * title.size * 1.14;
  context.fillStyle = COLORS.panel;
  roundedRect(context, MARGIN, titleBottom + 36, WIDTH - MARGIN * 2, 440, 34);
  context.fill();

  const body = fitText(
    context,
    slide.body || "Use este ponto como parte da sua rotina comercial.",
    WIDTH - MARGIN * 2 - 78,
    8,
    43,
    31,
    500
  );
  context.fillStyle = COLORS.muted;
  context.font = `500 ${body.size}px Inter, Arial, sans-serif`;
  drawLines(
    context,
    body.lines,
    MARGIN + 39,
    titleBottom + 116,
    body.size,
    body.size * 1.42
  );

  drawFooter(context, "ZUNO • PROSPECÇÃO COM CONTEXTO");
}

function drawCtaSlide(context: CanvasRenderingContext2D, post: InstagramArtworkPost) {
  drawBackground(context);
  drawBrand(context, post.pillar, "FINAL");

  context.fillStyle = COLORS.primary;
  roundedRect(context, MARGIN, 280, WIDTH - MARGIN * 2, 12, 6);
  context.fill();

  const title = fitText(
    context,
    post.cta || "Quer tornar sua prospecção mais prática?",
    WIDTH - MARGIN * 2,
    6,
    78,
    54,
    800
  );
  context.fillStyle = COLORS.foreground;
  context.font = `800 ${title.size}px Inter, Arial, sans-serif`;
  drawLines(context, title.lines, MARGIN, 410, title.size, title.size * 1.17);

  context.fillStyle = COLORS.primary;
  roundedRect(context, MARGIN, 840, WIDTH - MARGIN * 2, 126, 28);
  context.fill();
  context.fillStyle = COLORS.background;
  context.font = "800 32px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("CONHEÇA A ZUNO NO LINK DA BIO", WIDTH / 2, 918);
  context.textAlign = "left";

  drawFooter(context, "ENVIE PARA QUEM PRECISA PROSPECTAR");
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar a arte.")),
      "image/png",
      0.94
    );
  });
}

async function renderFrame(
  drawer: (context: CanvasRenderingContext2D) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu preparar a arte.");
  drawer(context);
  return canvasToBlob(canvas);
}

export async function renderInstagramArtwork(post: InstagramArtworkPost) {
  if ("fonts" in document) await document.fonts.ready;

  if (post.format === "single") {
    return [await renderFrame((context) => drawCover(context, post))];
  }

  const selectedSlides = (post.slides || []).slice(0, 7);
  const total = selectedSlides.length + 2;
  const blobs: Blob[] = [
    await renderFrame((context) => drawCover(context, post, `1/${total}`)),
  ];

  for (let index = 0; index < selectedSlides.length; index += 1) {
    blobs.push(
      await renderFrame((context) =>
        drawContentSlide(context, post, selectedSlides[index], index + 2, total)
      )
    );
  }

  blobs.push(await renderFrame((context) => drawCtaSlide(context, post)));
  return blobs;
}
