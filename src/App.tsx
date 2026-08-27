import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as UTIF from "utif";
import { PostingRecord, Platform, savePostingRecord, subscribeToPostingRecords, updatePostingStatus } from "./history";

const formats = [
  { id: "portrait", label: "Portrait", detail: "4:5", ratio: "4 / 5", width: 1080, height: 1350 },
  { id: "square", label: "Square", detail: "1:1", ratio: "1 / 1", width: 1080, height: 1080 },
  { id: "story", label: "Story", detail: "9:16", ratio: "9 / 16", width: 1080, height: 1920 },
] as const;

const defaultBorderPalette = {
  light: "#f3eee4",
  complement: "#ead8d5",
  accent: "#d9e0d6",
  dark: "#292a27",
  deepComplement: "#5f4247",
  deepAccent: "#405844",
  imageLuminance: .72,
};

type FormatId = (typeof formats)[number]["id"];
type BorderId = "white" | "warm" | "blush" | "sage" | "charcoal" | "blur";
type TextFont = "elegant" | "simple" | "handwritten";
type TextColourId = "match" | "contrast" | "complement" | "accent";
type TextPosition = "top" | "centre" | "bottom" | "custom";
type View = "prepare" | "history";
type BorderPalette = typeof defaultBorderPalette;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, x, 0]
    : segment < 2 ? [x, chroma, 0]
      : segment < 3 ? [0, chroma, x]
        : segment < 4 ? [0, x, chroma]
          : segment < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const match = l - chroma / 2;
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255; const g = green / 255; const b = blue / 255;
  const maximum = Math.max(r, g, b); const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return { hue, saturation, lightness };
}

function relativeLuminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [0, 0, 0];
  const linear = channels.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}

function createBorderPalette(image: HTMLImageElement): BorderPalette {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return defaultBorderPalette;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const bins = Array.from({ length: 18 }, () => ({ weight: 0, hueX: 0, hueY: 0, saturation: 0 }));
  let luminanceTotal = 0;
  let luminanceSamples = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    if (pixels[index + 3] < 160) continue;
    luminanceTotal += relativeLuminance(`#${[pixels[index], pixels[index + 1], pixels[index + 2]].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`);
    luminanceSamples += 1;
    const colour = rgbToHsl(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (colour.lightness > .9 && colour.saturation < .16) continue;
    if (colour.lightness < .07 || colour.saturation < .08) continue;
    const bin = bins[Math.floor(colour.hue / 20) % bins.length];
    const weight = (.2 + colour.saturation) * (.55 + (1 - Math.abs(colour.lightness - .5)));
    const radians = colour.hue * Math.PI / 180;
    bin.weight += weight;
    bin.hueX += Math.cos(radians) * weight;
    bin.hueY += Math.sin(radians) * weight;
    bin.saturation += colour.saturation * weight;
  }
  const dominant = bins.reduce((best, candidate) => candidate.weight > best.weight ? candidate : best, bins[0]);
  const imageLuminance = luminanceSamples ? luminanceTotal / luminanceSamples : defaultBorderPalette.imageLuminance;
  if (dominant.weight < 1) return { ...defaultBorderPalette, imageLuminance };
  const hue = (Math.atan2(dominant.hueY, dominant.hueX) * 180 / Math.PI + 360) % 360;
  const saturation = dominant.saturation / dominant.weight * 100;
  return {
    light: hslToHex(hue, clamp(saturation * .38, 12, 28), 92),
    complement: hslToHex(hue + 180, clamp(saturation * .48, 14, 34), 89),
    accent: hslToHex(hue + 28, clamp(saturation * .72, 20, 46), 82),
    dark: hslToHex(hue, clamp(saturation * .42, 12, 32), 22),
    deepComplement: hslToHex(hue + 180, clamp(saturation * .82, 34, 62), 30),
    deepAccent: hslToHex(hue + 28, clamp(saturation * .94, 38, 68), 31),
    imageLuminance,
  };
}

function isTiffFile(file: File) {
  return /\.tiff?$/i.test(file.name) || file.type === "image/tiff" || file.type === "image/x-tiff";
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("The image could not be prepared.")),
    type,
    quality,
  ));
}

async function decodeTiff(file: File) {
  const buffer = await file.arrayBuffer();
  const directories = UTIF.decode(buffer);
  if (!directories.length) throw new Error("This TIFF does not contain a readable image.");
  const dimension = (directory: UTIF.IFD, tag: string, property: "width" | "height") => {
    const tagged = directory[tag];
    if (Array.isArray(tagged) && tagged.length) return Number(tagged[0]);
    return Number(directory[property] || 0);
  };
  const directory = directories.reduce((largest, candidate) => {
    const candidateArea = dimension(candidate, "t256", "width") * dimension(candidate, "t257", "height");
    const largestArea = dimension(largest, "t256", "width") * dimension(largest, "t257", "height");
    return candidateArea > largestArea ? candidate : largest;
  });
  const taggedWidth = dimension(directory, "t256", "width");
  const taggedHeight = dimension(directory, "t257", "height");
  const maximumPixels = window.matchMedia("(pointer: coarse)").matches ? 24_000_000 : 45_000_000;
  if (taggedWidth * taggedHeight > maximumPixels) throw new Error("This TIFF is too large to open safely on this device. Export a JPEG copy and try again.");
  UTIF.decodeImage(buffer, directory);
  const { width, height } = directory;
  if (!width || !height) throw new Error("This TIFF does not contain a readable image.");
  const rgba = UTIF.toRGBA8(directory);
  const source = document.createElement("canvas");
  source.width = width; source.height = height;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) throw new Error("TIFF conversion is unavailable in this browser.");
  const pixelData = new Uint8ClampedArray(new ArrayBuffer(rgba.byteLength));
  pixelData.set(rgba);
  sourceContext.putImageData(new ImageData(pixelData, width, height), 0, 0);
  const maximumDimension = 3200;
  const scale = Math.min(1, maximumDimension / Math.max(width, height));
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(width * scale));
  output.height = Math.max(1, Math.round(height * scale));
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("TIFF conversion is unavailable in this browser.");
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(source, 0, 0, output.width, output.height);
  source.width = 1; source.height = 1;
  return canvasToBlob(output, "image/jpeg", .96);
}

function validateImageUrl(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("That image format could not be opened. Try JPEG, PNG, WebP or TIFF."));
    image.src = url;
  });
}

function Icon({ name }: { name: "image" | "image-up" | "history" | "lock" | "download" | "check" | "spinner" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "image") return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/></svg>;
  if (name === "image-up") return <svg {...common}><path d="M10.3 21H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v9.3"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/><circle cx="9" cy="9" r="2"/><path d="m19 22v-6M22 19l-3-3-3 3"/></svg>;
  if (name === "history") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>;
  if (name === "lock") return <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16"/></svg>;
  if (name === "spinner") return <svg {...common} className="spin"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>;
  return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
}

function safeFilename(value: string) {
  return (value.trim() || "artwork").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function getContainedRect(image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  return { x: x + (width - drawWidth) / 2, y: y + (height - drawHeight) / 2, width: drawWidth, height: drawHeight };
}

function drawContained(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const rect = getContainedRect(image, x, y, width, height);
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

function drawCovered(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { result.push(""); continue; }
    let line = words[0];
    for (const word of words.slice(1)) {
      const trial = `${line} ${word}`;
      if (ctx.measureText(trial).width <= maxWidth) line = trial;
      else { result.push(line); line = word; }
    }
    result.push(line);
  }
  return result;
}

export default function App({ userEmail, onSignOut }: { userEmail: string | null; onSignOut: () => void }) {
  const [view, setView] = useState<View>("prepare");
  const [activeFormat, setActiveFormat] = useState<FormatId>("portrait");
  const [border, setBorder] = useState<BorderId>("warm");
  const [borderPalette, setBorderPalette] = useState<BorderPalette>(defaultBorderPalette);
  const [borderSize, setBorderSize] = useState(8);
  const [saturation, setSaturation] = useState(105);
  const [overlayText, setOverlayText] = useState("");
  const [textFont, setTextFont] = useState<TextFont>("elegant");
  const [textColourId, setTextColourId] = useState<TextColourId>("match");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [textSize, setTextSize] = useState(26);
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(88);
  const [draggingText, setDraggingText] = useState(false);
  const [imageSrc, setImageSrc] = useState(`${import.meta.env.BASE_URL}sample-watercolor.png`);
  const [imageRevision, setImageRevision] = useState(0);
  const [fileName, setFileName] = useState("Summer Garden");
  const [records, setRecords] = useState<PostingRecord[]>([]);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [posted, setPosted] = useState<Record<Platform, string | null>>({ instagram: null, facebook: null });
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("Choose a photo, make your adjustments, then save or share it.");
  const [historyLoading, setHistoryLoading] = useState(true);
  const artboardRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const exportingRef = useRef(false);
  const previewFrameRef = useRef<number | null>(null);

  const selectedFormat = formats.find((format) => format.id === activeFormat) ?? formats[0];
  const borderOptions = useMemo(() => [
    { id: "white" as const, label: "White", color: "#ffffff" },
    { id: "warm" as const, label: "Light match", color: borderPalette.light },
    { id: "blush" as const, label: "Soft complement", color: borderPalette.complement },
    { id: "sage" as const, label: "Accent", color: borderPalette.accent },
    { id: "charcoal" as const, label: "Dark match", color: borderPalette.dark },
    { id: "blur" as const, label: "Blur", color: borderPalette.light },
  ], [borderPalette]);
  const selectedBorder = borderOptions.find((item) => item.id === border) ?? borderOptions[0];
  const selectedSurfaceIsDark = border === "blur"
    ? borderPalette.imageLuminance < .42
    : relativeLuminance(selectedBorder.color) < .32;
  const textColours = useMemo(() => [
    { id: "match" as const, label: selectedSurfaceIsDark ? "Light match" : "Dark match", value: selectedSurfaceIsDark ? borderPalette.light : borderPalette.dark },
    { id: "contrast" as const, label: selectedSurfaceIsDark ? "White" : "Charcoal", value: selectedSurfaceIsDark ? "#ffffff" : "#292a27" },
    { id: "complement" as const, label: "Complement", value: selectedSurfaceIsDark ? borderPalette.complement : borderPalette.deepComplement },
    { id: "accent" as const, label: "Accent", value: selectedSurfaceIsDark ? borderPalette.accent : borderPalette.deepAccent },
  ], [borderPalette, selectedSurfaceIsDark]);
  const textColour = textColours.find((colour) => colour.id === textColourId)?.value ?? textColours[0].value;
  const postedCount = Number(Boolean(posted.instagram)) + Number(Boolean(posted.facebook));
  const today = useMemo(() => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date()), []);

  useEffect(() => {
    const unsubscribe = subscribeToPostingRecords(
      (nextRecords) => { setRecords(nextRecords); setHistoryLoading(false); },
      () => { setStatus("Editing and sharing still work; posting history is temporarily unavailable."); setHistoryLoading(false); },
    );
    return () => { unsubscribe(); if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    const tiff = isTiffFile(file);
    setStatus(tiff ? "Opening TIFF locally…" : "Opening photo…");
    try {
      const workingFile = tiff ? await decodeTiff(file) : file;
      const nextUrl = URL.createObjectURL(workingFile);
      try { await validateImageUrl(nextUrl); }
      catch (error) { URL.revokeObjectURL(nextUrl); throw error; }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = nextUrl;
      setImageSrc(nextUrl);
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      setOverlayText("");
      setTextFont("elegant");
      setTextColourId("match");
      setTextPosition("bottom");
      setTextSize(26);
      setTextX(50);
      setTextY(96);
      setDraggingText(false);
      setCurrentRecordId(null);
      setPosted({ instagram: null, facebook: null });
      setStatus(tiff ? "TIFF ready. Its original file remains untouched." : "Photo ready. The artwork will stay uncropped in every format.");
      setView("prepare");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "That image could not be opened.");
    }
  }

  function resetAdjustments() {
    setBorder("warm"); setBorderSize(8); setSaturation(105); setOverlayText("");
    setTextFont("elegant"); setTextColourId("match"); setTextPosition("bottom");
    setTextSize(26); setTextX(50); setTextY(96); setStatus("Adjustments reset.");
  }

  function clampTextPosition(x: number, y: number) {
    const artboard = artboardRef.current;
    const text = overlayRef.current;
    if (!artboard || !text) return { x: Math.min(96, Math.max(4, x)), y: Math.min(96, Math.max(4, y)) };
    const bounds = artboard.getBoundingClientRect();
    const textBounds = text.getBoundingClientRect();
    const minX = Math.min(48, ((textBounds.width / 2 + 6) / bounds.width) * 100);
    const minY = Math.min(48, ((textBounds.height / 2 + 6) / bounds.height) * 100);
    return { x: Math.min(100 - minX, Math.max(minX, x)), y: Math.min(100 - minY, Math.max(minY, y)) };
  }

  function getPresetTextY(position: Exclude<TextPosition, "custom">) {
    if (position === "centre") return 50;
    const image = artworkRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return position === "top" ? 4 : 96;
    const inset = Math.round(Math.min(selectedFormat.width, selectedFormat.height) * (borderSize / 100));
    const artwork = getContainedRect(image, inset, inset, selectedFormat.width - inset * 2, selectedFormat.height - inset * 2);
    const emptySpaceCentre = position === "top"
      ? artwork.y / 2
      : (artwork.y + artwork.height + selectedFormat.height) / 2;
    return (emptySpaceCentre / selectedFormat.height) * 100;
  }

  function chooseTextPosition(position: Exclude<TextPosition, "custom">) {
    const safe = clampTextPosition(50, getPresetTextY(position));
    setTextPosition(position); setTextX(safe.x); setTextY(safe.y);
  }

  function chooseFineTextPosition(x: number, y: number) {
    const safe = clampTextPosition(x, y);
    setTextX(safe.x); setTextY(safe.y); setTextPosition("custom");
  }

  function updateTextFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const artboard = artboardRef.current;
    if (!artboard) return;
    const bounds = artboard.getBoundingClientRect();
    chooseFineTextPosition(((event.clientX - bounds.left) / bounds.width) * 100, ((event.clientY - bounds.top) / bounds.height) * 100);
  }

  function beginTextDrag(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDraggingText(true); updateTextFromPointer(event);
  }

  function continueTextDrag(event: ReactPointerEvent<HTMLDivElement>) { if (draggingText) updateTextFromPointer(event); }
  function endTextDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDraggingText(false);
  }

  useEffect(() => {
    if (textPosition === "custom") return;
    const safe = clampTextPosition(50, getPresetTextY(textPosition));
    setTextX(safe.x); setTextY(safe.y);
  }, [activeFormat, borderSize, imageRevision, overlayText, textFont, textPosition, textSize]);

  const drawFinishedCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const image = artworkRef.current;
    if (!image) throw new Error("No image selected");
    if (!image.complete || !image.naturalWidth) throw new Error("Image is still loading");
    canvas.width = selectedFormat.width; canvas.height = selectedFormat.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image export is unavailable");
    ctx.fillStyle = selectedBorder.color; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (border === "blur") {
      ctx.save(); ctx.filter = "blur(38px) saturate(80%)"; ctx.globalAlpha = .74;
      drawCovered(ctx, image, canvas.width, canvas.height); ctx.restore();
    }
    const inset = Math.round(Math.min(canvas.width, canvas.height) * (borderSize / 100));
    ctx.save(); ctx.filter = `saturate(${saturation}%)`;
    drawContained(ctx, image, inset, inset, canvas.width - inset * 2, canvas.height - inset * 2); ctx.restore();
    if (overlayText.trim()) {
      const artboardBounds = artboardRef.current?.getBoundingClientRect();
      const computedText = overlayRef.current ? getComputedStyle(overlayRef.current) : null;
      const previewScale = artboardBounds ? canvas.width / artboardBounds.width : canvas.width / 420;
      const previewFontSize = computedText ? Number.parseFloat(computedText.fontSize) : textSize;
      const exportFontSize = previewFontSize * previewScale;
      const family = computedText?.fontFamily ?? "serif";
      const weight = computedText?.fontWeight ?? "400";
      const style = computedText?.fontStyle ?? "normal";
      const exportX = canvas.width * (textX / 100);
      const exportY = canvas.height * (textY / 100);
      ctx.font = `${style} ${weight} ${exportFontSize}px ${family}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = textColour;
      ctx.shadowColor = textColour === "#ffffff" ? "rgba(0,0,0,.48)" : "rgba(255,255,255,.85)";
      ctx.shadowBlur = Math.max(3, exportFontSize * .08); ctx.shadowOffsetY = Math.max(1, exportFontSize * .02);
      const lines = wrapLines(ctx, overlayText.trim(), canvas.width * .84);
      const lineHeight = exportFontSize * 1.12; const startY = exportY - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => ctx.fillText(line, exportX, startY + index * lineHeight));
    }
  }, [border, borderSize, overlayText, saturation, selectedBorder.color, selectedFormat.height, selectedFormat.width, textColour, textSize, textX, textY]);

  const schedulePreviewRender = useCallback(() => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      const canvas = previewCanvasRef.current;
      const image = artworkRef.current;
      if (!canvas || !image?.complete || !image.naturalWidth) return;
      try { drawFinishedCanvas(canvas); }
      catch { setStatus("The preview could not be updated."); }
    });
  }, [drawFinishedCanvas]);

  useEffect(() => {
    schedulePreviewRender();
    void document.fonts.ready.then(schedulePreviewRender);
    return () => {
      if (previewFrameRef.current !== null) {
        cancelAnimationFrame(previewFrameRef.current);
        previewFrameRef.current = null;
      }
    };
  }, [imageRevision, imageSrc, schedulePreviewRender, textFont]);

  useEffect(() => {
    const artboard = artboardRef.current;
    if (!artboard) return;
    const observer = new ResizeObserver(schedulePreviewRender);
    observer.observe(artboard);
    return () => observer.disconnect();
  }, [schedulePreviewRender]);

  async function renderFinishedImage() {
    const image = artworkRef.current;
    if (!image) throw new Error("No image selected");
    if (!image.complete || !image.naturalWidth) {
      await new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => reject(new Error("Image could not be loaded")), { once: true });
      });
    }
    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    drawFinishedCanvas(canvas);
    return canvasToBlob(canvas, "image/jpeg", .95);
  }

  async function makeThumbnail(blob: Blob) {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 260 / bitmap.width);
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    return canvas.toDataURL("image/jpeg", .72);
  }

  async function saveRecord(blob: Blob) {
    const id = currentRecordId ?? crypto.randomUUID();
    const thumbnail = await makeThumbnail(blob);
    const record = await savePostingRecord({ id, title: fileName.trim() || "Untitled artwork", format: selectedFormat.detail, createdAt: new Date().toISOString(), thumbnailUrl: thumbnail, instagramAt: posted.instagram, facebookAt: posted.facebook });
    setCurrentRecordId(id);
    setRecords((current) => [record, ...current.filter((item) => item.id !== id)]);
    return record;
  }

  async function saveAndShare() {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true); setStatus("Creating the finished image…");
    try {
      const blob = await renderFinishedImage();
      let historySaved = true;
      try { await saveRecord(blob); } catch { historySaved = false; }
      const file = new File([blob], `${safeFilename(fileName)}-${activeFormat}.jpg`, { type: "image/jpeg" });
      const shareData = { files: [file], title: fileName };
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      if (isTouchDevice && navigator.share && navigator.canShare?.(shareData)) {
        try { await navigator.share(shareData); setStatus(historySaved ? "Finished image shared. Its posting record is ready below." : "Finished image shared. Posting history is temporarily unavailable."); }
        catch (error) { if (error instanceof DOMException && error.name === "AbortError") setStatus(historySaved ? "Sharing cancelled. The finished image remains in History." : "Sharing cancelled."); else throw error; }
      } else {
        const url = URL.createObjectURL(blob); const link = document.createElement("a");
        link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus(historySaved ? "Finished image downloaded. Its posting record is ready below." : "Finished image downloaded. Posting history is temporarily unavailable.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The image could not be saved");
    } finally { exportingRef.current = false; setExporting(false); }
  }

  async function togglePosted(platform: Platform) {
    if (!currentRecordId) { setStatus("Use Save & share first, then mark where the image was posted."); return; }
    const postedAt = posted[platform] ? null : new Date().toISOString();
    setPosted((current) => ({ ...current, [platform]: postedAt }));
    try {
      await updatePostingStatus(currentRecordId, platform, postedAt);
      const field = platform === "instagram" ? "instagramAt" : "facebookAt";
      setRecords((current) => current.map((record) => record.id === currentRecordId ? { ...record, [field]: postedAt } : record));
      setStatus(postedAt ? `Marked as posted to ${platform === "instagram" ? "Instagram" : "Facebook"}.` : `Removed the ${platform === "instagram" ? "Instagram" : "Facebook"} posting mark.`);
    } catch {
      setPosted((current) => ({ ...current, [platform]: posted[platform] })); setStatus("The posting mark could not be updated.");
    }
  }

  function newPhotoButton() {
    return <label className="new-photo button"><Icon name="image-up" /> New photo<input type="file" accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,image/jpeg,image/png,image/webp,image/tiff" onChange={chooseImage} /></label>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="image-up" /></span><div><h1>Posting Art</h1><p>Simple, polished social images</p></div></div>
        <nav className="view-tabs" aria-label="App views">
          <button className={view === "prepare" ? "active" : ""} onClick={() => setView("prepare")}><Icon name="image" /> Prepare</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><Icon name="history" /> History <span className="count">{records.length}</span></button>
        </nav>
        <div className="topbar-actions">{newPhotoButton()}<button className="sign-out" onClick={onSignOut} title={userEmail ? `Signed in as ${userEmail}` : "Sign out"}>Sign out</button></div>
      </header>

      {view === "history" ? (
        <section className="history-view">
          <div className="history-heading"><div><p className="eyebrow">Posting history</p><h2>Prepared artwork</h2></div><button onClick={() => setView("prepare")} className="back-prepare">Back to Prepare</button></div>
          {historyLoading ? <div className="history-empty"><Icon name="spinner" /><h3>Loading history…</h3></div> : records.length ? (
            <div className="history-grid">{records.map((record) => (
              <article className="history-item" key={record.id}>
                <div className="history-thumb"><img src={record.thumbnailUrl} alt={`Prepared ${record.title}`} /></div>
                <div className="history-copy"><h3>{record.title}</h3><p>{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(record.createdAt))} · {record.format}</p>
                  <div className="history-badges"><span className={record.instagramAt ? "done" : ""}>Instagram</span><span className={record.facebookAt ? "done" : ""}>Facebook</span></div>
                </div>
              </article>
            ))}</div>
          ) : <div className="history-empty"><Icon name="history" /><h3>No prepared images yet</h3><p>Your first saved image will appear here.</p><button onClick={() => setView("prepare")}>Prepare a photo</button></div>}
        </section>
      ) : (<>
        <section className="workspace">
          <aside className="controls" aria-label="Photo controls">
            <div className="controls-heading"><div><p className="eyebrow">Editing</p><input className="artwork-title" aria-label="Artwork title" value={fileName} onChange={(event) => setFileName(event.target.value)} /></div><button className="reset" onClick={resetAdjustments}>Reset</button></div>
            <div className="control-group"><div className="label-row"><label>Social format</label><span className="locked"><Icon name="lock" /> Art stays uncropped</span></div>
              <div className="format-grid">{formats.map((format) => <button key={format.id} onClick={() => setActiveFormat(format.id)} className={activeFormat === format.id ? "selected" : ""}><span className={`format-icon ${format.id}`} /><strong>{format.label}</strong><small>{format.detail}</small></button>)}</div>
            </div>
            <div className="control-group"><div className="label-row"><label>Border</label><span>{borderSize}%</span></div>
              <div className="swatches">{borderOptions.map((option) => <button key={option.id} title={option.label} aria-label={`${option.label} border`} onClick={() => setBorder(option.id)} className={`${border === option.id ? "selected" : ""} ${option.id === "blur" ? "blur-swatch" : ""} ${option.id === "charcoal" ? "dark-swatch" : ""}`} style={{ background: option.color }}>{border === option.id && <Icon name="check" />}</button>)}</div>
              <input aria-label="Border size" type="range" min="0" max="18" value={borderSize} onChange={(event) => setBorderSize(Number(event.target.value))} />
            </div>
            <div className="control-group"><div className="label-row"><label htmlFor="saturation">Saturation</label><span>{saturation}%</span></div><input id="saturation" type="range" min="70" max="140" value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} /><div className="range-labels"><span>Softer</span><span>Natural</span><span>Richer</span></div></div>
            <div className="control-group text-control"><label htmlFor="text-overlay">Text <span>Optional</span></label><input id="text-overlay" value={overlayText} onChange={(event) => setOverlayText(event.target.value)} placeholder="Add a title or short note" />
              <div className="text-section-label">Font</div><div className="text-options font-options" aria-label="Text font">{(["elegant", "simple", "handwritten"] as const).map((font) => <button key={font} onClick={() => setTextFont(font)} className={`${font} ${textFont === font ? "selected" : ""}`} aria-pressed={textFont === font}>{font[0].toUpperCase() + font.slice(1)}</button>)}</div>
              <div className="text-size-control"><div className="label-row"><label htmlFor="text-size">Size</label><span>{textSize}px</span></div><input id="text-size" type="range" min="14" max="44" value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} /><div className="range-labels"><span>Smaller</span><span>Larger</span></div></div>
              <div className="text-detail-row"><div><div className="text-section-label">Colour</div><div className="text-colours" aria-label="Text colour">{textColours.map((colour) => <button key={colour.id} aria-label={`${colour.label} text`} title={colour.label} onClick={() => setTextColourId(colour.id)} className={textColourId === colour.id ? "selected" : ""} style={{ backgroundColor: colour.value, color: relativeLuminance(colour.value) > .48 ? "#343630" : "#ffffff" }}>{textColourId === colour.id && <Icon name="check" />}</button>)}</div></div>
                <div><div className="text-section-label">Position</div><div className="position-options" aria-label="Text position">{(["top", "centre", "bottom"] as const).map((position) => <button key={position} onClick={() => chooseTextPosition(position)} className={textPosition === position ? "selected" : ""} aria-label={`${position} position`} aria-pressed={textPosition === position}><span className={`position-icon ${position}`} /></button>)}</div></div></div>
              <div className="fine-position"><div className="label-row"><label htmlFor="text-horizontal">Left / right</label><span>{Math.round(textX)}%</span></div><input id="text-horizontal" type="range" min="4" max="96" value={textX} onChange={(event) => chooseFineTextPosition(Number(event.target.value), textY)} /><div className="label-row vertical-label"><label htmlFor="text-vertical">Up / down</label><span>{Math.round(textY)}%</span></div><input id="text-vertical" type="range" min="4" max="96" value={textY} onChange={(event) => chooseFineTextPosition(textX, Number(event.target.value))} /><p className="drag-hint">Or drag the text directly on the preview</p></div>
            </div>
          </aside>

          <section className="preview-area"><div className="preview-header"><div><p className="eyebrow">Preview</p><h2>{selectedFormat.label} · {selectedFormat.detail}</h2></div><span>Original artwork proportions</span></div>
            <div className={`artboard-wrap ${activeFormat}`}><div ref={artboardRef} className="artboard" style={{ aspectRatio: selectedFormat.ratio }}>
              <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Selected artwork preview" />
              <img ref={artworkRef} className="source-artwork" src={imageSrc} alt="" onLoad={(event) => { setBorderPalette(createBorderPalette(event.currentTarget)); setImageRevision((revision) => revision + 1); }} />
              {overlayText && <div ref={overlayRef} aria-hidden="true" className={`overlay-text text-drag-target ${textFont} ${draggingText ? "dragging" : ""}`} style={{ fontSize: `${textSize}px`, left: `${textX}%`, top: `${textY}%` }} onPointerDown={beginTextDrag} onPointerMove={continueTextDrag} onPointerUp={endTextDrag} onPointerCancel={endTextDrag} title="Drag to reposition text">{overlayText}</div>}
            </div></div>
            <div className="preview-footer"><div className="quality-note"><span className="quality-dot" /><span>{status}</span></div><button className="save-button" onClick={saveAndShare} disabled={exporting}><Icon name={exporting ? "spinner" : "download"} /> {exporting ? "Creating…" : "Save & share"}</button></div>
          </section>
        </section>
        <section className="posting-card"><div className="posting-info"><div className="mini-thumb"><img src={imageSrc} alt="" /></div><div><p className="eyebrow">Posting record</p><h2>{fileName || "Untitled artwork"}</h2><span>{currentRecordId ? (postedCount ? `Posted to ${postedCount} ${postedCount === 1 ? "place" : "places"}` : "Saved · not posted yet") : "Created when you save or share"}</span></div></div>
          <div className="platforms">{(["instagram", "facebook"] as const).map((platform) => <button key={platform} className={posted[platform] ? "posted" : ""} onClick={() => togglePosted(platform)} aria-pressed={Boolean(posted[platform])}><span className={`platform-icon ${platform}`}>{platform === "instagram" ? "◎" : "f"}</span><span><strong>{platform[0].toUpperCase() + platform.slice(1)}</strong><small>{posted[platform] ? `Posted ${today}` : "Mark as posted"}</small></span><span className="status-check">{posted[platform] ? <Icon name="check" /> : ""}</span></button>)}</div>
        </section>
      </>)}
      <p className="version">Posting Art · v1.2.1</p>
    </main>
  );
}
