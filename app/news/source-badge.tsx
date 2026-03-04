import Image from "next/image";
import { resolveSourceBrand } from "@/lib/source-brand";

type SourceBadgeProps = {
  articleUrl: string;
  feedUrl: string;
};

export function SourceBadge({ articleUrl, feedUrl }: SourceBadgeProps) {
  const brand = resolveSourceBrand(articleUrl, feedUrl);

  return (
    <div className="source-badge" title={brand.name}>
      <Image
        src={brand.logoPath}
        width={120}
        height={40}
        alt={brand.name}
        className="source-logo"
      />
    </div>
  );
}
