"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DOCUMENT_REQUESTS_EVENT,
  DOCUMENT_REQUESTS_STORAGE_KEY,
  readDocumentRequests,
  type DocumentRequest,
  writeDocumentRequests,
} from "@/lib/document-requests";

export function useDocumentRequests() {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setRequests(readDocumentRequests());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(DOCUMENT_REQUESTS_EVENT, onChange);
    window.addEventListener("storage", (e) => {
      if (e.key === DOCUMENT_REQUESTS_STORAGE_KEY || e.key === null) onChange();
    });
    return () => {
      window.removeEventListener(DOCUMENT_REQUESTS_EVENT, onChange);
    };
  }, [refresh]);

  const replaceAll = useCallback((next: DocumentRequest[]) => {
    writeDocumentRequests(next);
    setRequests(next);
  }, []);

  return { requests, ready, refresh, replaceAll };
}
