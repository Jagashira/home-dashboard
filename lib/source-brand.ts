export type SourceBrand = {
  name: string;
  logoPath: string;
};

const SOURCE_BRANDS: Array<{ match: RegExp; brand: SourceBrand }> = [
  { match: /gigazine\.net/i, brand: { name: "Gigazine", logoPath: "/source-logos/gigazine.svg" } },
  { match: /itmedia\.co\.jp/i, brand: { name: "ITmedia", logoPath: "/source-logos/itmedia.svg" } },
  { match: /publickey1\.jp/i, brand: { name: "Publickey", logoPath: "/source-logos/publickey.svg" } },
  { match: /semiengineering\.com/i, brand: { name: "SemiEngineering", logoPath: "/source-logos/semieng.svg" } },
  { match: /arstechnica\.com/i, brand: { name: "Ars Technica", logoPath: "/source-logos/ars.svg" } },
  { match: /marktechpost\.com/i, brand: { name: "MarkTechPost", logoPath: "/source-logos/marktechpost.svg" } }
];

export function resolveSourceBrand(url: string, feedUrl: string): SourceBrand {
  const source = `${url}\n${feedUrl}`;

  for (const entry of SOURCE_BRANDS) {
    if (entry.match.test(source)) {
      return entry.brand;
    }
  }

  return {
    name: "Source",
    logoPath: "/source-logos/publickey.svg"
  };
}
