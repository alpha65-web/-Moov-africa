"use client";

import { useEffect, useState, useRef } from "react";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import { usePermissions, PERM } from "@/lib/permissions";
import MediaPreview from "@/components/MediaPreview";
import ActionMenu from "@/components/ActionMenu";
import type { Offer } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface MediaAsset {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  conformityStatus: string;
  /** Dimensions mesurées au dépôt. 0 quand le type de fichier ne s'y prête pas. */
  width: number;
  height: number;
  /** Densité déclarée par le fichier, en ppp. 0 quand il n'en déclare aucune. */
  resolution: number;
  copyrightRisk: boolean;
  copyrightNotice: string | null;
  /** Constat d'inspection en clair, ce que le chef de service doit pouvoir lire. */
  conformityReport: string | null;
  parentMediaId: string | null;
  mediaVersion: number;
  createdAt: string;
}

/** Une décision prise sur un visuel, dans le circuit de validation graphique. */
interface MediaValidation {
  id: string;
  status: string;
  annotation: string | null;
  mediaType: string;
  validatedById: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  COMPLIANT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  NON_COMPLIANT: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
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

const PER_PAGE = 10;

/**
 * Correspondance vers l'enum AssetMediaType du backend (IMAGE, VIDEO, PDF).
 * Les autres types acceptes a l'upload (documents bureautiques) sont rattaches
 * a PDF, seule valeur documentaire disponible cote circuit de validation.
 */
function assetMediaType(mimeType: string): "IMAGE" | "VIDEO" | "PDF" {
  if (mimeType?.startsWith("image/")) return "IMAGE";
  if (mimeType?.startsWith("video/")) return "VIDEO";
  return "PDF";
}

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function MediaPage() {
  const t = useTranslations("media");
  // MediaAssetController separe deux metiers : le depot et la suppression
  // exigent MEDIA_UPLOAD, la validation de conformite exige MEDIA_VALIDATE.
  // L'ecran proposait les deux a tout le monde : l'analyste marketing, qui ne
  // valide pas, se voyait offrir « Approuver » et « Rejeter ».
  const { has } = usePermissions();
  const canUpload = has(PERM.MEDIA_UPLOAD);

  // Association d'un media a une offre : c'est le coeur du role de l'analyste
  // marketing (cahier des charges l. 104, « depot et association des medias »).
  // L'endpoint POST /media/offers/{offerId}/link existait deja cote serveur,
  // mais aucun ecran ne l'appelait : la mediatheque ignorait jusqu'a l'existence
  // des offres, et le lien ne pouvait donc jamais etre cree.
  const [linkTarget, setLinkTarget] = useState<MediaAsset | null>(null);
  const [linkableOffers, setLinkableOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [primaryVisual, setPrimaryVisual] = useState(false);
  const [linking, setLinking] = useState(false);
  const canValidate = has(PERM.MEDIA_VALIDATE);

  /* ===== CIRCUIT DE VALIDATION GRAPHIQUE ===== */
  const [validationTarget, setValidationTarget] = useState<MediaAsset | null>(null);
  const [validationApproved, setValidationApproved] = useState(true);
  const [validationNote, setValidationNote] = useState("");
  const [validating, setValidating] = useState(false);
  const [detailValidations, setDetailValidations] = useState<MediaValidation[]>([]);
  const [detailVersions, setDetailVersions] = useState<MediaAsset[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const tc = useTranslations("common");

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detailMedia, setDetailMedia] = useState<MediaAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => { loadMedia(); }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (linkTarget) { setLinkTarget(null); return; }
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailMedia) { setDetailMedia(null); return; }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [deleteTarget, detailMedia, linkTarget]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterType]);

  /**
   * Le valideur graphique ouvre sur sa file, comme l'ecran des offres le fait
   * deja pour les acteurs du circuit metier.
   *
   * La mediatheque s'ouvrait sur la totalite des visuels, tous statuts confondus :
   * le chef de service devait retrouver lui-meme, parmi les fichiers deja
   * approuves ou rejetes, ceux qui attendaient sa decision — la seule chose que
   * cet ecran lui demande de faire. Le filtre n'est pose qu'une fois, pour ne pas
   * ecraser un choix fait ensuite par l'utilisateur, et seulement pour un compte
   * qui valide sans deposer : celui qui fait les deux garde la vue complete.
   */
  const validationQueueApplied = useRef(false);
  useEffect(() => {
    if (validationQueueApplied.current) return;
    if (!canValidate || canUpload) return;
    validationQueueApplied.current = true;
    setFilterStatus("PENDING");
  }, [canValidate, canUpload]);

  async function loadMedia() {
    try {
      // GET /media renvoie toute la mediatheque. L'ecran ne chargeait que
      // /media/pending : un media valide disparaissait de la liste, et les
      // compteurs Approuves / Rejetes restaient bloques a zero.
      const { data } = await api.get("/media");
      setMedia(Array.isArray(data) ? data : data.content ?? []);
    }
    catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("messages.fileTooLarge"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(t("messages.uploaded"));
      loadMedia();
    } catch (e) {
      toast.error(apiError(e, tc("errors.create")));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /**
   * Le circuit graphique attend { status, mediaType, annotation } et non un simple
   * booleen : l'ecran envoyait { approved } et l'appel echouait systematiquement en 400.
   */
  /**
   * Décision du chef de service sur un visuel.
   *
   * L'annotation vient désormais de lui. L'écran la fabriquait à partir d'un
   * libellé générique (« Média approuvé » / « Média rejeté ») : la base stockait
   * des commentaires d'apparence humaine qui ne renseignaient personne, alors que
   * le cahier des charges (7.6) demande une annotation détaillée et confie à
   * l'analyste la charge de corriger. Un rejet sans motif est refusé par le
   * serveur, et l'écran n'en propose donc pas.
   */
  async function submitValidation() {
    if (!validationTarget || validating) return;
    if (validationApproved === false && !validationNote.trim()) {
      toast.error(t("validation.reasonRequired"));
      return;
    }
    setValidating(true);
    try {
      await api.post(`/media/${validationTarget.id}/validate`, {
        status: validationApproved ? "APPROVED" : "REJECTED",
        mediaType: assetMediaType(validationTarget.mimeType),
        annotation: validationNote.trim() || null,
      });
      toast.success(validationApproved ? t("messages.approved") : t("messages.rejected"));
      setValidationTarget(null);
      setValidationNote("");
      setDetailMedia(null);
      loadMedia();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally {
      setValidating(false);
    }
  }

  /**
   * Ouvre la fiche d'un visuel avec son contexte de circuit.
   *
   * Les décisions passées et la chaîne des versions se chargent avec la fiche :
   * juger une correction suppose de voir ce qui avait été reproché, et l'analyste
   * qui vient corriger doit lire le motif du rejet.
   */
  function openDetail(media: MediaAsset) {
    setDetailMedia(media);
    setDetailValidations([]);
    setDetailVersions([]);
    loadMediaContext(media.id);
  }

  function openValidation(media: MediaAsset, approved: boolean) {
    setValidationTarget(media);
    setValidationApproved(approved);
    setValidationNote("");
  }

  /**
   * Historique et chaîne de versions du visuel ouvert.
   *
   * Les deux se chargent ensemble : juger une correction suppose de voir à la
   * fois ce qui avait été reproché et ce à quoi ressemblait la version rejetée.
   */
  async function loadMediaContext(mediaId: string) {
    setContextLoading(true);
    try {
      const [validations, versions] = await Promise.all([
        api.get(`/media/${mediaId}/validations`),
        api.get(`/media/${mediaId}/versions`),
      ]);
      setDetailValidations(validations.data ?? []);
      setDetailVersions(versions.data ?? []);
    } catch {
      setDetailValidations([]);
      setDetailVersions([]);
    } finally {
      setContextLoading(false);
    }
  }

  /**
   * Redépôt d'un visuel corrigé, chaîné sur celui qu'il remplace.
   *
   * Passer par l'upload ordinaire créerait un média orphelin : le chef de service
   * n'aurait aucun moyen de rapprocher la correction du visuel qu'il avait rejeté.
   */
  async function handleRevision(media: MediaAsset, file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      await api.post(`/media/${media.id}/revision`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(t("validation.revisionUploaded"));
      setDetailMedia(null);
      loadMedia();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    }
  }

  /**
   * Ouverture du choix d'offre.
   *
   * Les offres ne sont chargees qu'a ce moment : la mediatheque n'en a besoin que
   * pour cette action, et un role sans MEDIA_UPLOAD ne la declenche jamais. Seules
   * les fiches encore ouvertes a l'enrichissement sont proposees, car le serveur
   * fige la fiche au-dela et le lien n'aurait plus de sens.
   */
  async function openLinkModal(media: MediaAsset) {
    setLinkTarget(media);
    setSelectedOfferId("");
    setPrimaryVisual(false);
    setOpenMenuId(null);
    try {
      const { data } = await api.get("/offers", { params: { size: 500 } });
      const all: Offer[] = data.content ?? data;
      setLinkableOffers(all.filter((o) => o.status === "DRAFT" || o.status === "IN_ENRICHMENT"));
    } catch (e) {
      toast.error(apiError(e, tc("errors.load")));
      setLinkableOffers([]);
    }
  }

  async function handleLink() {
    if (!linkTarget || !selectedOfferId || linking) return;
    setLinking(true);
    try {
      await api.post(`/media/offers/${selectedOfferId}/link`, {
        mediaAssetId: linkTarget.id,
        isPrimary: primaryVisual,
        displayOrder: 0,
      });
      toast.success(t("messages.linked"));
      setLinkTarget(null);
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally {
      setLinking(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/media/${deleteTarget.id}`); toast.success(t("messages.deleted")); loadMedia(); }
    catch (e) { toast.error(apiError(e, tc("errors.delete"))); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / 1048576).toFixed(1) + " Mo";
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = media.filter((m) => {
    if (search && !m.fileName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && m.conformityStatus !== filterStatus) return false;
    if (filterType && m.mimeType !== filterType) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = {
    total: media.length,
    pending: media.filter((m) => m.conformityStatus === "PENDING").length,
    approved: media.filter((m) => m.conformityStatus === "COMPLIANT").length,
    rejected: media.filter((m) => m.conformityStatus === "NON_COMPLIANT").length,
  };

  const cardData = [
    { key: "total", count: stats.total, label: t("stats.total"), link: t("stats.viewAll"), filterValue: "", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" /></svg>
    ) },
    { key: "pending", count: stats.pending, label: t("stats.pending"), link: t("stats.viewPending"), filterValue: "PENDING", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
    { key: "approved", count: stats.approved, label: t("stats.approved"), link: t("stats.viewApproved"), filterValue: "COMPLIANT", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M12 2a5 5 0 015 5v1H7V7a5 5 0 015-5z" stroke="currentColor" strokeWidth="1.5" /><path d="M4 8h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M9 13l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
    { key: "rejected", count: stats.rejected, label: t("stats.rejected"), link: t("stats.viewRejected"), filterValue: "NON_COMPLIANT", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ) },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadMedia} className="secondary-icon px-4 py-2.5 active-scale">
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M2 8a6 6 0 0111.5-2.3M14 8a6 6 0 01-11.5 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M13.5 2v3.7h-3.7M2.5 14v-3.7h3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium">{t("refresh")}</p>
            </span>
          </button>
          {canUpload && (
            <label className="primary-icon px-4 py-2.5 active-scale cursor-pointer">
              <span className="flex items-center gap-2">
                <svg className="size-4" viewBox="0 0 16 16" fill="none">
                  <path d="M8 10V3M8 3l3 3M8 3L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm font-medium">{uploading ? t("uploadForm.uploading") : t("upload")}</p>
              </span>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,application/pdf,video/mp4" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardData.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.filterValue)}
            className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card text-left cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${s.bg} ${s.color}`}>{s.icon}</div>
              <span className="text-sm font-medium text-text-secondary dark:text-neutral-400">{s.label}</span>
            </div>
            {loading ? <Skeleton className="w-10 h-8 mb-2" /> : (
              <span className="text-3xl font-bold text-black dark:text-white tabular-nums block mb-2">{s.count}</span>
            )}
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              {s.link}
              <svg className="size-3" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
        ))}
      </div>

      {/* ===== RECHERCHE + FILTRES ===== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={searchKeyHandler(setSearch)} placeholder={t("searchPlaceholder")} className="input w-full h-10 pl-9" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allStatuses")}</option>
          <option value="PENDING">{t("status.PENDING")}</option>
          <option value="COMPLIANT">{t("status.COMPLIANT")}</option>
          <option value="NON_COMPLIANT">{t("status.NON_COMPLIANT")}</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allTypes")}</option>
          {[...new Set(media.map((m) => m.mimeType))].sort().map((mime) => (
            <option key={mime} value={mime}>{MIME_LABELS[mime] ?? mime}</option>
          ))}
        </select>
      </div>

      {/* ===== LISTE =====
          Une mediatheque se juge sur ses visuels, mais elle se parcourt comme une
          liste : la grille de cartes obligeait a defiler longuement pour comparer
          quelques fichiers, chaque carte occupant la hauteur d'un apercu en 16/9.
          Chaque media tient desormais sur une ligne, la vignette a gauche puis ses
          caracteristiques en colonnes — on reconnait le visuel sans l'ouvrir, et on
          en embrasse une dizaine d'un coup d'oeil.

          La vignette est un carre arrondi et non un disque : un disque rognerait
          les bords d'une banniere ou d'un logo horizontal, precisement ce qu'il
          s'agit de reconnaitre. */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[64px_1fr_110px_130px_150px_110px_50px] gap-3 px-6 py-3 bg-slate-800 dark:bg-slate-900 rounded-t-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.file")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.type")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.status")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.size")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.date")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white text-right">{t("columns.actions")}</span>
        </div>
        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr_110px_130px_150px_110px_50px] gap-3 items-center py-3">
                <Skeleton className="size-12 !rounded-lg" />
                <Skeleton className="w-40 h-4" />
                <Skeleton className="w-16 h-5 !rounded-md" />
                <Skeleton className="w-20 h-5 !rounded-md" />
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-36" viewBox="0 0 160 140" fill="none">
                {/* Nuages décoratifs */}
                <ellipse cx="28" cy="40" rx="12" ry="5" className="fill-blue-100/60 dark:fill-blue-900/15" />
                <ellipse cx="138" cy="30" rx="9" ry="4" className="fill-blue-100/50 dark:fill-blue-900/10" />
                {/* Dossier */}
                <path d="M30 50h100a5 5 0 015 5v55a5 5 0 01-5 5H30a5 5 0 01-5-5V55a5 5 0 015-5z" className="fill-sky-50 dark:fill-sky-900/10 stroke-sky-200 dark:stroke-sky-800/40" strokeWidth="1.5" />
                <path d="M25 55V48a5 5 0 015-5h25l5 7h65a5 5 0 015 5v0" className="stroke-sky-300 dark:stroke-sky-700/50" strokeWidth="1.5" strokeLinejoin="round" />
                {/* Image placeholder 1 */}
                <rect x="42" y="62" width="32" height="26" rx="3" className="fill-white dark:fill-neutral-800 stroke-sky-200 dark:stroke-sky-700/40" strokeWidth="1.2" />
                <circle cx="50" cy="70" r="3" className="fill-amber-300/50" />
                <path d="M42 82l8-6 5 4 7-8 12 10" className="stroke-emerald-400/50" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Document placeholder 2 */}
                <rect x="82" y="62" width="32" height="26" rx="3" className="fill-white dark:fill-neutral-800 stroke-sky-200 dark:stroke-sky-700/40" strokeWidth="1.2" />
                <path d="M88 70h20M88 75h14M88 80h8" className="stroke-sky-200 dark:stroke-sky-700/40" strokeWidth="1.5" strokeLinecap="round" />
                {/* Icone upload */}
                <circle cx="108" cy="42" r="14" className="fill-primary/10 stroke-primary/30" strokeWidth="1.5" />
                <path d="M108 48V36M108 36l4 4M108 36l-4 4" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Petits éléments déco */}
                <circle cx="22" cy="70" r="2.5" className="fill-primary/20" />
                <circle cx="142" cy="60" r="2" className="fill-emerald-400/25" />
                <path d="M40 35l1.5 3 3 .5-2 2.5.3 3.2-2.8-1.5-2.8 1.5.3-3.2-2-2.5 3-.5L40 35z" className="fill-amber-300/30 dark:fill-amber-400/15" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("emptyTitle")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
              {canUpload && (
                <label className="primary-icon px-5 py-2.5 active-scale mt-1 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <svg className="size-4" viewBox="0 0 16 16" fill="none">
                      <path d="M8 10V3M8 3l3 3M8 3L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-sm font-medium">{t("uploadFirst")}</p>
                  </span>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,application/pdf,video/mp4" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((m) => (
              <div key={m.id} className="grid grid-cols-[64px_1fr_40px] md:grid-cols-[64px_1fr_110px_130px_150px_110px_50px] gap-3 items-center px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer" onClick={() => openDetail(m)}>
                <MediaPreview mediaId={m.id} mimeType={m.mimeType} fileName={m.fileName} className="size-12 border border-border dark:border-neutral-800" />
                <div className="min-w-0 flex flex-col gap-1">
                  <p className="text-sm font-semibold text-black dark:text-white truncate" title={m.fileName}>{m.fileName}</p>
                  {/* Sous le nom, les caracteristiques qui n'ont pas leur colonne
                      sur ecran etroit : la ligne reste lisible sans defilement
                      horizontal. */}
                  <div className="flex items-center gap-1.5 flex-wrap md:hidden">
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      {MIME_LABELS[m.mimeType] || m.mimeType.split("/")[1]?.toUpperCase() || m.mimeType}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[m.conformityStatus] ?? STATUS_STYLES.PENDING}`}>
                      {t(`status.${m.conformityStatus}`)}
                    </span>
                    {/* Le risque de droits se voit sur la vignette : le chef de
                        service doit repérer les visuels à vérifier sans avoir à
                        ouvrir chaque fiche une par une. */}
                    {m.copyrightRisk && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title={m.copyrightNotice ?? undefined}>
                        <svg className="size-3" viewBox="0 0 20 20" fill="none"><path d="M10 3l7 13H3l7-13z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M10 8v3.5M10 13.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                        {t("copyright.badge")}
                      </span>
                    )}
                  </div>
                  <span className="md:hidden text-[11px] text-text-secondary dark:text-neutral-500 tabular-nums">
                    {formatSize(m.fileSize)} · v{m.mediaVersion}
                    {m.width > 0 && ` · ${m.width}×${m.height}`} · {formatDate(m.createdAt)}
                  </span>
                </div>

                {/* Colonnes propres a l'ecran large. Elles disparaissent en
                    dessous, ou leur contenu se replie sous le nom du fichier. */}
                <span className="hidden md:inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {MIME_LABELS[m.mimeType] || m.mimeType.split("/")[1]?.toUpperCase() || m.mimeType}
                </span>
                <div className="hidden md:flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[m.conformityStatus] ?? STATUS_STYLES.PENDING}`}>
                    {t(`status.${m.conformityStatus}`)}
                  </span>
                  {/* Le risque de droits se voit sur la ligne : le chef de service
                      doit reperer les visuels a verifier sans ouvrir chaque fiche
                      une par une. */}
                  {m.copyrightRisk && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title={m.copyrightNotice ?? t("copyright.badge")}>
                      <svg className="size-3" viewBox="0 0 20 20" fill="none"><path d="M10 3l7 13H3l7-13z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M10 8v3.5M10 13.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                    </span>
                  )}
                </div>
                <span className="hidden md:block text-xs text-text-secondary dark:text-neutral-400 tabular-nums">
                  {formatSize(m.fileSize)} · v{m.mediaVersion}
                  {m.width > 0 && <span className="block text-[11px] text-neutral-400 dark:text-neutral-500">{m.width}×{m.height}</span>}
                </span>
                <span className="hidden md:block text-xs text-text-secondary dark:text-neutral-400">{formatDate(m.createdAt)}</span>

                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                    <svg className="size-4 text-neutral-600 dark:text-neutral-300" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="13" r="1.2" fill="currentColor" /></svg>
                  </button>
                  <ActionMenu open={openMenuId === m.id} onClose={() => setOpenMenuId(null)} minWidth={160}>
                      <button onClick={() => { openDetail(m); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        {t("actions.details")}
                      </button>
                      {canUpload && (
                        <button onClick={() => openLinkModal(m)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-.7.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M9.5 6.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l.7-.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                          {t("actions.linkToOffer")}
                        </button>
                      )}
                      {canValidate && m.conformityStatus === "PENDING" && (
                        <>
                          <button onClick={() => { openValidation(m, true); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                            <svg className="size-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            {t("actions.approve")}
                          </button>
                          <button onClick={() => { openValidation(m, false); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <svg className="size-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                            {t("actions.reject")}
                          </button>
                        </>
                      )}
                      {canUpload && (
                        <button onClick={() => { setDeleteTarget(m); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          {tc("delete")}
                        </button>
                      )}
                  </ActionMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length > PER_PAGE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/20">
            <span className="text-xs text-text-secondary dark:text-neutral-500 tabular-nums">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="size-8 rounded-lg border border-border dark:border-neutral-700 flex items-center justify-center text-xs text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed">
                <svg className="size-3.5" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5l-4 3.5 4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`size-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${page === p ? "bg-primary text-white" : "border border-border dark:border-neutral-700 text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="size-8 rounded-lg border border-border dark:border-neutral-700 flex items-center justify-center text-xs text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed">
                <svg className="size-3.5" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== MODAL DÉTAIL ===== */}
      {detailMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDetailMedia(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="size-5" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" /><circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1" /><path d="M2 11l3-3 2 2 3-3 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-black dark:text-white truncate">{detailMedia.fileName}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-500">Version {detailMedia.mediaVersion}</p>
                </div>
              </div>
              <button onClick={() => setDetailMedia(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* La fiche affiche le contenu reel, pas une icone : le chef de
                  service doit juger le format, la resolution et les droits du
                  visuel (7.6), ce qu'il ne peut pas faire sans le voir. La video
                  s'y lit et le PDF s'y feuillette. */}
              <MediaPreview
                mediaId={detailMedia.id}
                mimeType={detailMedia.mimeType}
                fileName={detailMedia.fileName}
                playable
                className="w-full h-56 border border-border dark:border-neutral-800"
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.type")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{MIME_LABELS[detailMedia.mimeType] || detailMedia.mimeType}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.size")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatSize(detailMedia.fileSize)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.status")}</p>
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[detailMedia.conformityStatus]}`}>
                    {t(`status.${detailMedia.conformityStatus}`)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.date")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailMedia.createdAt)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.resolution")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">
                    {detailMedia.width > 0
                      ? `${detailMedia.width} × ${detailMedia.height} px` +
                        (detailMedia.resolution > 0 ? ` · ${detailMedia.resolution} ppp` : "")
                      : t("notMeasurable")}
                  </p>
                </div>
              </div>

              {/* Constat d'inspection.
                  Le chef de service doit juger « le format, la résolution et les
                  droits d'auteur » du visuel (cahier des charges 7.6). Il ne
                  disposait que du statut de conformité, sans savoir ce qui
                  l'avait produit : il jugeait à l'œil nu. */}
              {detailMedia.copyrightRisk && (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                  <svg className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3l7 13H3l7-13z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M10 8v3.5M10 13.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t("copyright.riskTitle")}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 break-words">
                      {t("copyright.riskDetail", { notice: detailMedia.copyrightNotice ?? "" })}
                    </p>
                  </div>
                </div>
              )}

              {/* Circuit de validation graphique.
                  Le chef de service doit revoir ses avis passés avant de juger
                  une correction, et l'analyste doit lire le motif du rejet pour
                  savoir quoi corriger. Ces décisions étaient écrites en base
                  sans qu'aucun écran ne les affiche. */}
              {contextLoading ? (
                <Skeleton className="w-full h-16" />
              ) : (
                <>
                  {detailVersions.length > 1 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                        {t("validation.versions", { count: detailVersions.length })}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {[detailVersions[detailVersions.length - 2], detailVersions[detailVersions.length - 1]].map((version, i) => (
                          <div key={version.id} className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">
                              {i === 0 ? t("validation.before") : t("validation.after")} · v{version.mediaVersion}
                            </span>
                            <MediaPreview
                              mediaId={version.id}
                              mimeType={version.mimeType}
                              fileName={version.fileName}
                              className="w-full h-28 border border-border dark:border-neutral-800"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailValidations.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                        {t("validation.history")}
                      </p>
                      <div className="flex flex-col gap-2">
                        {detailValidations.map((decision) => (
                          <div key={decision.id} className="flex gap-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2.5">
                            <span className={`shrink-0 self-start inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                              decision.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            }`}>
                              {t(`validation.status.${decision.status}`)}
                            </span>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {decision.annotation ? (
                                <p className="text-xs text-primary dark:text-neutral-200 break-words">{decision.annotation}</p>
                              ) : (
                                <p className="text-xs italic text-neutral-400 dark:text-neutral-600">{t("validation.noReason")}</p>
                              )}
                              <span className="text-[11px] text-text-secondary dark:text-neutral-500">
                                {formatDate(decision.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {detailMedia.conformityReport && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("conformityReport")}</p>
                  <ul className="flex flex-col gap-1">
                    {detailMedia.conformityReport.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i} className="text-xs text-text-secondary dark:text-neutral-400 flex gap-2">
                        <span className="text-neutral-400 dark:text-neutral-600">·</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              {canValidate && detailMedia.conformityStatus === "PENDING" && (
                <>
                  <button onClick={() => { openValidation(detailMedia, true); }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg active-scale transition-colors cursor-pointer">
                    {t("actions.approve")}
                  </button>
                  <button onClick={() => { openValidation(detailMedia, false); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg active-scale transition-colors cursor-pointer">
                    {t("actions.reject")}
                  </button>
                </>
              )}
              {/* Redépôt d'un visuel corrigé, chaîné sur celui qu'il remplace.
                  Le cahier des charges (7.6) confie cette correction à l'analyste
                  marketing, pas au chef de service qui a rejeté. */}
              {canUpload && detailMedia.conformityStatus === "NON_COMPLIANT" && (
                <label className="px-4 py-2 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg active-scale transition-opacity cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleRevision(detailMedia, file);
                      e.target.value = "";
                    }}
                  />
                  {t("validation.redeposit")}
                </label>
              )}
              <button onClick={() => setDetailMedia(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("close")}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL ASSOCIATION A UNE OFFRE ===== */}
      {linkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setLinkTarget(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">{t("link.title")}</h2>
              <button onClick={() => setLinkTarget(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.file")}</p>
                <p className="text-sm font-semibold text-black dark:text-white mt-0.5 truncate">{linkTarget.fileName}</p>
              </div>

              {linkableOffers.length === 0 ? (
                /* Aucune offre ouverte a l'enrichissement : on le dit, plutot que
                   de presenter une liste vide et un bouton sans effet. */
                <p className="text-sm text-text-secondary dark:text-neutral-500 leading-relaxed">{t("link.noOffer")}</p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("link.offer")}</label>
                    <select value={selectedOfferId} onChange={(e) => setSelectedOfferId(e.target.value)} className="input w-full h-10">
                      <option value="">{t("link.choose")}</option>
                      {linkableOffers.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={primaryVisual} onChange={(e) => setPrimaryVisual(e.target.checked)} className="size-4 accent-primary" />
                    <span className="text-sm text-black dark:text-white">{t("link.primary")}</span>
                  </label>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setLinkTarget(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("cancel")}</p>
              </button>
              <button onClick={handleLink} disabled={!selectedOfferId || linking} className="primary-icon px-5 py-2 active-scale disabled:opacity-60">
                <span className="flex items-center gap-2">
                  {linking && <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  <p className="text-sm font-medium">{linking ? tc("saving") : t("link.confirm")}</p>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL SUPPRESSION ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
              <div className="size-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="size-7 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white">{t("messages.deleteConfirm")}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1.5">
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.fileName}</span> — {t("messages.deleteWarning")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setDeleteTarget(null)} className="tertiary-icon px-4 py-2 active-scale"><p className="text-sm font-medium">{tc("cancel")}</p></button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg active-scale disabled:opacity-60 transition-colors cursor-pointer">
                {deleting ? tc("deleting") : tc("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALE : DÉCISION DU CHEF DE SERVICE =====
           L'annotation vient de lui. L'écran l'inventait auparavant à partir
           d'un libellé générique : la base gardait des commentaires d'apparence
           humaine qui ne disaient rien à l'analyste chargé de corriger. */}
      {validationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setValidationTarget(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">
                {validationApproved ? t("validation.approveTitle") : t("validation.rejectTitle")}
              </h2>
              <button onClick={() => setValidationTarget(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <MediaPreview
                  mediaId={validationTarget.id}
                  mimeType={validationTarget.mimeType}
                  fileName={validationTarget.fileName}
                  className="size-16 shrink-0 border border-border dark:border-neutral-800"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white truncate">{validationTarget.fileName}</p>
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">
                    {t(`validation.mediaTypes.${assetMediaType(validationTarget.mimeType)}`)}
                    {validationTarget.width > 0 && ` · ${validationTarget.width} × ${validationTarget.height} px`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                  {validationApproved ? t("validation.noteOptional") : t("validation.noteRequired")}
                </label>
                <textarea
                  value={validationNote}
                  onChange={(e) => setValidationNote(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder={validationApproved
                    ? t(`validation.approvePlaceholder.${assetMediaType(validationTarget.mimeType)}`)
                    : t(`validation.rejectPlaceholder.${assetMediaType(validationTarget.mimeType)}`)}
                  className="input w-full resize-y text-sm"
                />
                {!validationApproved && (
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">
                    {t("validation.reasonHelp")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setValidationTarget(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("cancel")}</p>
              </button>
              <button
                onClick={submitValidation}
                disabled={validating || (!validationApproved && !validationNote.trim())}
                className={`px-5 py-2 text-white text-sm font-medium rounded-lg active-scale transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  validationApproved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {validating ? tc("saving") : validationApproved ? t("actions.approve") : t("actions.reject")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
