import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer() {
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [width, setWidth] = useState(700);
  const canvas = useRef<HTMLCanvasElement>(null),
    wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = wrap.current;
    if (!target) return;
    const observer = new ResizeObserver(() => setWidth(target.clientWidth));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    const task = pdfjs.getDocument('/memory-attention.pdf');
    task.promise
      .then((d) => {
        if (active) {
          setDoc(d);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('The preview could not load. You can still download the slides.');
      });
    return () => {
      active = false;
      void task.destroy();
    };
  }, []);
  useEffect(() => {
    if (!doc) return;
    let render: pdfjs.RenderTask | undefined,
      cancelled = false;
    const draw = async () => {
      setLoading(true);
      setError('');
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const scale = (Math.max(1, width - 2) / base.width) * zoom;
        const viewport = p.getViewport({ scale: scale * Math.min(devicePixelRatio, 2) });
        // Render into a private canvas so rapid navigation cannot reuse an active PDF render.
        const buffer = document.createElement('canvas');
        buffer.width = Math.ceil(viewport.width);
        buffer.height = Math.ceil(viewport.height);
        render = p.render({ canvas: buffer, viewport });
        await render.promise;
        if (cancelled || !canvas.current) return;
        const c = canvas.current;
        c.width = buffer.width;
        c.height = buffer.height;
        c.style.width = `${base.width * scale}px`;
        c.style.height = `${base.height * scale}px`;
        c.getContext('2d')!.drawImage(buffer, 0, 0);
      } catch (e) {
        if (!cancelled) setError('The slide could not render. Please download the PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void draw();
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [doc, page, zoom, width]);
  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <div className="inline">
          <button
            className="icon-button"
            title="Previous slide"
            aria-label="Previous slide"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </button>
          <span>
            Slide {page} / {doc?.numPages || 10}
          </span>
          <button
            className="icon-button"
            title="Next slide"
            aria-label="Next slide"
            disabled={!doc || page === doc.numPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="inline">
          <button
            className="icon-button"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={zoom <= 1}
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            <ZoomOut />
          </button>
          <button
            className="icon-button"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={zoom >= 2}
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
          >
            <ZoomIn />
          </button>
          <a
            className="icon-button"
            href="/memory-attention.pdf"
            download
            title="Download slides"
            aria-label="Download slides"
          >
            <Download />
          </a>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && !error && <p role="status">Loading slide...</p>}
      <div className="pdf-canvas" ref={wrap}>
        <canvas
          ref={canvas}
          hidden={loading || !!error}
          aria-label={`Memory and attention, slide ${page}. Download the PDF for the accessible source document.`}
        />
      </div>
      <p className="caption">How Memory and Attention Work · 12 slides</p>
    </div>
  );
}
