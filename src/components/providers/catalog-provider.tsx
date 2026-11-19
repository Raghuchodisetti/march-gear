"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createCatalog, type Catalog, type CatalogData } from "@/lib/catalog";

const CatalogContext = createContext<Catalog | null>(null);

/** Makes the MySQL-backed catalogue available to client components. */
export function CatalogProvider({ data, children }: { data: CatalogData; children: ReactNode }) {
  const catalog = useMemo(() => createCatalog(data), [data]);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

/** Brands, cars, used cars, dealers, articles and their lookup helpers. */
export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}
