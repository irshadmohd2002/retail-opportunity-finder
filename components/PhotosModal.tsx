"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { supabase } from "@/lib/supabase";
import type { RoImage } from "@/lib/types";

interface PhotosModalProps {
  outletId: string;
  outletName: string;
  onClose: () => void;
}

export default function PhotosModal({ outletId, outletName, onClose }: PhotosModalProps) {
  const [images, setImages] = useState<RoImage[] | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("ro_images")
      .select("*")
      .eq("ro_id", outletId)
      .order("sort_order")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to load site photos:", error.message);
          setImages([]);
          return;
        }
        setImages(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [outletId]);

  return (
    <Modal title="Site photos" subtitle={outletName} onClose={onClose}>
      {images === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-muted italic">No photos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <figure key={img.id} className="rounded-sm overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? "Site photo"} className="w-full h-28 object-cover" />
              {img.caption && <figcaption className="text-xs text-muted px-2 py-1">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </Modal>
  );
}
