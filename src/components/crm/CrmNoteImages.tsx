"use client";

import { Paperclip, X } from "lucide-react";
import { COPY } from "@/lib/copy";
import { NOTE_IMAGE_MAX_BYTES } from "@/lib/crm/note-images";
import { cn } from "@/lib/utils";

export type PendingNoteImage = {
  id: string;
  dataUrl: string;
};

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,.+$/;

export function readNoteImageFile(file: File): Promise<PendingNoteImage> {
  if (file.size > NOTE_IMAGE_MAX_BYTES) {
    return Promise.reject(new Error(COPY.crmImageTooBig));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!DATA_URL.test(dataUrl)) {
        reject(new Error(COPY.crmImageType));
        return;
      }
      resolve({ id: crypto.randomUUID(), dataUrl });
    };
    reader.onerror = () => reject(new Error(COPY.crmImageType));
    reader.readAsDataURL(file);
  });
}

export function CrmNoteImageStrip({
  images,
  onRemove,
}: {
  images: { id: string; src: string }[];
  onRemove?: (id: string) => void;
}) {
  if (!images.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {images.map((image) => (
        <li key={image.id} className="relative">
          <a href={image.src} target="_blank" rel="noreferrer" className="block">
            <img
              src={image.src}
              alt={COPY.crmNoteImage}
              className="h-14 w-14 rounded-md border border-white/10 object-cover"
            />
          </a>
          {onRemove ? (
            <button
              type="button"
              aria-label={COPY.crmRemoveImage}
              onClick={() => onRemove(image.id)}
              className="absolute -right-1 -top-1 rounded-full border border-white/15 bg-podium-navy p-0.5 text-podium-muted hover:text-podium-white"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function CrmNoteImageButton({
  disabled,
  onFiles,
  className,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-white/10 px-2 py-1 text-[11px] leading-4 text-podium-muted hover:border-white/20 hover:text-podium-white",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <Paperclip className="h-3 w-3" />
      {COPY.crmAttachImage}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}
