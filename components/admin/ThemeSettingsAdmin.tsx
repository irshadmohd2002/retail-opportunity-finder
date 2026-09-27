"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FontPairing, SizeScale, SiteSettings } from "@/lib/types";

const FONT_OPTIONS: { value: FontPairing; label: string; description: string }[] = [
  { value: "editorial", label: "Editorial", description: "Fraunces headings, Work Sans body (current default)" },
  { value: "classic", label: "Classic", description: "Newsreader headings, Inter body" },
  { value: "modern", label: "Modern", description: "Space Grotesk headings, Inter body" },
];

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#C0293A", label: "Brick red (current default)" },
  { value: "#0B1F33", label: "Deep navy" },
  { value: "#1F5D4C", label: "Forest green" },
  { value: "#3D5A80", label: "Slate blue" },
];

const SIZE_OPTIONS: { value: SizeScale; label: string }[] = [
  { value: "compact", label: "Compact (14px base)" },
  { value: "normal", label: "Normal (16px base, current default)" },
  { value: "large", label: "Large (18px base)" },
];

export default function ThemeSettingsAdmin() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.from("site_settings").select("*").eq("id", "global").maybeSingle();
    if (error) setError(error.message);
    else setSettings(data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async fetch on mount
    load();
  }, []);

  async function update(patch: Partial<Pick<SiteSettings, "font_pairing" | "accent_color" | "size_scale">>) {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await supabase.from("site_settings").update(patch).eq("id", "global");
    setSaving(false);
    if (error) setError(error.message);
  }

  if (!settings) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="font-semibold">Theme settings</h2>
        <p className="text-sm text-muted mt-1">
          Site-wide only — applies everywhere, for every visitor. Changes take effect on next page load.
          {saving && " Saving…"}
        </p>
      </div>

      {error && <p className="text-sm" style={{ color: "var(--navy)" }}>{error}</p>}

      <section className="bg-surface rounded-md shadow-card border border-border p-5">
        <h3 className="text-sm font-semibold mb-3">Font pairing</h3>
        <div className="flex flex-col gap-2">
          {FONT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="font_pairing"
                checked={settings.font_pairing === opt.value}
                onChange={() => update({ font_pairing: opt.value })}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{opt.label}</span>
                <span className="text-muted"> — {opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-surface rounded-md shadow-card border border-border p-5">
        <h3 className="text-sm font-semibold mb-3">Accent color</h3>
        <div className="flex flex-col gap-2">
          {COLOR_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="accent_color"
                checked={settings.accent_color === opt.value}
                onChange={() => update({ accent_color: opt.value })}
              />
              <span
                className="inline-block w-4 h-4 rounded-full border border-border"
                style={{ background: opt.value }}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-surface rounded-md shadow-card border border-border p-5">
        <h3 className="text-sm font-semibold mb-3">Size scale</h3>
        <div className="flex flex-col gap-2">
          {SIZE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="size_scale"
                checked={settings.size_scale === opt.value}
                onChange={() => update({ size_scale: opt.value })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
