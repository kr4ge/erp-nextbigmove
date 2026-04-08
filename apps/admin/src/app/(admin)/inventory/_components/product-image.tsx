import { Tag } from "lucide-react";

export function ProductImage({
  imageUrl,
  name,
  className = "h-12 w-12",
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  if (!imageUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 ${className}`}
      >
        <Tag className="h-4 w-4 text-slate-400" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className={`rounded-lg border border-slate-200 object-cover ${className}`}
      loading="lazy"
    />
  );
}
