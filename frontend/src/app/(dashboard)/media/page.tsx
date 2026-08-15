"use client";

import { useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Upload, Image as ImageIcon, CheckCircle, XCircle } from "lucide-react";

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

export default function MediaPage() {
  const [pendingMedia, setPendingMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadPending() {
    setLoading(true);
    try {
      const { data } = await api.get("/media/pending");
      setPendingMedia(data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Media uploade (simule)");
      loadPending();
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleValidate(id: string, approved: boolean) {
    try {
      await api.post(`/media/${id}/validate`, {
        approved,
        annotation: approved ? "Conforme" : "Non conforme",
      });
      toast.success(approved ? "Media approuve" : "Media rejete");
      loadPending();
    } catch {
      toast.error("Erreur de validation");
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Medias (DAM)
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload et validation des visuels marketing
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadPending}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
          >
            Charger en attente
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            {uploading ? "Upload..." : "Uploader"}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Chargement...
          </div>
        ) : pendingMedia.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <ImageIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p>
              Cliquez sur &quot;Charger en attente&quot; pour voir les medias a
              valider
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pendingMedia.map((media) => (
              <div
                key={media.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                    <ImageIcon className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {media.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {media.mimeType} - {formatSize(media.fileSize)} - v
                      {media.mediaVersion}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      media.conformityStatus === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : media.conformityStatus === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {media.conformityStatus}
                  </span>
                  {media.conformityStatus === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleValidate(media.id, true)}
                        className="rounded-lg p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        title="Approuver"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleValidate(media.id, false)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Rejeter"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
