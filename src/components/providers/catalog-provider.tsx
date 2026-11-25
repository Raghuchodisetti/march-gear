"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createCatalog, decodeClientCatalog, type ClientCatalog, type ClientCatalogWire } from "@/lib/catalog";

const CatalogContext = createContext<ClientCatalog | null>(null);

/**
 * Makes the MySQL-backed catalogue available to client components. Models arrive as CarLite in the compact
 * wire format (getClientCatalogData): pass full details as props from the server, or load them with
 * useCarDetails(), where a component needs more.
 */
export function CatalogProvider({ data, children }: { data: ClientCatalogWire; children: ReactNode }) {
  const catalog = useMemo(() => createCatalog(decodeClientCatalog(data)), [data]);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

/** Brands, cars (CarLite), used cars, dealers, articles and their lookup helpers. */
export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}
