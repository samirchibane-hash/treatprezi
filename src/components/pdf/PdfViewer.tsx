import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  className?: string;
}

export function PdfViewer({ url, className = '' }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    pdfjsLib.getDocument(url).promise.then((doc) => {
      if (!cancelled) {
        setPdf(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error('PDF load error:', err);
        setError('Failed to load PDF');
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [url]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    const page = await pdf.getPage(currentPage);
    const containerWidth = containerRef.current.clientWidth - 32; // padding
    const unscaledViewport = page.getViewport({ scale: 1 });
    const fitScale = containerWidth / unscaledViewport.width;
    const finalScale = fitScale * scale;
    const viewport = page.getViewport({ scale: finalScale });

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
  }, [pdf, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => renderPage();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderPage]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading document...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 text-muted-foreground ${className}`}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm tabular-nums min-w-[80px] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs tabular-nums min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.min(3, s + 0.25))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="overflow-auto bg-muted/20 p-4 flex justify-center" style={{ maxHeight: '70vh' }}>
        <canvas ref={canvasRef} className="shadow-md" />
      </div>
    </div>
  );
}
