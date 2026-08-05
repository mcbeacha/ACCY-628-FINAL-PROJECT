"use client";

import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { DOCUMENTS, daysUntil, type DocumentRecord } from "@/lib/workspace-mock";
import {
  Download,
  Eye,
  FolderInput,
  History,
  Pencil,
  Share2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";

type Tab = "All" | "Recently edited" | "Awaiting review" | "Shared" | "Templates";

const TABS: Tab[] = ["All", "Recently edited", "Awaiting review", "Shared", "Templates"];

const FILE_BADGE: Record<DocumentRecord["fileType"], string> = {
  PDF: "badge-error",
  DOCX: "badge-info",
  XLSX: "badge-success",
  PPTX: "badge-warning",
  MSG: "badge-ghost",
};

function matchesTab(doc: DocumentRecord, tab: Tab): boolean {
  switch (tab) {
    case "All":
      return true;
    case "Recently edited":
      return daysUntil(doc.modifiedOn) >= -7;
    case "Awaiting review":
      return doc.status === "Awaiting Review";
    case "Shared":
      return doc.status === "Shared";
    case "Templates":
      return doc.status === "Template";
  }
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export function DocumentsClient() {
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("All folders");
  const [matter, setMatter] = useState("All matters");
  const [notice, setNotice] = useState<string | null>(null);

  const folders = useMemo(
    () => ["All folders", ...new Set(DOCUMENTS.map((d) => d.folder))],
    []
  );
  const matters = useMemo(
    () => ["All matters", ...new Set(DOCUMENTS.map((d) => d.matterRef))],
    []
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCUMENTS.filter((doc) => {
      if (!matchesTab(doc, tab)) return false;
      if (folder !== "All folders" && doc.folder !== folder) return false;
      if (matter !== "All matters" && doc.matterRef !== matter) return false;
      if (!q) return true;
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.clientName.toLowerCase().includes(q) ||
        doc.matterRef.toLowerCase().includes(q)
      );
    }).sort((a, b) => b.modifiedOn.localeCompare(a.modifiedOn));
  }, [tab, query, folder, matter]);

  function act(action: string, doc: DocumentRecord) {
    setNotice(`${action} — ${doc.name}. Document storage is not connected in this demonstration.`);
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="alert alert-info text-sm">
          <span>{notice}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" className="tabs tabs-box flex-wrap">
              {TABS.map((item) => (
                <button
                  key={item}
                  role="tab"
                  type="button"
                  aria-selected={tab === item}
                  className={`tab ${tab === item ? "tab-active" : ""}`}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-1"
              onClick={() =>
                setNotice("Upload started. Connect document storage to persist files.")
              }
            >
              <Upload className="h-4 w-4" />
              Upload document
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="form-control sm:col-span-1">
              <span className="label-text text-sm font-medium">Search</span>
              <input
                className="input input-bordered w-full mt-1"
                placeholder="Document, client, or matter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Folder</span>
              <select
                className="select select-bordered w-full mt-1"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
              >
                {folders.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-sm font-medium">Matter</span>
              <select
                className="select select-bordered w-full mt-1"
                value={matter}
                onChange={(e) => setMatter(e.target.value)}
              >
                {matters.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-sm opacity-60">
            {visible.length} {visible.length === 1 ? "document" : "documents"}
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No documents match your filters"
          description="Try a different folder, matter, or search term."
          action={
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setQuery("");
                setFolder("All folders");
                setMatter("All matters");
                setTab("All");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Matter</th>
                  <th>Uploaded by</th>
                  <th>Uploaded</th>
                  <th>Modified</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => (
                  <tr key={doc.id} className="hover">
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`badge badge-sm ${FILE_BADGE[doc.fileType]}`}>
                          {doc.fileType}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{doc.name}</span>
                          <span className="block text-xs opacity-60">
                            {doc.folder} · {formatSize(doc.sizeKb)}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="text-sm">
                      <span className="block">{doc.matterRef}</span>
                      <span className="block text-xs opacity-60">{doc.clientName}</span>
                    </td>
                    <td className="text-sm">{doc.uploadedBy}</td>
                    <td className="text-sm">{formatDate(doc.uploadedOn)}</td>
                    <td className="text-sm">{formatDate(doc.modifiedOn)}</td>
                    <td className="text-sm">v{doc.version}</td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => act("Preview", doc)}
                          aria-label={`Preview ${doc.name}`}
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => act("Download", doc)}
                          aria-label={`Download ${doc.name}`}
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <div className="dropdown dropdown-end">
                          <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-ghost btn-xs"
                            aria-label={`More actions for ${doc.name}`}
                          >
                            More
                          </div>
                          <ul
                            tabIndex={0}
                            className="menu dropdown-content menu-sm z-50 mt-1 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow"
                          >
                            <li>
                              <button type="button" onClick={() => act("Rename", doc)}>
                                <Pencil className="h-4 w-4" />
                                Rename
                              </button>
                            </li>
                            <li>
                              <button type="button" onClick={() => act("Move", doc)}>
                                <FolderInput className="h-4 w-4" />
                                Move
                              </button>
                            </li>
                            <li>
                              <button type="button" onClick={() => act("Share", doc)}>
                                <Share2 className="h-4 w-4" />
                                Share
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                onClick={() =>
                                  setNotice(
                                    `${doc.name} has ${doc.version} versions. Version history is not connected in this demonstration.`
                                  )
                                }
                              >
                                <History className="h-4 w-4" />
                                Version history
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
