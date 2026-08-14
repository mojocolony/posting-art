"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const formats = [
  { id: "portrait", label: "Portrait", detail: "4:5", ratio: "4 / 5", width: 1080, height: 1350 },
  { id: "square", label: "Square", detail: "1:1", ratio: "1 / 1", width: 1080, height: 1080 },
  { id: "story", label: "Story", detail: "9:16", ratio: "9 / 16", width: 1080, height: 1920 },
] as const;

const borderOptions = [
  { id: "white", label: "White", color: "#ffffff" },
  { id: "warm", label: "Warm", color: "#f3eee4" },
  { id: "blush", label: "Blush", color: "#ead8d5" },
  { id: "sage", label: "Sage", color: "#d9e0d6" },
  { id: "charcoal", label: "Dark", color: "#292a27" },
  { id: "blur", label: "Blur", color: "#f3eee4" },
] as const;

const textColours = [
  { id: "charcoal", label: "Charcoal", value: "#292a27" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "coral", label: "Coral", value: "#a84f49" },
  { id: "sage", label: "Sage", value: "#526851" },
] as const;

type FormatId = (typeof formats)[number]["id"];
type BorderId = (typeof borderOptions)[number]["id"];
type TextFont = "elegant" | "simple" | "handwritten";
type TextPosition = "top" | "centre" | "bottom" | "custom";
type Platform = "instagram" | "facebook";
type View = "prepare" | "history";

type PostingRecord = {
  id: string;
  title: string;
  format: string;
  createdAt: string;
  thumbnailKey: string;
  thumbnailUrl: string;
  instagramAt: string | null;
  facebookAt: string | null;
};

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

function drawContained(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
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

export default function Home() {
  const [view, setView] = useState<View>("prepare");
  const [activeFormat, setActiveFormat] = useState<FormatId>("portrait");
  const [border, setBorder] = useState<BorderId>("warm");
  const [borderSize, setBorderSize] = useState(8);
  const [saturation, setSaturation] = useState(105);
  const [overlayText, setOverlayText] = useState("");
  const [textFont, setTextFont] = useState<TextFont>("elegant");
  const [textColour, setTextColour] = useState("#292a27");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [textSize, setTextSize] = useState(26);
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(88);
  const [draggingText, setDraggingText] = useState(false);
  const [imageSrc, setImageSrc] = useState("/sample-watercolor.png");
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

  const selectedFormat = formats.find((format) => format.id === activeFormat) ?? formats[0];
  const selectedBorder = borderOptions.find((item) => item.id === border) ?? borderOptions[0];
  const postedCount = Number(Boolean(posted.instagram)) + Number(Boolean(posted.facebook));
  const today = useMemo(() => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date()), []);

  useEffect(() => {
    fetch("/api/history")
      .then(async (response) => {
        if (!response.ok) throw new Error("History is temporarily unavailable");
        return response.json() as Promise<{ records: PostingRecord[] }>;
      })
      .then((data) => setRecords(data.records))
      .catch(() => setStatus("Editing and sharing still work; posting history is temporarily unavailable."))
      .finally(() => setHistoryLoading(false));
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setImageSrc(objectUrlRef.current);
    setFileName(file.name.replace(/\.[^.]+$/, ""));
    setOverlayText("");
    setTextFont("elegant");
    setTextColour("#292a27");
    setTextPosition("bottom");
    setTextSize(26);
    setTextX(50);
    setTextY(88);
    setDraggingText(false);
    setCurrentRecordId(null);
    setPosted({ instagram: null, facebook: null });
    setStatus("Photo ready. The artwork will stay uncropped in every format.");
    setView("prepare");
    event.target.value = "";
  }

  function resetAdjustments() {
    setBorder("warm"); setBorderSize(8); setSaturation(105); setOverlayText("");
    setTextFont("elegant"); setTextColour("#292a27"); setTextPosition("bottom");
    setTextSize(26); setTextX(50); setTextY(88); setStatus("Adjustments reset.");
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

  function chooseTextPosition(position: Exclude<TextPosition, "custom">) {
    const safe = clampTextPosition(50, position === "top" ? 12 : position === "centre" ? 50 : 88);
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

  const drawFinishedCanvas = useCallback(async (canvas: HTMLCanvasElement) => {
    const image = artworkRef.current;
    if (!image) throw new Error("No image selected");
    if (!image.complete || !image.naturalWidth) {
      await new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => reject(new Error("Image could not be loaded")), { once: true });
      });
    }
    await document.fonts.ready;
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

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    void drawFinishedCanvas(canvas).catch(() => setStatus("The preview could not be updated."));
  }, [drawFinishedCanvas, imageRevision, imageSrc, textFont]);

  useEffect(() => {
    const artboard = artboardRef.current;
    const canvas = previewCanvasRef.current;
    if (!artboard || !canvas) return;
    const observer = new ResizeObserver(() => { void drawFinishedCanvas(canvas); });
    observer.observe(artboard);
    return () => observer.disconnect();
  }, [drawFinishedCanvas, imageRevision, imageSrc, textFont]);

  async function renderFinishedImage() {
    const canvas = previewCanvasRef.current;
    if (!canvas) throw new Error("Image export is unavailable");
    await drawFinishedCanvas(canvas);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image could not be created")), "image/jpeg", .95));
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
    const response = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title: fileName, format: selectedFormat.detail, createdAt: new Date().toISOString(), thumbnail }) });
    if (!response.ok) throw new Error("Posting history could not be updated");
    const data = await response.json() as { record: PostingRecord };
    setCurrentRecordId(id);
    setRecords((current) => [data.record, ...current.filter((record) => record.id !== id)]);
    return data.record;
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
      const response = await fetch("/api/history", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentRecordId, platform, postedAt }) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { record: PostingRecord };
      setRecords((current) => current.map((record) => record.id === data.record.id ? data.record : record));
      setStatus(postedAt ? `Marked as posted to ${platform === "instagram" ? "Instagram" : "Facebook"}.` : `Removed the ${platform === "instagram" ? "Instagram" : "Facebook"} posting mark.`);
    } catch {
      setPosted((current) => ({ ...current, [platform]: posted[platform] })); setStatus("The posting mark could not be updated.");
    }
  }

  function newPhotoButton() {
    return <label className="new-photo button"><Icon name="image-up" /> New photo<input type="file" accept="image/*" onChange={chooseImage} /></label>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="image-up" /></span><div><h1>Posting Art</h1><p>Simple, polished social images</p></div></div>
        <nav className="view-tabs" aria-label="App views">
          <button className={view === "prepare" ? "active" : ""} onClick={() => setView("prepare")}><Icon name="image" /> Prepare</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><Icon name="history" /> History <span className="count">{records.length}</span></button>
        </nav>
        {newPhotoButton()}
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
              <div className="swatches">{borderOptions.map((option) => <button key={option.id} title={option.label} aria-label={`${option.label} border`} onClick={() => setBorder(option.id)} className={`${border === option.id ? "selected" : ""} ${option.id === "blur" ? "blur-swatch" : ""}`} style={{ background: option.color }}>{border === option.id && <Icon name="check" />}</button>)}</div>
              <input aria-label="Border size" type="range" min="0" max="18" value={borderSize} onChange={(event) => setBorderSize(Number(event.target.value))} />
            </div>
            <div className="control-group"><div className="label-row"><label htmlFor="saturation">Saturation</label><span>{saturation}%</span></div><input id="saturation" type="range" min="70" max="140" value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} /><div className="range-labels"><span>Softer</span><span>Natural</span><span>Richer</span></div></div>
            <div className="control-group text-control"><label htmlFor="text-overlay">Text <span>Optional</span></label><input id="text-overlay" value={overlayText} onChange={(event) => setOverlayText(event.target.value)} placeholder="Add a title or short note" />
              <div className="text-section-label">Font</div><div className="text-options font-options" aria-label="Text font">{(["elegant", "simple", "handwritten"] as const).map((font) => <button key={font} onClick={() => setTextFont(font)} className={`${font} ${textFont === font ? "selected" : ""}`} aria-pressed={textFont === font}>{font[0].toUpperCase() + font.slice(1)}</button>)}</div>
              <div className="text-size-control"><div className="label-row"><label htmlFor="text-size">Size</label><span>{textSize}px</span></div><input id="text-size" type="range" min="14" max="44" value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} /><div className="range-labels"><span>Smaller</span><span>Larger</span></div></div>
              <div className="text-detail-row"><div><div className="text-section-label">Colour</div><div className="text-colours" aria-label="Text colour">{textColours.map((colour) => <button key={colour.id} aria-label={`${colour.label} text`} title={colour.label} onClick={() => setTextColour(colour.value)} className={textColour === colour.value ? "selected" : ""} style={{ backgroundColor: colour.value }}>{textColour === colour.value && <Icon name="check" />}</button>)}</div></div>
                <div><div className="text-section-label">Position</div><div className="position-options" aria-label="Text position">{(["top", "centre", "bottom"] as const).map((position) => <button key={position} onClick={() => chooseTextPosition(position)} className={textPosition === position ? "selected" : ""} aria-label={`${position} position`} aria-pressed={textPosition === position}><span className={`position-icon ${position}`} /></button>)}</div></div></div>
              <div className="fine-position"><div className="label-row"><label htmlFor="text-horizontal">Left / right</label><span>{Math.round(textX)}%</span></div><input id="text-horizontal" type="range" min="4" max="96" value={textX} onChange={(event) => chooseFineTextPosition(Number(event.target.value), textY)} /><div className="label-row vertical-label"><label htmlFor="text-vertical">Up / down</label><span>{Math.round(textY)}%</span></div><input id="text-vertical" type="range" min="4" max="96" value={textY} onChange={(event) => chooseFineTextPosition(textX, Number(event.target.value))} /><p className="drag-hint">Or drag the text directly on the preview</p></div>
            </div>
          </aside>

          <section className="preview-area"><div className="preview-header"><div><p className="eyebrow">Preview</p><h2>{selectedFormat.label} · {selectedFormat.detail}</h2></div><span>Original artwork proportions</span></div>
            <div className={`artboard-wrap ${activeFormat}`}><div ref={artboardRef} className="artboard" style={{ aspectRatio: selectedFormat.ratio }}>
              <canvas ref={previewCanvasRef} className="preview-canvas" aria-label="Selected artwork preview" />
              <img ref={artworkRef} className="source-artwork" src={imageSrc} alt="" onLoad={() => setImageRevision((revision) => revision + 1)} />
              {overlayText && <div ref={overlayRef} aria-hidden="true" className={`overlay-text text-drag-target ${textFont} ${draggingText ? "dragging" : ""}`} style={{ fontSize: `${textSize}px`, left: `${textX}%`, top: `${textY}%` }} onPointerDown={beginTextDrag} onPointerMove={continueTextDrag} onPointerUp={endTextDrag} onPointerCancel={endTextDrag} title="Drag to reposition text">{overlayText}</div>}
            </div></div>
            <div className="preview-footer"><div className="quality-note"><span className="quality-dot" /><span>{status}</span></div><button className="save-button" onClick={saveAndShare} disabled={exporting}><Icon name={exporting ? "spinner" : "download"} /> {exporting ? "Creating…" : "Save & share"}</button></div>
          </section>
        </section>
        <section className="posting-card"><div className="posting-info"><div className="mini-thumb"><img src={imageSrc} alt="" /></div><div><p className="eyebrow">Posting record</p><h2>{fileName || "Untitled artwork"}</h2><span>{currentRecordId ? (postedCount ? `Posted to ${postedCount} ${postedCount === 1 ? "place" : "places"}` : "Saved · not posted yet") : "Created when you save or share"}</span></div></div>
          <div className="platforms">{(["instagram", "facebook"] as const).map((platform) => <button key={platform} className={posted[platform] ? "posted" : ""} onClick={() => togglePosted(platform)} aria-pressed={Boolean(posted[platform])}><span className={`platform-icon ${platform}`}>{platform === "instagram" ? "◎" : "f"}</span><span><strong>{platform[0].toUpperCase() + platform.slice(1)}</strong><small>{posted[platform] ? `Posted ${today}` : "Mark as posted"}</small></span><span className="status-check">{posted[platform] ? <Icon name="check" /> : ""}</span></button>)}</div>
        </section>
      </>)}
      <p className="version">Posting Art · v1.0.3</p>
    </main>
  );
}
