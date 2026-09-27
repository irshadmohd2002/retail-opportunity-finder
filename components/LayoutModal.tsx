"use client";

import Modal from "./Modal";

interface LayoutModalProps {
  outletName: string;
  layoutDiagramUrl: string | null;
  onClose: () => void;
}

export default function LayoutModal({ outletName, layoutDiagramUrl, onClose }: LayoutModalProps) {
  return (
    <Modal title="Site layout" subtitle={outletName} onClose={onClose}>
      {layoutDiagramUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layoutDiagramUrl} alt={`${outletName} layout diagram`} className="w-full rounded-sm border border-border" />
      ) : (
        <p className="text-sm text-muted italic">No layout diagram uploaded yet.</p>
      )}
    </Modal>
  );
}
