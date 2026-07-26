import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function SEOHead() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
    retry: false,
    staleTime: 60000,
  });

  const siteName = settings?.site_name || "Fusion League";
  const faviconUrl = settings?.site_favicon_url || "";

  useEffect(() => {
    document.title = siteName ? `${siteName} - Turf Booking & Football League in Bhramavar, Udupi` : "Fusion League - Turf Booking & Football League in Bhramavar, Udupi";
  }, [siteName]);

  useEffect(() => {
    if (faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [faviconUrl]);

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>("meta[name='description']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = `${siteName} - Premium turf booking and football league management in Bhramavar, Udupi. Book 5-a-side, 7-a-side, and 11-a-side turfs. Join the Fusion League today!`;
  }, [siteName]);

  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": siteName,
      "description": "Premium turf booking and football league management platform in Bhramavar, Udupi",
      "url": window.location.origin,
      "areaServed": ["Bhramavar", "Udupi", "Karnataka"],
      "sport": "Soccer",
      "openingHours": "Mo-Su 06:00-23:00",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Bhramavar",
        "addressRegion": "Udupi",
        "addressCountry": "IN",
      },
    };
    let script = document.querySelector<HTMLScriptElement>("script[type='application/ld+json']");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }, [siteName]);

  return null;
}
