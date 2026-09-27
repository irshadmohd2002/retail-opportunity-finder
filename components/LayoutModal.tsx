"use client";

import Modal from "./Modal";

interface LayoutModalProps {
  outletName: string;
  layoutDiagramUrl: string | null;
  onClose: () => void;
}

export default function LayoutModal({ outletName, layoutDiagramUrl, onClose }: LayoutModalProps) {
  const isPdf = layoutDiagramUrl?.toLowerCase().split("?")[0].endsWith(".pdf") ?? false;

  return (
    <Modal title="Site layout" subtitle={outletName} onClose={onClose}>
      {!layoutDiagramUrl ? (
        <p className="text-sm text-muted italic">No layout diagram uploaded yet.</p>
      ) : isPdf ? (
        <div className="flex flex-col gap-3">
          <iframe src={layoutDiagramUrl} title={`${outletName} layout diagram`} className="w-full h-[70vh] rounded-sm border border-border" />
          <a href={layoutDiagramUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-navy hover:underline self-start">
            Open PDF in new tab
          </a>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layoutDiagramUrl} alt={`${outletName} layout diagram`} className="w-full rounded-sm border border-border" />
      )}
    </Modal>
  );
}
