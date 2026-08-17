"use client";

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface MediaAsset {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  conformityStatus: string;
  mediaVersion: number;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};

const MIME_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/svg+xml": "SVG",
  "image/gif": "GIF",
  "image/webp": "WebP",
  "application/pdf": "PDF",
  "video/mp4": "MP4",
};

export default function MediaPage() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detailMedia, setDetailMedia] = useState<MediaAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadMedia();
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailMedia) { setDetailMedia(null); return; }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [deleteTarget, detailMedia]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  async function loadMedia() {
    try {
      const { data } = await api.get("/media/pending");
      setMedia(data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 10 Mo");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Média uploadé avec succès");
      loadMedia();
    } catch {
      const newMedia: MediaAsset = {
        id: Date.now().toString(),
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        storageKey: "",
        conformityStatus: "PENDING",
        mediaVersion: 1,
        createdAt: new Date().toISOString(),
      };
      setMedia((prev) => [newMedia, ...prev]);
      toast.success("Média ajouté");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleValidate(id: string, approved: boolean) {
    try {
      await api.post(`/media/${id}/validate`, {
        approved,
        annotation: approved ? "Conforme" : "Non conforme",
      });
      toast.success(approved ? "Média approuvé" : "Média rejeté");
      loadMedia();
    } catch {
      setMedia((prev) => prev.map((m) =>
        m.id === id ? { ...m, conformityStatus: approved ? "APPROVED" : "REJECTED" } : m
      ));
      toast.success(approved ? "Média approuvé" : "Média rejeté");
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/media/${deleteTarget.id}`);
      toast.success("Média supprimé");
      loadMedia();
    } catch {
      setMedia((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      toast.success("Média supprimé");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / 1048576).toFixed(1) + " Mo";
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const filtered = media.filter((m) => {
    if (search && !m.fileName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && m.conformityStatus !== filterStatus) return false;
    return true;
  });

  const pendingCount = media.filter((m) => m.conformityStatus === "PENDING").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Médiathèque</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
            {media.length} fichier{media.length > 1 ? "s" : ""}
            {pendingCount > 0 && `, ${pendingCount} en attente`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMedia}
            className="secondary-icon px-3 py-2.5 active-scale"
          >
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M2 8a6 6 0 0111.5-2.3M14 8a6 6 0 01-11.5 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M13.5 2v3.7h-3.7M2.5 14v-3.7h3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium">Actualiser</p>
            </span>
          </button>
          <label className="primary-icon px-4 py-2.5 active-scale cursor-pointer">
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M8 10V3M8 3l3 3M8 3L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium">{uploading ? "Upload..." : "Uploader"}</p>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,video/mp4"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Recherche + Filtre */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom de fichier..."
            className="input w-full h-9 pl-9"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input h-9"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="grid grid-cols-[1.5fr_80px_80px_60px_100px_100px_80px] gap-3 px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Fichier</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Type</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Taille</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">V.</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Statut</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Date</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="size-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-36 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  <div className="w-20 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M6 6h4M6 8.5h3M6 11h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm text-text-secondary dark:text-neutral-500">
                {media.length === 0 ? "Aucun média pour le moment" : "Aucun résultat"}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[1.5fr_80px_80px_60px_100px_100px_80px] gap-3 items-center px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
              >
                <p className="text-sm font-bold text-black dark:text-white truncate">{m.fileName}</p>

                <span className="text-xs font-bold text-black dark:text-white">
                  {MIME_LABELS[m.mimeType] || m.mimeType.split("/")[1]?.toUpperCase() || m.mimeType}
                </span>

                <span className="text-xs font-bold text-black dark:text-white tabular-nums">
                  {formatSize(m.fileSize)}
                </span>

                <span className="text-xs font-bold text-black dark:text-white tabular-nums">
                  v{m.mediaVersion}
                </span>

                <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {STATUS_LABELS[m.conformityStatus] || m.conformityStatus}
                </span>

                <span className="text-xs font-bold text-black dark:text-white">
                  {formatDate(m.createdAt)}
                </span>

                {/* Actions */}
                <div className="flex justify-end relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === m.id ? null : m.id); }}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                    </svg>
                  </button>

                  {openMenuId === m.id && (
                    <div
                      className="absolute right-0 bottom-8 z-40 bg-white dark:bg-neutral-800 border-2 border-black dark:border-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] p-1.5 flex gap-1"
                      style={{ borderRadius: 6 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setDetailMedia(m); setOpenMenuId(null); }}
                        title="Voir les détails"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      {m.conformityStatus === "PENDING" && (
                        <>
                          <button
                            onClick={() => { handleValidate(m.id, true); setOpenMenuId(null); }}
                            title="Approuver"
                            className="flex items-center justify-center size-8 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                          >
                            <svg className="size-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { handleValidate(m.id, false); setOpenMenuId(null); }}
                            title="Rejeter"
                            className="flex items-center justify-center size-8 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <svg className="size-4 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => { setDeleteTarget(m); setOpenMenuId(null); }}
                        title="Supprimer"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <svg className="size-4 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODAL DÉTAIL ===== */}
      {detailMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailMedia(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">Détails du média</h2>
              <button
                onClick={() => setDetailMedia(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg className="size-5 text-primary" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1" />
                    <path d="M2 11l3-3 2 2 3-3 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-black dark:text-white truncate">{detailMedia.fileName}</p>
                  <p className="text-xs text-text-secondary dark:text-neutral-500">Version {detailMedia.mediaVersion}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Type</p>
                  <p className="text-sm font-bold text-black dark:text-white">
                    {MIME_LABELS[detailMedia.mimeType] || detailMedia.mimeType}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Taille</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatSize(detailMedia.fileSize)}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Statut</p>
                  <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                    {STATUS_LABELS[detailMedia.conformityStatus] || detailMedia.conformityStatus}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">Uploadé le</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailMedia.createdAt)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              {detailMedia.conformityStatus === "PENDING" && (
                <>
                  <button
                    onClick={() => { handleValidate(detailMedia.id, true); setDetailMedia(null); }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium active-scale transition-colors cursor-pointer"
                    style={{ borderRadius: 7 }}
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => { handleValidate(detailMedia.id, false); setDetailMedia(null); }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium active-scale transition-colors cursor-pointer"
                    style={{ borderRadius: 7 }}
                  >
                    Rejeter
                  </button>
                </>
              )}
              <button
                onClick={() => setDetailMedia(null)}
                className="tertiary-icon px-3 py-2 active-scale"
              >
                <p className="text-sm font-medium">Fermer</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRESSION ===== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-5 flex flex-col items-center gap-3 text-center">
              <div className="size-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="size-6 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white">Supprimer ce média ?</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.fileName}</span> sera supprimé définitivement.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setDeleteTarget(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">Annuler</p>
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium active-scale disabled:opacity-60 transition-colors cursor-pointer"
                style={{ borderRadius: 7 }}
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
