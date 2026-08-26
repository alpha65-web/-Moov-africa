"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import { usePermissions, PERM, queueStatusesFor } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import MediaPreview from "@/components/MediaPreview";
import type { Offer, OfferStatus } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import CategoryPicker from "@/components/CategoryPicker";

const PER_PAGE = 10;

const ALLOWED_TRANSITIONS: Record<string, OfferStatus[]> = {
  DRAFT: ["IN_ENRICHMENT"],
  IN_ENRICHMENT: ["IN_VALIDATION", "DRAFT"],
  IN_VALIDATION: ["VALIDATED", "IN_ENRICHMENT"],
  VALIDATED: ["PLANNED", "PUBLISHED"],
  PLANNED: ["PUBLISHED", "SUSPENDED"],
  PUBLISHED: ["SUSPENDED", "OBSOLETE", "WITHDRAWN"],
  SUSPENDED: ["PUBLISHED", "WITHDRAWN"],
  OBSOLETE: ["ARCHIVED"],
  WITHDRAWN: ["ARCHIVED"],
};

/**
 * Permissions admises pour atteindre un statut, en miroir de
 * OfferService.permissionsFor cote serveur. Le circuit refuse depuis qu'une
 * transition exige sa propre permission : proposer un bouton que le serveur
 * refusera afficherait une panne la ou la regle s'applique normalement.
 */
function permissionsForTransition(from: string, target: OfferStatus): string[] {
  switch (target) {
    case "DRAFT":
      return ["OFFER_SUBMIT", "OFFER_ENRICH"];
    case "IN_ENRICHMENT":
      return from === "IN_VALIDATION" ? ["OFFER_VALIDATE"] : ["OFFER_SUBMIT"];
    case "IN_VALIDATION":
      return ["OFFER_SUBMIT"];
    case "VALIDATED":
      return ["OFFER_VALIDATE"];
    default:
      return ["OFFER_PUBLISH"];
  }
}

const EMPTY_FORM = {
  name: "",
  /**
   * Categorie ou sous-categorie de type OFFRE.
   *
   * L'offre commerciale est le type OFFRE de la classification
   * TYPE -> CATEGORIE -> SOUS-CATEGORIE -> ELEMENT : « Smart 1 Go » se range sous
   * Internet mobile / Forfaits Data. Le champ n'existait pas, une offre n'etait
   * donc classee nulle part et restait introuvable par type ou par categorie.
   */
  categoryId: "",
  shortDescription: "",
  longDescription: "",
  seoTitle: "",
  seoDescription: "",
  promotionalPrice: "",
  currency: "XOF",
  targetSegment: "",
  customerType: "",
  legalMentions: "",
};

/**
 * Statuts sur lesquels le serveur accepte un enrichissement.
 * OfferService.enrich refuse au-dela : proposer l'action sur une offre deja
 * soumise afficherait une erreur la ou la regle metier s'applique normalement.
 */
const ENRICHABLE_STATUSES: OfferStatus[] = ["DRAFT", "IN_ENRICHMENT"];

/**
 * Statuts ou les champs commerciaux restent modifiables, en miroir de
 * OfferService.COMMERCIALLY_EDITABLE. Au-dela de VALIDEE, la decision a ete prise
 * sur ces valeurs : le serveur refuse, l'action ne doit donc pas etre proposee.
 */
const COMMERCIALLY_EDITABLE: OfferStatus[] = ["DRAFT", "IN_ENRICHMENT", "IN_VALIDATION"];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  IN_ENRICHMENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_VALIDATION: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  VALIDATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PLANNED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  PUBLISHED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  SUSPENDED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  OBSOLETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  WITHDRAWN: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  ARCHIVED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500",
};

/** Media rattache a une offre, tel que renvoye par GET /media/offers/{id}. */
interface OfferMedia {
  id: string;
  fileName: string;
  mimeType: string;
  conformityStatus: string;
}

const STATUS_KEYS: OfferStatus[] = ["DRAFT", "IN_ENRICHMENT", "IN_VALIDATION", "VALIDATED", "PLANNED", "PUBLISHED", "SUSPENDED", "OBSOLETE", "WITHDRAWN", "ARCHIVED"];

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

export default function OffersPage() {
  const t = useTranslations("offers");
  const tc = useTranslations("common");
  const tclass = useTranslations("classification");
  const { has, hasAny } = usePermissions();
  // Le tableau de bord renvoie ici avec un statut deja choisi : ses chiffres
  // n'etaient jusqu'ici que du texte, sans destination.
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status");

  // Une action ne s'affiche que si la permission exigee par l'endpoint qu'elle
  // appelle est detenue : POST /offers exige OFFER_CREATE, PATCH /enrich exige
  // OFFER_ENRICH, DELETE /offers/{id} exige OFFER_CREATE.
  const canCreate = has(PERM.OFFER_CREATE);

  /**
   * Role de diffusion, sans part au cycle de vie — le community manager.
   *
   * Le cahier des charges (l. 107) borne son acces a la « consultation des offres
   * publiees ». Il voyait pourtant l'integralite du catalogue, brouillons des
   * autres acteurs compris, avec les pastilles de tous les statuts du circuit.
   */
  const isDiffusionOnly = !hasAny(
    PERM.OFFER_CREATE, PERM.OFFER_SUBMIT, PERM.OFFER_ENRICH,
    PERM.OFFER_VALIDATE, PERM.OFFER_PUBLISH);
  const canEnrich = has(PERM.OFFER_ENRICH);
  const canDelete = has(PERM.OFFER_CREATE);
  // Repartir le travail entre analystes revient au chef de service.
  const canAssign = has(PERM.OFFER_ASSIGN);
  // Mettre sur le marche : c'est a ce moment que les mentions legales se verifient.
  const canPublish = has(PERM.OFFER_PUBLISH);

  // Sert a distinguer « qui m'est confiee » de « confiee a un collegue » sans
  // avoir a resoudre le nom de l'analyste : un analyste n'a pas acces a
  // l'annuaire, et n'a pas besoin d'y acceder pour reconnaitre ses propres fiches.
  const { user } = useAuth();
  const myId = user?.id ?? null;

  // Vide pour un role purement consultatif : la pastille « A traiter »
  // disparait alors au lieu de proposer une file toujours nulle.
  const queueStatuses = queueStatusesFor(has);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Le statut demande par l'URL est connu des le premier rendu : il sert donc
  // d'etat initial, plutot que d'etre applique apres coup par un effet.
  const [filterStatus, setFilterStatus] = useState(requestedStatus ?? "ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Trois formulaires distincts sur la meme fiche, chacun adosse a son endpoint :
  //   create -> POST /offers          (chef de produit)
  //   update -> PATCH /offers/{id}    (chef de produit, champs commerciaux)
  //   enrich -> PATCH /offers/{id}/enrich (analyste marketing, editorial et SEO)
  const [modalMode, setModalMode] = useState<"create" | "update" | "enrich" | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  // Visuels de la fiche en cours d'enrichissement, et bibliotheque disponible.
  // L'association se faisait uniquement depuis l'ecran Medias : l'analyste qui
  // enrichissait une offre n'avait aucun moyen de voir, depuis son formulaire,
  // ou ajouter un visuel — c'est pourtant le moment ou il en a besoin.
  const [enrichMedia, setEnrichMedia] = useState<OfferMedia[]>([]);
  const [libraryMedia, setLibraryMedia] = useState<OfferMedia[]>([]);
  const [pickedMediaId, setPickedMediaId] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Offer | null>(null);
  // Analystes marketing avec leur charge du moment. Les deux compteurs viennent
  // du serveur et sont comptes sur les offres reellement affectees : le chef de
  // service repartit « en fonction de leur disponibilite », il lui faut donc
  // savoir qui est deja pris. Une liste de noms seule ne le permettait pas.
  const [analysts, setAnalysts] = useState<{
    id: string; firstName: string; lastName: string;
    activeCount: number; totalCount: number;
  }[]>([]);
  const [pickedAnalystId, setPickedAnalystId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailOffer, setDetailOffer] = useState<Offer | null>(null);
  // Visuels rattaches a la fiche consultee. Sans eux, l'analyste marketing
  // associait un media sans jamais en voir la trace, et le valideur se
  // prononcait sur une offre dont il ne voyait pas l'habillage.
  // La reponse est conservee avec l'identifiant de l'offre a laquelle elle
  // appartient : sans cela, l'ouverture d'une seconde fiche affichait un instant
  // les visuels de la precedente, le temps de la requete.
  const [detailMedia, setDetailMedia] = useState<{ offerId: string; items: OfferMedia[] } | null>(null);
  /**
   * Parcours de la fiche : chaque transition, son auteur, sa date et son motif.
   *
   * offer_status_history etait alimentee a chaque transition depuis l'origine,
   * mais aucun ecran ne la lisait. Consequence directe : le commentaire qu'un
   * chef de service est *oblige* de saisir pour rejeter une offre n'etait visible
   * nulle part. Le chef de produit voyait sa fiche revenir sans savoir pourquoi,
   * et devait le demander de vive voix — ce que le circuit est precisement cense
   * eviter.
   */
  const [detailHistory, setDetailHistory] = useState<{
    offerId: string;
    entries: {
      id: string; fromStatus: string | null; toStatus: string;
      comment: string | null; changedByName: string | null; createdAt: string;
    }[];
  } | null>(null);
  const [transitionOffer, setTransitionOffer] = useState<Offer | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isEnriching = modalMode === "enrich";
  const isUpdating = modalMode === "update";

  useEffect(() => { loadOffers(); }, []);

  // Les permissions arrivent avec le profil, apres le premier rendu : le filtre
  // par defaut ne peut donc pas etre calcule dans le useState initial. On ouvre
  // sur la file d'attente du role des qu'elle est connue, une seule fois, pour
  // ne pas ecraser un filtre choisi ensuite par l'utilisateur.
  const queueApplied = useRef(false);
  useEffect(() => {
    // Un statut demande dans l'URL prime sur la file du role : la personne vient
    // de cliquer dessus, le remplacer par sa file reviendrait a ignorer son geste.
    if (requestedStatus) { queueApplied.current = true; return; }
    if (queueApplied.current || queueStatuses.length === 0) return;
    queueApplied.current = true;
    setFilterStatus("QUEUE");
  }, [queueStatuses.length, requestedStatus]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (assignTarget) { setAssignTarget(null); return; }
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (transitionOffer) { setTransitionOffer(null); setTransitionComment(""); return; }
        if (detailOffer) { setDetailOffer(null); return; }
        if (modalMode) { setModalMode(null); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [modalMode, deleteTarget, detailOffer, transitionOffer, assignTarget]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => { setPage(1); }, [search, filterStatus, dateFrom, dateTo]);

  // Le chef de service charge une fois la liste des analystes : elle sert a la
  // fois a nommer l'affectataire dans la liste et a remplir la modale.
  useEffect(() => {
    if (!canAssign) return;
    let cancelled = false;
    api.get("/offers/enrichers")
      .then(({ data }) => { if (!cancelled) setAnalysts(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setAnalysts([]); });
    return () => { cancelled = true; };
  }, [canAssign]);

  // Les visuels sont charges a l'ouverture de la fiche : ils ne servent qu'a cet
  // ecran, et la liste des offres n'a pas a payer une requete par ligne.
  useEffect(() => {
    if (!detailOffer) return;
    const offerId = detailOffer.id;
    let cancelled = false;
    api.get(`/media/offers/${offerId}`)
      .then(({ data }) => { if (!cancelled) setDetailMedia({ offerId, items: Array.isArray(data) ? data : [] }); })
      .catch(() => { if (!cancelled) setDetailMedia({ offerId, items: [] }); });

    // Le parcours de la fiche est charge en meme temps que ses visuels : les deux
    // repondent a la meme question — sur quoi le valideur se prononce-t-il.
    api.get(`/offers/${offerId}/history`)
      .then(({ data }) => { if (!cancelled) setDetailHistory({ offerId, entries: Array.isArray(data) ? data : [] }); })
      .catch(() => { if (!cancelled) setDetailHistory({ offerId, entries: [] }); });

    return () => { cancelled = true; };
  }, [detailOffer]);

  async function loadOffers() {
    try {
      const { data } = await api.get("/offers", { params: { size: 500 } });
      setOffers(data.content ?? data);
    } catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  function resetForm() { setForm({ ...EMPTY_FORM }); setEditingOffer(null); }
  function openCreateModal() { resetForm(); setModalMode("create"); }

  /**
   * Modification des champs commerciaux par leur proprietaire.
   *
   * Appelle PATCH /offers/{id}, distinct de /enrich : le chef de produit corrige
   * son offre — prix, dates, segment, composition — sans toucher aux descriptions
   * ni au referencement produits par l'analyste marketing.
   */
  function openUpdateModal(offer: Offer) {
    setEditingOffer(offer);
    setForm({
      ...EMPTY_FORM,
      name: offer.name,
      categoryId: offer.categoryId || "",
      promotionalPrice: offer.promotionalPrice?.toString() || "",
      currency: offer.currency || "XOF",
      targetSegment: offer.targetSegment || "",
      customerType: offer.customerType || "",
      legalMentions: offer.legalMentions || "",
    });
    setModalMode("update"); setOpenMenuId(null);
  }

  /** Les champs commerciaux se figent une fois l'offre validee (cote serveur aussi). */
  function canUpdateOffer(offer: Offer) {
    return canCreate && COMMERCIALLY_EDITABLE.includes(offer.status);
  }

  /**
   * Ouverture de l'enrichissement.
   *
   * L'ecran reutilisait le formulaire de creation pour cette action : le prix,
   * la devise, le segment et le type de client y etaient modifiables alors que
   * PATCH /offers/{id}/enrich ne les accepte pas. La sauvegarde annoncait donc
   * un succes sans que ces champs bougent en base, et les deux champs SEO, qui
   * sont l'objet meme de l'etape, n'etaient nulle part et partaient en dur a
   * null. Le formulaire d'enrichissement ne porte plus que les champs que le
   * serveur traite reellement.
   */
  function openEnrichModal(offer: Offer) {
    setEditingOffer(offer);
    setForm({
      ...EMPTY_FORM,
      name: offer.name,
      shortDescription: offer.shortDescription || "",
      longDescription: offer.longDescription || "",
      seoTitle: offer.seoTitle || "",
      seoDescription: offer.seoDescription || "",
      legalMentions: offer.legalMentions || "",
    });
    setModalMode("enrich"); setOpenMenuId(null);
    loadEnrichMedia(offer.id);
  }

  /** Visuels deja rattaches, et bibliotheque dans laquelle piocher. */
  async function loadEnrichMedia(offerId: string) {
    setPickedMediaId("");
    try {
      const [linked, library] = await Promise.all([
        api.get(`/media/offers/${offerId}`),
        api.get("/media"),
      ]);
      setEnrichMedia(Array.isArray(linked.data) ? linked.data : []);
      setLibraryMedia(Array.isArray(library.data) ? library.data : []);
    } catch {
      setEnrichMedia([]);
      setLibraryMedia([]);
    }
  }

  /**
   * Depot d'un visuel sans quitter l'enrichissement.
   *
   * L'analyste devait auparavant sortir du formulaire, aller sur l'ecran Medias,
   * deposer le fichier, revenir et l'associer. Les deux appels sont enchaines
   * ici : POST /media puis le rattachement a l'offre. Si le rattachement echoue,
   * le fichier reste dans la bibliotheque — on le dit, plutot que d'annoncer un
   * succes pour une association qui n'a pas eu lieu.
   */
  async function handleUploadMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingOffer || uploading) return;

    // Le serveur refuse au-dela de 50 Mo ; on arrete avant l'envoi pour ne pas
    // faire patienter sur un transfert voue a etre rejete.
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t("form.mediaTooLarge"));
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      const { data: asset } = await api.post("/media", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.post(`/media/offers/${editingOffer.id}/link`, {
        mediaAssetId: asset.id, isPrimary: enrichMedia.length === 0, displayOrder: enrichMedia.length,
      });
      toast.success(t("messages.mediaAttached"));
      await loadEnrichMedia(editingOffer.id);
    } catch (err) {
      toast.error(apiError(err, tc("errors.create")));
    } finally {
      setUploading(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  }

  async function handleAttachMedia() {
    if (!editingOffer || !pickedMediaId || attaching) return;
    setAttaching(true);
    try {
      await api.post(`/media/offers/${editingOffer.id}/link`, {
        mediaAssetId: pickedMediaId, isPrimary: enrichMedia.length === 0, displayOrder: enrichMedia.length,
      });
      toast.success(t("messages.mediaAttached"));
      await loadEnrichMedia(editingOffer.id);
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally { setAttaching(false); }
  }

  /**
   * Enregistre l'enrichissement puis rend la main au chef de service.
   *
   * L'enrichissement seul ne change pas le statut : la fiche restait en
   * brouillon apres sauvegarde, sans que rien n'indique quoi faire ensuite. Le
   * passage en validation est une transition distincte, qu'il fallait aller
   * chercher dans un autre menu. Elle est desormais proposee au moment ou le
   * travail se termine. Depuis un brouillon, deux transitions sont necessaires :
   * la fiche doit d'abord entrer en enrichissement avant d'en sortir.
   */
  async function handleEnrichAndSubmit() {
    if (!editingOffer || submitting) return;
    setSubmitting(true);
    try {
      await api.patch(`/offers/${editingOffer.id}/enrich`, {
        shortDescription: form.shortDescription || null,
        longDescription: form.longDescription || null,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        legalMentions: form.legalMentions || null,
      });
      if (editingOffer.status === "DRAFT") {
        await api.post(`/offers/${editingOffer.id}/transition`, { targetStatus: "IN_ENRICHMENT", comment: null });
      }
      await api.post(`/offers/${editingOffer.id}/transition`, { targetStatus: "IN_VALIDATION", comment: null });
      toast.success(t("messages.sentToValidation"));
      setModalMode(null); resetForm(); loadOffers();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally { setSubmitting(false); }
  }

  /** L'enrichissement n'est propose que sur les statuts que le serveur accepte. */
  function canEnrichOffer(offer: Offer) {
    return canEnrich && ENRICHABLE_STATUSES.includes(offer.status);
  }

  /**
   * Ouverture de la repartition.
   *
   * La liste des analystes vient d'un endpoint dedie : l'annuaire complet exige
   * USER_MANAGE, que le chef de service ne detient pas. Il ne recoit que les
   * analystes actifs, reduits a leur identite.
   */
  async function openAssignModal(offer: Offer) {
    setAssignTarget(offer);
    setPickedAnalystId(offer.assignedToId ?? "");
    setOpenMenuId(null);
    try {
      const { data } = await api.get("/offers/enrichers");
      setAnalysts(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(apiError(e, tc("errors.load")));
      setAnalysts([]);
    }
  }

  async function handleAssign() {
    if (!assignTarget || assigning) return;
    setAssigning(true);
    try {
      // Une valeur vide libere la fiche : elle retourne dans le lot commun.
      await api.patch(`/offers/${assignTarget.id}/assign`, { analystId: pickedAnalystId || null });
      toast.success(pickedAnalystId ? t("assign.done") : t("assign.released"));
      setAssignTarget(null);
      loadOffers();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    } finally { setAssigning(false); }
  }

  /**
   * Nom de l'affectataire, si ce compte a le droit de connaitre les analystes.
   * Un analyste ne peut pas resoudre le nom d'un collegue : on affiche alors une
   * mention neutre plutot qu'un identifiant technique.
   */
  function analystName(id: string): string {
    const found = analysts.find((a) => a.id === id);
    return found ? `${found.firstName} ${found.lastName}` : t("assign.assigned");
  }

  /** Transitions ouvertes a ce compte depuis le statut courant de la fiche. */
  function availableTransitions(offer: Offer): OfferStatus[] {
    return (ALLOWED_TRANSITIONS[offer.status] || []).filter((target) =>
      permissionsForTransition(offer.status, target).some((code) => has(code))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      if (isEnriching) {
        await api.patch(`/offers/${editingOffer!.id}/enrich`, {
          shortDescription: form.shortDescription || null,
          longDescription: form.longDescription || null,
          seoTitle: form.seoTitle || null,
          seoDescription: form.seoDescription || null,
          legalMentions: form.legalMentions || null,
        });
        toast.success(t("messages.enriched"));
      } else if (isUpdating) {
        // catalogItemIds est volontairement absent : la composition ne se modifie
        // pas depuis ce formulaire, et le serveur la conserve quand elle est omise.
        await api.patch(`/offers/${editingOffer!.id}`, {
          name: form.name,
          // Le reclassement est un champ commercial : il appartient au chef de
          // produit, comme le prix ou les dates, et non a l'enrichissement.
          categoryId: form.categoryId || null,
          promotionalPrice: parseFloat(form.promotionalPrice) || null,
          currency: form.currency,
          targetSegment: form.targetSegment || null,
          customerType: form.customerType || null,
          legalMentions: form.legalMentions || null,
        });
        toast.success(t("messages.updated"));
      } else {
        await api.post("/offers", {
          name: form.name, categoryId: form.categoryId,
          shortDescription: form.shortDescription,
          longDescription: form.longDescription,
          promotionalPrice: parseFloat(form.promotionalPrice) || null,
          currency: form.currency,
          targetSegment: form.targetSegment || null, customerType: form.customerType || null,
          legalMentions: form.legalMentions || null, catalogItemIds: [],
        });
        toast.success(t("messages.created"));
      }
      setModalMode(null); resetForm(); loadOffers();
    } catch (e) {
      toast.error(apiError(e, modalMode === "create" ? tc("errors.create") : tc("errors.update")));
    } finally { setCreating(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/offers/${deleteTarget.id}`); toast.success(t("messages.deleted")); loadOffers(); }
    catch (e) { toast.error(apiError(e, tc("errors.delete"))); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }

  async function handleTransition(offerId: string, targetStatus: OfferStatus) {
    const needsComment = targetStatus === "IN_ENRICHMENT" || targetStatus === "DRAFT";
    if (needsComment && !transitionComment.trim()) {
      toast.error(t("transition.commentRequired"));
      return;
    }
    try {
      await api.post(`/offers/${offerId}/transition`, { targetStatus, comment: transitionComment || null });
      toast.success(t("messages.transitionSuccess"));
      setTransitionOffer(null); setTransitionComment(""); loadOffers();
    } catch (e) {
      toast.error(apiError(e, tc("errors.action")));
    }
  }

  function formatPrice(price: number, currency: string) {
    return `${price.toLocaleString("fr-FR")} ${currency}`;
  }
  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  // La periode porte sur la date de creation : c'est la seule date renseignee
  // pour tous les statuts. validFrom reste vide sur les brouillons, qui
  // disparaitraient donc de la liste des qu'une periode serait saisie.
  const visibleOffers = isDiffusionOnly
    ? offers.filter((o) => o.status === "PUBLISHED")
    : offers;

  const filtered = visibleOffers.filter((o) => {
    if (filterStatus === "QUEUE") {
      if (!queueStatuses.includes(o.status)) return false;
      // La file d'un analyste ne contient pas les fiches confiees a un collegue :
      // c'est ce qui repond a « laquelle de ces offres est la mienne ». Les fiches
      // non reparties y restent, pour qu'aucune ne soit oubliee. Le chef de
      // service, lui, doit voir toute la file puisqu'il la repartit.
      if (canEnrich && !canAssign && o.assignedToId && o.assignedToId !== myId) return false;
    } else if (filterStatus !== "ALL" && o.status !== filterStatus) return false;
    if (search && !`${o.name} ${o.shortDescription}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && new Date(o.createdAt) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(o.createdAt) > to) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const statusCounts = STATUS_KEYS.reduce((acc, k) => {
    acc[k] = visibleOffers.filter((o) => o.status === k).length;
    return acc;
  }, {} as Record<string, number>);

  const queueCount = visibleOffers.filter((o) => queueStatuses.includes(o.status)).length;

  const cardStats = [
    { key: "total", count: visibleOffers.length, label: t("stats.totalOffers"), link: t("stats.viewAll"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", filterValue: "ALL" },
    { key: "validation", count: statusCounts.IN_VALIDATION ?? 0, label: t("stats.inValidation"), link: t("stats.viewValidations"), color: "text-primary", bg: "bg-primary/10", filterValue: "IN_VALIDATION" },
    { key: "published", count: statusCounts.PUBLISHED ?? 0, label: t("stats.published"), link: t("stats.viewPublished"), color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", filterValue: "PUBLISHED" },
    { key: "toComplete", count: (statusCounts.DRAFT ?? 0) + (statusCounts.IN_ENRICHMENT ?? 0), label: t("stats.toComplete"), link: t("stats.viewToComplete"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", filterValue: "DRAFT" },
  ];

  const cardIcons = [
    <svg key="total" className="size-6" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /></svg>,
    <svg key="validation" className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    <svg key="published" className="size-6" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    <svg key="toComplete" className="size-6" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("headerTitle")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">{t("headerSubtitle")}</p>
        </div>
        {/* Le bouton de creation n'apparait que pour les detenteurs de
            OFFER_CREATE : un analyste marketing ou un chef de service le voyait
            auparavant, remplissait le formulaire et se heurtait a un 403.
            Les entrees « depuis un modele » et « importer » ont ete retirees :
            aucun endpoint ne les servait, elles n'avaient aucun effet. */}
        {canCreate && (
          <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 active-scale">
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium">{t("createOffer")}</p>
            </span>
          </button>
        )}
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardStats.map((s, idx) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.filterValue)}
            className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card text-left cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-xl p-2.5 ${s.bg} ${s.color}`}>
                {cardIcons[idx]}
              </div>
              <span className="text-sm font-medium text-text-secondary dark:text-neutral-400">{s.label}</span>
            </div>
            {loading ? (
              <Skeleton className="w-10 h-8 mb-2" />
            ) : (
              <span className="text-3xl font-bold text-black dark:text-white tabular-nums block mb-2">{s.count}</span>
            )}
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              {s.link}
              <svg className="size-3" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {/* ===== STATUS FILTER PILLS ===== */}
      <div className="flex flex-wrap gap-1.5">
        {/* File d'attente du role : les seules fiches sur lesquelles ce compte
            peut agir. Absente pour un role sans permission de cycle de vie. */}
        {queueStatuses.length > 0 && (
          <button
            onClick={() => setFilterStatus("QUEUE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              filterStatus === "QUEUE"
                ? "bg-primary text-white"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {t("filterQueue")} ({queueCount})
          </button>
        )}
        <button
          onClick={() => setFilterStatus("ALL")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
            filterStatus === "ALL"
              ? "bg-slate-800 text-white dark:bg-white dark:text-black"
              : "bg-neutral-100 text-text-secondary dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          }`}
        >
          {t("filterAll")} ({visibleOffers.length})
        </button>
        {/* Les dix statuts du circuit n'ont pas de sens pour un role qui ne voit
            que des offres publiees : neuf pastilles y afficheraient toujours zero. */}
        {!isDiffusionOnly && STATUS_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
              filterStatus === key
                ? "bg-slate-800 text-white dark:bg-white dark:text-black"
                : "bg-neutral-100 text-text-secondary dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            {t(`status.${key}`)} ({statusCounts[key] ?? 0})
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={searchKeyHandler(setSearch)}
            placeholder={t("searchPlaceholder")}
            className="input w-full h-10 pl-9"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[120px]">
          <option value="ALL">{t("filters.status")}</option>
          {STATUS_KEYS.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary dark:text-neutral-500">{t("filters.date")}</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input h-10" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input h-10" />
        </div>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        {/* En-tête bleu navy */}
        <div className="hidden md:grid grid-cols-[1.2fr_0.7fr_90px_100px_100px_80px_110px_60px] gap-3 px-6 py-3 bg-slate-800 dark:bg-slate-900 rounded-t-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.offer")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.type")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.price")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.period")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.status")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.quality")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">{t("columns.lastModified")}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white text-right">{t("columns.actions")}</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[1.2fr_0.7fr_90px_100px_100px_80px_110px_60px] gap-3 items-center py-3.5">
                <Skeleton className="w-28 h-4" />
                <Skeleton className="w-14 h-5 !rounded-md" />
                <Skeleton className="w-14 h-4" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-16 h-5 !rounded-md" />
                <Skeleton className="w-10 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              {/* Illustration */}
              <svg className="size-32" viewBox="0 0 130 130" fill="none">
                {/* Document principal */}
                <rect x="35" y="25" width="60" height="75" rx="6" className="fill-blue-50 dark:fill-blue-900/10 stroke-blue-200 dark:stroke-blue-800/40" strokeWidth="1.5" />
                <path d="M48 42h34M48 52h26M48 62h20" className="stroke-blue-300/50 dark:stroke-blue-700/30" strokeWidth="2" strokeLinecap="round" />
                {/* Cercle + */}
                <circle cx="85" cy="80" r="16" className="fill-primary/15 stroke-primary/40" strokeWidth="1.5" />
                <path d="M85 73v14M78 80h14" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                {/* Étoiles déco */}
                <path d="M25 35l2 4 4 1-3 3 .5 4-3.5-2-3.5 2 .5-4-3-3 4-1 2-4z" className="fill-primary/20" />
                <path d="M105 30l1.5 3 3 .7-2.2 2.2.4 3-2.7-1.5-2.7 1.5.4-3-2.2-2.2 3-.7 1.5-3z" className="fill-blue-400/20" />
                <circle cx="28" cy="75" r="2" className="fill-emerald-400/30" />
                <circle cx="108" cy="55" r="1.5" className="fill-amber-400/30" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{t("emptyTitle")}</p>
                {/* Un role qui ne cree pas d'offre ne doit pas se voir reprocher
                    un catalogue vide ni proposer une action qu'il n'a pas. */}
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">
                  {canCreate
                    ? t("emptyDescription")
                    : filterStatus === "QUEUE"
                      ? t("emptyQueue")
                      : t("emptyReadOnly")}
                </p>
              </div>
              {canCreate && (
                <div className="flex items-center gap-3 mt-1">
                  <button onClick={openCreateModal} className="primary-icon px-5 py-2.5 active-scale">
                    <span className="flex items-center gap-2">
                      <svg className="size-4" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <p className="text-sm font-medium">{t("createFirstOffer")}</p>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((offer) => (
              <div
                key={offer.id}
                className="grid grid-cols-1 md:grid-cols-[1.2fr_0.7fr_90px_100px_100px_80px_110px_60px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer"
                onClick={() => setDetailOffer(offer)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white truncate">{offer.name}</p>
                  {/* Auteur de la fiche. Le cahier des charges (l. 114) donne au chef
                      de service une vue transversale « et voit qui a cree quelle
                      offre » : c'est la capacite qui le distingue des autres
                      valideurs, et elle n'apparaissait nulle part — createdById est
                      un identifiant technique qu'aucun ecran ne resolvait.
                      Le serveur ne renseigne ce nom que pour les roles qui ont a le
                      connaitre ; ailleurs il est nul et la ligne reste inchangee. */}
                  {offer.createdByName ? (
                    <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">
                      {t("columns.createdBy", { name: offer.createdByName })}
                      {offer.shortDescription ? ` · ${offer.shortDescription}` : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">{offer.shortDescription || ""}</p>
                  )}
                </div>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{offer.targetSegment ? t(`segments.${offer.targetSegment}`) : "—"}</span>
                <p className="text-sm font-semibold text-black dark:text-white tabular-nums">
                  {offer.promotionalPrice ? formatPrice(offer.promotionalPrice, offer.currency) : "—"}
                </p>
                <span className="text-xs text-text-secondary dark:text-neutral-400">
                  {offer.validFrom ? `${formatDate(offer.validFrom)}` : "—"}
                </span>
                <div className="flex flex-col gap-1 items-start">
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[offer.status] ?? STATUS_STYLES.DRAFT}`}>
                    {t(`status.${offer.status}`)}
                  </span>
                  {/* Qui traite la fiche. Un analyste reconnait les siennes sans
                      avoir besoin de resoudre le nom de ses collegues. */}
                  {offer.assignedToId && ENRICHABLE_STATUSES.includes(offer.status) && (
                    <span className={`inline-flex items-center w-fit px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                      offer.assignedToId === myId
                        ? "bg-primary/10 text-primary"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}>
                      {offer.assignedToId === myId ? t("assign.mine") : (offer.assignedToName ?? analystName(offer.assignedToId))}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${offer.qualityScore >= 80 ? "bg-emerald-500" : offer.qualityScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(offer.qualityScore, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-black dark:text-white tabular-nums w-7 text-right">{offer.qualityScore}%</span>
                </div>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{formatDate(offer.updatedAt)}</span>
                <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === offer.id ? null : offer.id)}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                  {openMenuId === offer.id && (
                    <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-lg p-1 min-w-[160px] animate-fade-in">
                      <button onClick={() => { setDetailOffer(offer); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        {tc("status")}
                      </button>
                      {canAssign && ENRICHABLE_STATUSES.includes(offer.status) && (
                        <button onClick={() => openAssignModal(offer)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 13.5c0-2.3 2-4 4.5-4 1 0 1.9.27 2.6.73" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M11 11h4M13 9v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                          {offer.assignedToId ? t("assign.reassign") : t("assign.action")}
                        </button>
                      )}
                      {canUpdateOffer(offer) && (
                        <button onClick={() => openUpdateModal(offer)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                          {tc("edit")}
                        </button>
                      )}
                      {/* Enrichir est distinct de Modifier : l'action appelle
                          PATCH /enrich, qui exige OFFER_ENRICH et n'accepte que
                          les statuts brouillon et en enrichissement. Le chef de
                          produit, qui ne detient pas cette permission, passe la
                          main a l'analyste marketing — c'est le circuit prevu. */}
                      {canEnrichOffer(offer) && (
                        <button onClick={() => openEnrichModal(offer)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                          {t("enrich")}
                        </button>
                      )}
                      {availableTransitions(offer).length > 0 && (
                        <button onClick={() => { setTransitionOffer(offer); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          {t("transition.title")}
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => { setDeleteTarget(offer); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          {tc("delete")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/20">
            <span className="text-xs text-text-secondary dark:text-neutral-500">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`size-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${page === p ? "bg-primary text-white" : "border border-border dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="size-8 rounded-lg flex items-center justify-center border border-border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                <svg className="size-3.5 text-neutral-600 dark:text-neutral-300" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== 3 FEATURE CARDS ===== */}
      {offers.length === 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: "workflow", title: t("features.workflow"), desc: t("features.workflowDesc"), color: "text-primary bg-primary/10" },
            { icon: "quality", title: t("features.quality"), desc: t("features.qualityDesc"), color: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30" },
            { icon: "multichannel", title: t("features.multichannel"), desc: t("features.multichannelDesc"), color: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30" },
          ].map((f) => (
            <div key={f.icon} className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card flex items-start gap-4">
              <div className={`rounded-xl p-3 shrink-0 ${f.color}`}>
                {f.icon === "workflow" && (
                  <svg className="size-6" viewBox="0 0 24 24" fill="none">
                    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 8l2.5 7.5M16 8l-2.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                {f.icon === "quality" && (
                  <svg className="size-6" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {f.icon === "multichannel" && (
                  <svg className="size-6" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white">{f.title}</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== MODAL TRANSITION ===== */}
      {transitionOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setTransitionOffer(null); setTransitionComment(""); } }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-black dark:text-white">{t("transition.title")}</h2>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-0.5">{transitionOffer.name}</p>
              </div>
              <button onClick={() => { setTransitionOffer(null); setTransitionComment(""); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("transition.currentStatus")}</p>
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[transitionOffer.status]}`}>
                  {t(`status.${transitionOffer.status}`)}
                </span>
              </div>
              {/* Verification des mentions legales avant mise sur le marche.
                  Le cahier des charges (l. 106) confie cette verification au chef
                  de departement, mais rien ne la lui presentait : les mentions
                  n'apparaissaient que dans le panneau de detail, et seulement
                  lorsqu'elles etaient renseignees — leur absence, qui est
                  precisement ce qu'il doit reperer, etait donc invisible. */}
              {canPublish && ["VALIDATED", "PLANNED"].includes(transitionOffer.status) && (
                <div className={`flex flex-col gap-1.5 rounded-xl px-4 py-3 border ${
                  transitionOffer.legalMentions
                    ? "border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40"
                    : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                }`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                    {t("form.legalMentions")}
                  </p>
                  {transitionOffer.legalMentions ? (
                    <p className="text-xs text-black dark:text-neutral-200 leading-relaxed">
                      {transitionOffer.legalMentions}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                      {t("transition.noLegalMentions")}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("transition.comment")}</label>
                <input value={transitionComment} onChange={(e) => setTransitionComment(e.target.value)} placeholder={t("transition.commentPlaceholder")} className="input w-full h-10" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("transition.availableTransitions")}</label>
                <div className="flex flex-wrap gap-2">
                  {availableTransitions(transitionOffer).map((target) => (
                    <button key={target} onClick={() => handleTransition(transitionOffer.id, target)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer">
                      <svg className="size-3" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {t(`status.${target}`)}
                    </button>
                  ))}
                  {availableTransitions(transitionOffer).length === 0 && (
                    <p className="text-xs text-text-secondary dark:text-neutral-500">{t("transition.noneAvailable")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CRÉATION / ÉDITION ===== */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setModalMode(null); resetForm(); } }}>
          <div ref={modalRef} className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <h2 className="text-base font-bold text-black dark:text-white truncate">{isEnriching ? t("enrichTitle") : isUpdating ? t("updateTitle") : t("createTitle")}</h2>
                {/* Le statut n'apparaissait nulle part dans le formulaire : apres
                    enregistrement, rien n'expliquait pourquoi la fiche restait
                    en brouillon. */}
                {editingOffer && (
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[editingOffer.status] ?? STATUS_STYLES.DRAFT}`}>
                    {t(`status.${editingOffer.status}`)}
                  </span>
                )}
              </div>
              <button onClick={() => { setModalMode(null); resetForm(); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
                {/* Le formulaire d'enrichissement ne porte que les champs que
                    PATCH /enrich traite. Le nom, le prix, la devise, le segment
                    et le type de client relevent de la creation : les laisser
                    modifiables ici annoncait un enregistrement qui n'avait pas
                    lieu cote serveur. Ils sont rappeles en lecture seule pour
                    que l'analyste sache sur quelle fiche il travaille. */}
                {isEnriching ? (
                  <>
                    {/* Avertir sans bloquer : le depannage entre collegues reste
                        possible, mais le doublon devient visible avant la frappe. */}
                    {editingOffer?.assignedToId && editingOffer.assignedToId !== myId && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
                        <svg className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 11H2L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 6.5v3M8 11.2v.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{t("assign.warningOtherAnalyst")}</p>
                      </div>
                    )}
                    <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.name")}</p>
                      <p className="text-sm font-semibold text-black dark:text-white mt-0.5">{form.name}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.shortDescription")}</label>
                      <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="input w-full h-10" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.longDescription")}</label>
                      <textarea value={form.longDescription} onChange={(e) => setForm({ ...form, longDescription: e.target.value })} rows={4} className="input w-full resize-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.seoTitle")}</label>
                      <input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} maxLength={70} className="input w-full h-10" />
                      <span className="text-[11px] text-text-secondary dark:text-neutral-500 tabular-nums">{form.seoTitle.length}/70</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.seoDescription")}</label>
                      <textarea value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} rows={3} maxLength={160} className="input w-full resize-none" />
                      <span className="text-[11px] text-text-secondary dark:text-neutral-500 tabular-nums">{form.seoDescription.length}/160</span>
                    </div>
                    {/* Les visuels se rattachent ici, la ou l'analyste travaille.
                        L'association part immediatement au serveur : la liste
                        ci-dessous reflete ce qui est reellement enregistre, pas
                        une selection en attente. */}
                    <div className="flex flex-col gap-2 rounded-xl border border-border dark:border-neutral-800 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                        {t("detail.media")} ({enrichMedia.length})
                      </p>
                      {enrichMedia.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {enrichMedia.map((m) => (
                            <div key={m.id} className="flex flex-col gap-1">
                              <MediaPreview mediaId={m.id} mimeType={m.mimeType} fileName={m.fileName}
                                className="w-full h-16 rounded-lg border border-border dark:border-neutral-800 object-cover" />
                              <p className="text-[10px] text-text-secondary dark:text-neutral-500 truncate" title={m.fileName}>{m.fileName}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Deposer un nouveau fichier, ou reutiliser un visuel deja
                          present — la bibliotheque partagee porte notamment les
                          elements de charte du groupe. */}
                      <label className={`flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed border-rule cursor-pointer transition-colors border-neutral-300 dark:border-neutral-700 hover:border-primary hover:bg-primary/5 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                        {uploading
                          ? <div className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          : <svg className="size-3.5 text-primary" viewBox="0 0 16 16" fill="none"><path d="M8 10V3M8 3l3 3M8 3L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        <span className="text-xs font-medium text-primary">{uploading ? tc("saving") : t("form.mediaUpload")}</span>
                        <input ref={mediaInputRef} type="file" className="hidden" disabled={uploading}
                          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,video/mp4,video/webm"
                          onChange={handleUploadMedia} />
                      </label>

                      {libraryMedia.filter((m) => !enrichMedia.some((a) => a.id === m.id)).length > 0 && (
                        <div className="flex items-center gap-2">
                          <select value={pickedMediaId} onChange={(e) => setPickedMediaId(e.target.value)} className="input h-9 flex-1 text-sm">
                            <option value="">{t("form.mediaChoose")}</option>
                            {libraryMedia
                              .filter((m) => !enrichMedia.some((a) => a.id === m.id))
                              .map((m) => <option key={m.id} value={m.id}>{m.fileName}</option>)}
                          </select>
                          <button type="button" onClick={handleAttachMedia} disabled={!pickedMediaId || attaching}
                            className="secondary-icon px-3 py-2 active-scale disabled:opacity-50">
                            <p className="text-sm font-medium">{attaching ? tc("saving") : t("form.mediaAttach")}</p>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.legalMentions")}</label>
                      <input value={form.legalMentions} onChange={(e) => setForm({ ...form, legalMentions: e.target.value })} className="input w-full h-10" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.name")}</label>
                      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full h-10" />
                    </div>
                    {/* Classification. Le type est implicite — c'est une offre —
                        et seules les categories de type OFFRE sont proposees. Le
                        serveur applique le meme refus, l'interface evite
                        l'aller-retour. */}
                    <CategoryPicker
                      type="OFFER"
                      value={form.categoryId}
                      onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
                    />

                    {/* Les descriptions ne sont saisies qu'a la creation. En
                        modification, elles ont pu etre reecrites par l'analyste
                        marketing : les reafficher ici inviterait le chef de
                        produit a ecraser un travail qui ne lui appartient pas,
                        et PATCH /offers/{id} ne les transporte pas. */}
                    {!isUpdating && (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.shortDescription")}</label>
                          <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="input w-full h-10" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.longDescription")}</label>
                          <textarea value={form.longDescription} onChange={(e) => setForm({ ...form, longDescription: e.target.value })} rows={3} className="input w-full resize-none" />
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.promotionalPrice")}</label>
                        <input type="number" min="0" value={form.promotionalPrice} onChange={(e) => setForm({ ...form, promotionalPrice: e.target.value })} placeholder="0" className="input w-full h-10" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.currency")}</label>
                        <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input w-full h-10">
                          <option value="XOF">XOF (FCFA)</option>
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.targetSegment")}</label>
                        <select value={form.targetSegment} onChange={(e) => setForm({ ...form, targetSegment: e.target.value })} className="input w-full h-10">
                          <option value="">—</option>
                          <option value="PREPAID">{t("segments.PREPAID")}</option>
                          <option value="POSTPAID">{t("segments.POSTPAID")}</option>
                          <option value="HYBRID">{t("segments.HYBRID")}</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.customerType")}</label>
                        <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })} className="input w-full h-10">
                          <option value="">—</option>
                          <option value="INDIVIDUAL">{t("customerTypes.INDIVIDUAL")}</option>
                          <option value="BUSINESS">{t("customerTypes.BUSINESS")}</option>
                          <option value="ALL">{t("customerTypes.ALL")}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.legalMentions")}</label>
                      <input value={form.legalMentions} onChange={(e) => setForm({ ...form, legalMentions: e.target.value })} className="input w-full h-10" />
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <button type="button" onClick={() => { setModalMode(null); resetForm(); }} className="tertiary-icon px-4 py-2 active-scale">
                  <p className="text-sm font-medium">{tc("cancel")}</p>
                </button>
                <button type="submit" disabled={creating || submitting} className={`${isEnriching ? "secondary-icon" : "primary-icon"} px-5 py-2 active-scale disabled:opacity-60`}>
                  <span className="flex items-center gap-2">
                    {creating && <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                    <p className="text-sm font-medium">{creating ? tc("saving") : tc("save")}</p>
                  </span>
                </button>
                {/* Enrichir ne change pas le statut : sans cette action, la fiche
                    restait en brouillon et l'analyste devait aller chercher la
                    transition dans un autre menu pour rendre la main. */}
                {isEnriching && has(PERM.OFFER_SUBMIT) && (
                  <button type="button" onClick={handleEnrichAndSubmit} disabled={creating || submitting} className="primary-icon px-5 py-2 active-scale disabled:opacity-60">
                    <span className="flex items-center gap-2">
                      {submitting && <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                      <p className="text-sm font-medium">{submitting ? tc("saving") : t("saveAndSubmit")}</p>
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAIL ===== */}
      {detailOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDetailOffer(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <svg className="size-5" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M5 5h6M5 8h4M5 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-black dark:text-white">{detailOffer.name}</h2>
                  <p className="text-xs text-text-secondary dark:text-neutral-500">{detailOffer.shortDescription || "—"}</p>
                </div>
              </div>
              <button onClick={() => setDetailOffer(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.status")}</p>
                  <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[detailOffer.status]}`}>{t(`status.${detailOffer.status}`)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.quality")}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${detailOffer.qualityScore >= 80 ? "bg-emerald-500" : detailOffer.qualityScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(detailOffer.qualityScore, 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-black dark:text-white tabular-nums">{detailOffer.qualityScore}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.price")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{detailOffer.promotionalPrice ? formatPrice(detailOffer.promotionalPrice, detailOffer.currency) : "—"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("detail.version")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">v{detailOffer.currentVersion}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{tclass("category")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{detailOffer.categoryPath || tclass("unclassified")}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.targetSegment")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{detailOffer.targetSegment ? t(`segments.${detailOffer.targetSegment}`) : "—"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.customerType")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{detailOffer.customerType ? t(`customerTypes.${detailOffer.customerType}`) : "—"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.created")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{formatDate(detailOffer.createdAt)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("detail.updatedAt")}</p>
                  <p className="text-sm font-medium text-black dark:text-white">{formatDate(detailOffer.updatedAt)}</p>
                </div>
              </div>
              {detailOffer.longDescription && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.longDescription")}</p>
                  <p className="text-sm text-black dark:text-white leading-relaxed">{detailOffer.longDescription}</p>
                </div>
              )}
              {detailMedia?.offerId === detailOffer.id && detailMedia.items.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                    {t("detail.media")} ({detailMedia.items.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {detailMedia.items.map((m) => (
                      <div key={m.id} className="flex flex-col gap-1">
                        <MediaPreview
                          mediaId={m.id}
                          mimeType={m.mimeType}
                          fileName={m.fileName}
                          className="w-full h-20 rounded-lg border border-border dark:border-neutral-800 object-cover"
                        />
                        <p className="text-[10px] text-text-secondary dark:text-neutral-500 truncate" title={m.fileName}>{m.fileName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Le referencement produit par l'analyste marketing n'apparaissait
                  nulle part : le valideur et le publieur ne pouvaient pas juger
                  du travail d'enrichissement sur lequel ils se prononcent. */}
              {(detailOffer.seoTitle || detailOffer.seoDescription) && (
                <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-4 py-3">
                  {detailOffer.seoTitle && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.seoTitle")}</p>
                      <p className="text-sm text-black dark:text-white">{detailOffer.seoTitle}</p>
                    </div>
                  )}
                  {detailOffer.seoDescription && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.seoDescription")}</p>
                      <p className="text-xs text-text-secondary dark:text-neutral-400 leading-relaxed">{detailOffer.seoDescription}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Paternite de la fiche, au moment ou le valideur se prononce.
                  Le chef de service doit savoir quel chef de produit a produit
                  l'offre qu'il valide, et qui l'a enrichie. */}
              {(detailOffer.createdByName || detailOffer.assignedToName) && (
                <div className="flex flex-wrap gap-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-4 py-3">
                  {detailOffer.createdByName && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("columns.author")}</p>
                      <p className="text-sm text-black dark:text-white">{detailOffer.createdByName}</p>
                    </div>
                  )}
                  {detailOffer.assignedToName && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("assign.analyst")}</p>
                      <p className="text-sm text-black dark:text-white">{detailOffer.assignedToName}</p>
                    </div>
                  )}
                </div>
              )}
              {/* Parcours de la fiche. Place avant les mentions legales parce que
                  c'est la premiere chose que cherche celui qui ouvre une offre
                  revenue en arriere : pourquoi elle est revenue. */}
              {detailHistory?.offerId === detailOffer.id && detailHistory.entries.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">
                    {t("detail.history")} ({detailHistory.entries.length})
                  </p>
                  <ol className="flex flex-col gap-2">
                    {detailHistory.entries.map((entry) => (
                      <li key={entry.id} className="flex gap-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2.5">
                        <span className="shrink-0 mt-0.5 size-2 rounded-full bg-primary" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {entry.fromStatus && (
                              <>
                                <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded ${STATUS_STYLES[entry.fromStatus] ?? STATUS_STYLES.DRAFT}`}>
                                  {t(`status.${entry.fromStatus}`)}
                                </span>
                                <span className="text-[11px] text-neutral-400" aria-hidden="true">→</span>
                              </>
                            )}
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded ${STATUS_STYLES[entry.toStatus] ?? STATUS_STYLES.DRAFT}`}>
                              {t(`status.${entry.toStatus}`)}
                            </span>
                            <span className="text-[11px] text-text-secondary dark:text-neutral-500">
                              {entry.changedByName ? `· ${entry.changedByName} ` : ""}
                              · {formatDate(entry.createdAt)}
                            </span>
                          </div>
                          {/* Le motif du rejet : la raison d'etre de ce bloc. */}
                          {entry.comment && (
                            <p className="text-xs text-black dark:text-neutral-200 mt-1 leading-relaxed">
                              « {entry.comment} »
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {detailOffer.legalMentions && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.legalMentions")}</p>
                  <p className="text-xs text-text-secondary dark:text-neutral-400">{detailOffer.legalMentions}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              {availableTransitions(detailOffer).length > 0 && (
                <button onClick={() => { setTransitionOffer(detailOffer); setDetailOffer(null); }} className="secondary-icon px-4 py-2 active-scale">
                  <span className="flex items-center gap-1.5">
                    <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <p className="text-sm font-medium">{t("transition.title")}</p>
                  </span>
                </button>
              )}
              {canUpdateOffer(detailOffer) && (
                <button onClick={() => { openUpdateModal(detailOffer); setDetailOffer(null); }} className="secondary-icon px-4 py-2 active-scale">
                  <span className="flex items-center gap-1.5">
                    <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                    <p className="text-sm font-medium">{tc("edit")}</p>
                  </span>
                </button>
              )}
              {canEnrichOffer(detailOffer) && (
                <button onClick={() => { openEnrichModal(detailOffer); setDetailOffer(null); }} className="secondary-icon px-4 py-2 active-scale">
                  <span className="flex items-center gap-1.5">
                    <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                    <p className="text-sm font-medium">{t("enrich")}</p>
                  </span>
                </button>
              )}
              <button onClick={() => setDetailOffer(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("close")}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL AFFECTATION ===== */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setAssignTarget(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">{t("assign.title")}</h2>
              <button onClick={() => setAssignTarget(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{t("form.name")}</p>
                <p className="text-sm font-semibold text-black dark:text-white mt-0.5 truncate">{assignTarget.name}</p>
              </div>
              {analysts.length === 0 ? (
                <p className="text-sm text-text-secondary dark:text-neutral-500">{t("assign.noAnalyst")}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("assign.analyst")}</label>

                  {/* Liste et non menu deroulant : la charge de chacun doit etre
                      visible au moment du choix, pas apres. Le serveur renvoie les
                      analystes tries du moins charge au plus charge, ce qui fait
                      remonter d'office celui qui est disponible. */}
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                    {analysts.map((a) => {
                      const selected = pickedAnalystId === a.id;
                      const free = a.activeCount === 0;
                      return (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => setPickedAnalystId(a.id)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                            selected
                              ? "border-primary bg-primary/5 dark:bg-primary/10"
                              : "border-border dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                          }`}
                        >
                          <span className={`shrink-0 flex items-center justify-center size-8 rounded-full text-[11px] font-bold ${
                            selected ? "bg-primary text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                          }`}>
                            {a.firstName?.[0]}{a.lastName?.[0]}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-black dark:text-white truncate">
                              {a.firstName} {a.lastName}
                            </span>
                            <span className="block text-[11px] text-text-secondary dark:text-neutral-500">
                              {t("assign.handled", { count: a.totalCount })}
                            </span>
                          </span>
                          {/* La charge ouverte est l'information de decision : elle est
                              chiffree et libellee, la couleur ne la porte pas seule. */}
                          <span className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold ${
                            free
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : a.activeCount <= 2
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            {free ? t("assign.available") : t("assign.inProgress", { count: a.activeCount })}
                          </span>
                        </button>
                      );
                    })}

                    {/* Choix vide assume : il libere la fiche pour la remettre dans le lot commun. */}
                    <button
                      type="button"
                      onClick={() => setPickedAnalystId("")}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                        pickedAnalystId === ""
                          ? "border-primary bg-primary/5 dark:bg-primary/10 text-black dark:text-white"
                          : "border-border dark:border-neutral-800 text-text-secondary dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                      }`}
                    >
                      {t("assign.none")}
                    </button>
                  </div>
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">{t("assign.hint")}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setAssignTarget(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("cancel")}</p>
              </button>
              <button onClick={handleAssign} disabled={assigning || analysts.length === 0} className="primary-icon px-5 py-2 active-scale disabled:opacity-60">
                <span className="flex items-center gap-2">
                  {assigning && <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  <p className="text-sm font-medium">{assigning ? tc("saving") : t("assign.confirm")}</p>
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
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.name}</span> — {t("messages.deleteWarning")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => setDeleteTarget(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("cancel")}</p>
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg active-scale disabled:opacity-60 transition-colors cursor-pointer">
                {deleting ? tc("deleting") : tc("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
