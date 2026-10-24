import { useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import type { CaseDefinitionInput } from "@ccs/validation";

export function ImagingAttachments({ definition, onChange }: {
  definition: CaseDefinitionInput;
  onChange: (results: CaseDefinitionInput["results"]) => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const orders = definition.orders.filter(order => order.category === "Imaging");
  if (!orders.length) return null;
  return <section className="mt-6 grid gap-4 border-t border-[#c5cfd5] pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-[#1e465e]">Imaging attachments <span className="ml-2 text-xs font-normal text-[#61717b]">Optional</span></h3>
      <span className="text-xs text-[#61717b]">PNG, JPEG or WebP · Up to 500 KB per image</span>
    </div>
    {error && <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {orders.map(order => {
      const result = definition.results.find(item => item.orderId === order.id);
      return <div key={order.id} className="grid grid-cols-1 items-center gap-5 border-b border-[#d8dfe3] pb-4 sm:grid-cols-[180px_1fr]">
        <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded border border-[#b8c6ce] bg-[#f3f6f7]">
          {result?.imageDataUrl ? <img src={result.imageDataUrl} alt={`${order.name} attachment preview`} className="h-full w-full object-contain" /> : <ImagePlus size={30} strokeWidth={1.5} className="text-[#7b909c]" aria-hidden="true" />}
        </div>
        <div className="grid min-w-0 gap-3">
          <div><h4 className="text-sm font-bold text-[#203b4b]">{order.name}</h4>
            <p className={`mt-1 flex items-center gap-1.5 text-xs ${result?.imageDataUrl ? "text-green-700" : "text-[#61717b]"}`}>
              {result?.imageDataUrl && <CheckCircle2 size={13} />}{result?.imageDataUrl ? "Image attached" : "No image attached"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
        <label className={`relative inline-flex h-9 items-center gap-2 rounded border border-[#1e465e] bg-[#1e465e] px-3 text-xs font-bold text-white hover:bg-[#285a73] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1e5b78] ${loading ? "opacity-50" : "cursor-pointer"}`}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {loading ? "Processing..." : result?.imageDataUrl ? "Replace image" : "Upload image"}
          <input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${result?.imageDataUrl ? "Replace" : "Upload"} ${order.name} image`} type="file" accept="image/png,image/jpeg,image/webp" disabled={loading} onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setError("");
            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 500 * 1024) {
              setError("Select a PNG, JPEG, or WebP image no larger than 500 KB."); return;
            }
            setLoading(true);
            try {
              const imageDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error("Could not read image."));
                reader.readAsDataURL(file);
              });
              await new Promise<void>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve();
                image.onerror = () => reject(new Error("This file is not a readable image."));
                image.src = imageDataUrl;
              });
              const next = result ? definition.results.map(item => item.orderId === order.id ? { ...item, imageDataUrl } : item)
                : [...definition.results, { orderId: order.id, category: "Imaging" as const, value: "Imaging study attached.", imageDataUrl }];
              if (next.reduce((size, item) => size + (item.imageDataUrl?.length ?? 0), 0) > 1400000) throw new Error("Case images exceed the total size limit. Use smaller images.");
              onChange(next);
            } catch (error) { setError(error instanceof Error ? error.message : "Image upload failed."); }
            finally { setLoading(false); }
          }} />
        </label>
        {result?.imageDataUrl && <button type="button" className="flex h-9 w-9 items-center justify-center rounded border border-[#b8c6ce] bg-white text-red-700 hover:border-red-500 hover:bg-red-50 disabled:opacity-50" title="Remove image" aria-label={`Remove ${order.name} image`} disabled={loading} onClick={() => onChange(definition.results.map(item => item.orderId === order.id ? { ...item, imageDataUrl: undefined } : item))}><Trash2 size={16} /></button>}
          </div>
        </div>
      </div>;
    })}
  </section>;
}
