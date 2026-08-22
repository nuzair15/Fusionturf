import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "react-router-dom";

export function SEOHead() {
  const location = useLocation();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
    retry: false,
    staleTime: 60000,
  });

  const siteName = settings?.site_name || "Fusion Turf";
  const faviconUrl = settings?.site_favicon_url || "";

  useEffect(() => {
    const section = location.pathname.startsWith("/booking") ? "Turf Booking" : location.pathname.startsWith("/league/fixtures") ? "Fixtures" : location.pathname.startsWith("/league/standings") ? "Standings" : location.pathname.startsWith("/league") ? "Football League" : location.pathname.startsWith("/auth") ? "Account" : "Turf Booking & Football League";
    document.title = `${section} | ${siteName}`;
    let canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `${window.location.origin}${location.pathname}`;
    for (const [property, content] of [["og:title", document.title], ["og:url", canonical.href], ["og:type", "website"]]) {
      let meta = document.querySelector<HTMLMetaElement>(`meta[property='${property}']`);
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute("property", property); document.head.appendChild(meta); }
      meta.content = content;
    }
  }, [siteName, location.pathname]);

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
