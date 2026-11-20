"use client";

import { useEffect, useState } from "react";

/**
 * Whether an InsDocumentUploader inside the element given to `ref` is mid-upload (it shows "Uploading…" while
 * the file is sent). Lets a form hold its submit button until the attachment has a file id, so nothing is sent
 * without it. `ref` is a callback ref, so it also works inside modals that mount later.
 */
export function useUploadWatch() {
  const [el, ref] = useState<HTMLElement | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (!el) return;
    const observer = new MutationObserver(() => setUploading(Boolean(el.textContent?.includes("Uploading…"))));
    observer.observe(el, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      setUploading(false);
    };
  }, [el]);
  return { ref, uploading };
}
