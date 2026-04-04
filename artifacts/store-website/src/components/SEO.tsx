import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
  structuredData?: object | object[];
}

const BASE_URL = "https://app.mismari.com";
const DEFAULT_IMAGE = `${BASE_URL}/mismari-official.jpeg`;
const SITE_NAME = "مسماري | Mismari";

const BASE_KEYWORDS = "مسماري, مسماري بلس, مسماري+, متجر مسماري, mismari, mismari plus, متجر تطبيقات ايفون, متجر IPA, ipa store, تطبيقات ايفون, تطبيقات ios, تطبيقات مدفوعة مجانا, تطبيقات بدون جيلبريك, ios apps free, iphone apps free, متجر عربي, app store arabic";

export default function SEO({
  title,
  description,
  keywords,
  canonical,
  ogImage = DEFAULT_IMAGE,
  ogType = "website",
  noIndex = false,
  structuredData,
}: SEOProps) {
  const fullTitle = title
    ? `${title} | مسماري`
    : "مسماري | متجر تطبيقات الآيفون العربي — IPA Store بدون جيلبريك";

  const fullDescription = description ||
    "مسماري هو المتجر العربي الأول لتطبيقات الآيفون والآيباد. حمّل آلاف التطبيقات والألعاب المدفوعة مجاناً على iOS بدون جيلبريك.";

  const fullKeywords = keywords
    ? `${keywords}, ${BASE_KEYWORDS}`
    : BASE_KEYWORDS;

  const fullCanonical = canonical ? `${BASE_URL}${canonical}` : BASE_URL + "/";

  const schemas = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <meta name="keywords" content={fullKeywords} />
      <link rel="canonical" href={fullCanonical} />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1"} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="ar_SA" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content="@mismariplus" />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
