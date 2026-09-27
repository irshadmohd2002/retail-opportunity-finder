"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RoImage } from "@/lib/types";
import { SelectField, TextField } from "./fields";

interface OutletOption {
  id: string;
  name: string;
}

export default function PhotosAdmin() {
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [outletId, setOutletId] = useState("");
  const [images, setImages] = useState<RoImage[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("ro_profiles")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        setOutlets(data ?? []);
        if (data && data.length > 0) setOutletId(data[0].id);
      });
  }, []);

  async function loadImages(id: string) {
    const { data, error } = await supabase.from("ro_images").select("*").eq("ro_id", id).order("sort_order");
    if (error) setError(error.message);
    else setImages(data ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on outlet change
    if (outletId) loadImages(outletId);
  }, [outletId]);

  async function handleUpload(files: FileList) {
    if (!outletId || files.length === 0) return;
    setUploading(true);
    setError(null);
    let nextSortOrder = images.length;

    for (const file of Array.from(files)) {
      const path = `${outletId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("ro-images").upload(path, file);
      if (uploadError) {
        setError(
          uploadError.message.includes("Bucket not found")
            ? "Storage bucket 'ro-images' not found — run migrations/002_storage_bucket.sql in the Supabase SQL Editor first."
            : uploadError.message
        );
        break;
      }
      const { data: publicUrl } = supabase.storage.from("ro-images").getPublicUrl(path);
      const { error: insertError } = await supabase
        .from("ro_images")
        .insert({ ro_id: outletId, url: publicUrl.publicUrl, caption: caption || null, sort_order: nextSortOrder });
      if (insertError) {
        setError(insertError.message);
        break;
      }
      nextSortOrder += 1;
    }

    setUploading(false);
    setCaption("");
    loadImages(outletId);
  }

  async function remove(image: RoImage) {
    if (!confirm("Delete this photo?")) return;
    await supabase.from("ro_images").delete().eq("id", image.id);
    loadImages(outletId);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">Site photos</h2>
      {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}

      <div className="bg-surface rounded-md shadow-card border border-border p-5 flex flex-col gap-4 max-w-md">
        <SelectField
          label="Outlet"
          value={outletId}
          onChange={setOutletId}
          options={outlets.map((o) => ({ value: o.id, label: o.name }))}
        />
        <TextField label="Caption (optional)" value={caption} onChange={setCaption} />
        <label className="text-sm">
          <span className="text-muted block mb-1">Upload photos (select or drop multiple)</span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading || !outletId}
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) handleUpload(files);
              e.target.value = "";
            }}
          />
        </label>
        {uploading && <p className="text-xs text-muted">Uploading…</p>}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
          {images.map((img) => (
            <figure key={img.id} className="rounded-sm overflow-hidden border border-border relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? "Site photo"} className="w-full h-28 object-cover" />
              <button
                onClick={() => remove(img)}
                className="absolute top-1 right-1 text-xs bg-white/90 rounded-sm px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
              {img.caption && <figcaption className="text-xs text-muted px-2 py-1">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
