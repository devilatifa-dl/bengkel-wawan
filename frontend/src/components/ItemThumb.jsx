import React from "react";
import { Package } from "lucide-react";
import { useBlobUrl } from "../lib/hooks";

export const ItemThumb = ({ blob, className = "h-16 w-16", rounded = "rounded-lg", testid, iconSize = "h-7 w-7" }) => {
  const url = useBlobUrl(blob);
  return (
    <div
      data-testid={testid}
      className={`${className} ${rounded} shrink-0 overflow-hidden border border-slate-700/70 bg-[#0B1220] flex items-center justify-center`}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <Package className={`${iconSize} text-slate-600`} />
      )}
    </div>
  );
};
