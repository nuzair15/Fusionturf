import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { api } from "@/lib/api";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  uploadUrl?: string;
  wide?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function ImageUpload({ value, onChange, label = "Image", uploadUrl = `${API_BASE}/upload`, wide = false }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const data = await api.uploadImage(file, uploadUrl);
      if (data.url) onChange(data.url);
    } catch (error: any) {
      setUploadError(error.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value && (
        <div className="relative inline-block">
          <img src={value} alt={`${label} preview`} className={wide ? "aspect-[3/1] w-full max-w-lg rounded-lg border object-cover" : "h-24 w-24 rounded-lg border object-cover"} />
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={() => onChange("")}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading..." : "Upload File"}
        </Button>
        <input ref={inputRef} aria-label={`Upload ${label}`} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleFile} />
      </div>
      {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
    </div>
  );
}
