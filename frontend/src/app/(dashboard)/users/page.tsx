"use client";

import { useEffect, useState, useRef } from "react";
import api, { apiError } from "@/lib/api";
import { searchKeyHandler } from "@/lib/search";
import type { User } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import toast from "react-hot-toast";
import PhoneInput from "@/components/PhoneInput";
import ActionMenu from "@/components/ActionMenu";
import { useTranslations } from "next-intl";
import { AVATAR_MAX_SIZE, resizeToDataUrl } from "@/lib/avatar";
import { accentBar } from "@/lib/accent";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  LOCKED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  DISABLED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  DEACTIVATED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ADMIN_SYSTEME: "bg-primary/10 text-primary",
  CHEF_PRODUIT: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ANALYSTE_MARKETING: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CHEF_SERVICE: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  CHEF_DEPARTEMENT: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  COMMUNITY_MANAGER: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const EMPTY_FORM = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  pseudo: "",
  sex: "",
  address: "",
  roleName: "CHEF_PRODUIT",
};

/**
 * Purge des brouillons de creation d'utilisateur.
 *
 * L'ecran conservait dans localStorage, sous la cle "pim_user_drafts", une copie
 * integrale du formulaire — *mot de passe du compte a creer compris, en clair*.
 * Ces entrees n'etaient rattachees ni a un compte ni a une session, survivaient
 * a la deconnexion (auth.tsx les preservait explicitement) et reapparaissaient
 * donc a la connexion suivante, y compris pour un autre administrateur sur le
 * meme poste. Le mecanisme est retire ; cette fonction efface ce qui a pu etre
 * ecrit avant la correction.
 */
const LEGACY_DRAFTS_KEY = "pim_user_drafts";

function purgeLegacyDrafts() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(LEGACY_DRAFTS_KEY); } catch { /* stockage indisponible */ }
}

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse ${className}`} />;
}

const PER_PAGE = 10;


export default function UsersPage() {
  const t = useTranslations("users");
  const tc = useTranslations("common");

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Vrai des que l'adresse a ete saisie a la main : la proposition automatique
  // ne doit plus la remplacer.
  const [emailTouched, setEmailTouched] = useState(false);


  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const isEditing = !!editingUser;

  useEffect(() => { loadUsers(); purgeLegacyDrafts(); }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailUser) { setDetailUser(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailUser]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  useEffect(() => { setPage(1); }, [search, filterRole, filterStatus]);

  async function loadUsers() {
    try { const { data } = await api.get("/users"); setUsers(data); }
    catch (e) { toast.error(apiError(e, tc("errors.load"))); }
    finally { setLoading(false); }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t("form.photoError")); return; }
    // L'avatar est stocke en base sous forme de data URI : on le redimensionne ici
    // pour rester sous la limite de 256 Ko encodes imposee par le backend.
    resizeToDataUrl(file, AVATAR_MAX_SIZE)
      .then(setAvatarPreview)
      .catch(() => toast.error(t("form.photoError")));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setAvatarPreview(null);
    setStep(1);
    setStepError("");
    setEditingUser(null);
    setShowPassword(false);
    setEmailTouched(false);
  }




  function generateUniqueEmail(firstName: string, lastName: string): string {
    if (!firstName.trim() || !lastName.trim()) return "";
    const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
    const fn = normalize(firstName);
    const ln = normalize(lastName);
    if (!fn || !ln) return "";
    const pool = "abcdefghjkmnpqrstuvwxyz23456789";
    function randChars(n: number) {
      let r = "";
      const arr = new Uint8Array(n);
      crypto.getRandomValues(arr);
      for (let i = 0; i < n; i++) r += pool[arr[i] % pool.length];
      return r;
    }
    const domain = "@moov-africa.bf";
    const prefix = fn[0] + ln.slice(0, 3);
    const existingEmails = new Set(users.filter((u) => !editingUser || u.id !== editingUser.id).map((u) => u.email.toLowerCase()));
    let candidate = `${prefix}${randChars(6)}${domain}`;
    while (existingEmails.has(candidate)) { candidate = `${prefix}${randChars(6)}${domain}`; }
    return candidate;
  }

  /**
   * Reajuste la proposition d'adresse quand le nom change — mais seulement tant
   * que l'administrateur n'a pas saisi la sienne. Sans ce garde-fou, une adresse
   * attribuee a la main etait effacee des la frappe suivante dans le nom.
   */
  function updateEmailFromName(firstName: string, lastName: string) {
    if (!isEditing && !emailTouched) {
      const email = generateUniqueEmail(firstName, lastName);
      setForm((prev) => ({ ...prev, email }));
    }
  }

  function validateStep1(): boolean {
    if (!form.lastName.trim()) { setStepError(t("messages.validation.lastNameRequired")); return false; }
    if (!form.firstName.trim()) { setStepError(t("messages.validation.firstNameRequired")); return false; }
    if (!form.email.trim()) { setStepError(t("messages.validation.emailRequired")); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { setStepError(t("messages.validation.emailInvalid")); return false; }
    setStepError("");
    return true;
  }

  function goToStep2() { if (validateStep1()) setStep(2); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await api.post("/auth/register", { ...form, avatarUrl: avatarPreview });
      toast.success(t("messages.created"));
      setShowModal(false); resetForm(); loadUsers();
    } catch (e) {
      toast.error(apiError(e, tc("errors.create")));
    } finally { setCreating(false); }
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setForm({
      email: user.email, password: "", firstName: user.firstName, lastName: user.lastName,
      phone: user.phone || "", pseudo: user.pseudo || "", sex: user.sex || "",
      address: user.address || "", roleName: user.role,
    });
    setAvatarPreview(user.avatarUrl || null);
    setStep(1);
    setShowModal(true);
    setOpenMenuId(null);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser || creating) return;
    setCreating(true);
    try {
      const payload: Record<string, string | null> = {
        email: form.email, firstName: form.firstName, lastName: form.lastName,
        phone: form.phone, pseudo: form.pseudo, sex: form.sex, address: form.address, roleName: form.roleName,
        avatarUrl: avatarPreview,
      };
      if (form.password) payload.password = form.password;
      await api.put(`/users/${editingUser.id}`, payload);
      toast.success(t("messages.updated"));
      setShowModal(false); resetForm(); loadUsers();
    } catch (e) {
      toast.error(apiError(e, t("messages.updateError")));
    } finally { setCreating(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try { await api.delete(`/users/${deleteTarget.id}`); toast.success(t("messages.deleted")); setDeleteTarget(null); loadUsers(); }
    catch (e) { toast.error(apiError(e, t("messages.deleteError"))); }
    finally { setDeleting(false); }
  }

  async function toggleStatus(userId: string, newStatus: string) {
    try { await api.patch(`/users/${userId}/status?status=${newStatus}`); toast.success(t("messages.statusUpdated")); loadUsers(); }
    catch (e) { toast.error(apiError(e, t("messages.statusError"))); }
  }

  function formatDate(date: string | null) {
    if (!date) return t("never");
    return new Date(date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  const filtered = users.filter((u) => {
    if (search && !`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && u.role !== filterRole) return false;
    // DISABLED et DEACTIVATED portent le meme libelle dans l'interface : le
    // filtre "Desactive" doit retenir les deux, sinon la carte de statistiques
    // annonce plus de comptes que la liste n'en affiche.
    if (filterStatus === "DISABLED" && u.status !== "DISABLED" && u.status !== "DEACTIVATED") return false;
    if (filterStatus && filterStatus !== "DISABLED" && u.status !== filterStatus) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "ACTIVE").length,
    disabled: users.filter((u) => u.status === "DISABLED" || u.status === "DEACTIVATED").length,
    roles: new Set(users.map((u) => u.role)).size,
  };

  const cardData = [
    { key: "total", count: stats.total, label: t("stats.totalUsers"), link: t("stats.viewAll"), filterValue: "", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="17" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M19 20c1.5-.5 3-2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ) },
    { key: "active", count: stats.active, label: t("stats.activeUsers"), link: t("stats.viewActive"), filterValue: "ACTIVE", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M16 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) },
    { key: "disabled", count: stats.disabled, label: t("stats.disabledUsers"), link: t("stats.viewDisabled"), filterValue: "DISABLED", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="18" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M16 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    ) },
    { key: "roles", count: stats.roles, label: t("stats.rolesCount"), link: t("stats.viewAll"), filterValue: "", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", icon: (
      <svg className="size-6" viewBox="0 0 24 24" fill="none"><path d="M12 2l2 4 4.5.7-3.3 3.1.8 4.5L12 12.4 8 14.3l.8-4.5L5.5 6.7 10 6l2-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M5 18h14M7 21h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
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
          <div className="relative">
            <button onClick={() => { resetForm(); setShowModal(true); }} className="primary-icon px-4 py-2.5 active-scale">
              <span className="flex items-center gap-2">
                <svg className="size-4" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-sm font-medium whitespace-nowrap">{t("newUser")}</p>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cardData.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.filterValue)}
            className="relative overflow-hidden rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 pl-6 shadow-card text-left cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <span className={`absolute top-0 bottom-0 left-0 w-1 ${accentBar(s.color)}`} aria-hidden="true" />
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={searchKeyHandler(setSearch)} placeholder={t("filters.searchPlaceholder")} className="input w-full h-10 pl-9" />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allRoles")}</option>
          {Object.keys(ROLE_LABELS).map((key) => (
            <option key={key} value={key}>{t(`roles.${key}`)}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input h-10 min-w-[140px]">
          <option value="">{t("filters.allStatuses")}</option>
          <option value="ACTIVE">{t("status.ACTIVE")}</option>
          <option value="LOCKED">{t("status.LOCKED")}</option>
          <option value="DISABLED">{t("status.DISABLED")}</option>
        </select>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[48px_1fr_1fr_80px_1.3fr_150px_90px_60px] gap-3 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/40 border-b border-border dark:border-neutral-800 rounded-t-2xl">
          {[t("columns.profile"), t("columns.name"), t("columns.firstName"), t("columns.sex"), t("columns.email"), t("columns.role"), t("columns.status"), t("columns.actions")].map((col, i) => (
            <span key={i} className={`text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400 flex items-center gap-1 ${i === 7 ? "justify-end" : ""}`}>
              {col}
              {i > 0 && i < 7 && <svg className="size-3 opacity-60" viewBox="0 0 12 12" fill="none"><path d="M4 5l2-2 2 2M4 7l2 2 2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hidden md:grid grid-cols-[48px_1fr_1fr_80px_1.3fr_150px_90px_60px] gap-3 items-center py-3.5">
                <Skeleton className="size-9 !rounded-full" />
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-12 h-4" />
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-24 h-5 !rounded-md" />
                <Skeleton className="w-14 h-5 !rounded-md" />
                <Skeleton className="w-6 h-6 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-5">
              <svg className="size-32" viewBox="0 0 130 130" fill="none">
                {/* Personnage principal */}
                <circle cx="55" cy="45" r="14" className="fill-blue-100 dark:fill-blue-900/20 stroke-blue-300 dark:stroke-blue-700/50" strokeWidth="1.5" />
                <circle cx="55" cy="42" r="6" className="fill-blue-200 dark:fill-blue-800/30" />
                <path d="M43 53c0-3 5.5-5 12-5s12 2 12 5" className="fill-blue-200 dark:fill-blue-800/30" />
                {/* Personnage secondaire */}
                <circle cx="75" cy="48" r="12" className="fill-sky-100 dark:fill-sky-900/15 stroke-sky-300 dark:stroke-sky-700/40" strokeWidth="1.5" />
                <circle cx="75" cy="45" r="5" className="fill-sky-200 dark:fill-sky-800/30" />
                <path d="M65 54c0-2.5 4.5-4 10-4s10 1.5 10 4" className="fill-sky-200 dark:fill-sky-800/30" />
                {/* Cercle + */}
                <circle cx="85" cy="78" r="14" className="fill-primary/15 stroke-primary/40" strokeWidth="1.5" />
                <path d="M85 72v12M79 78h12" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                {/* Étoiles déco */}
                <path d="M25 40l2 4 4 1-3 3 .5 4-3.5-2-3.5 2 .5-4-3-3 4-1 2-4z" className="fill-primary/20" />
                <circle cx="105" cy="35" r="2" className="fill-emerald-400/30" />
                <circle cx="30" cy="80" r="1.5" className="fill-amber-400/30" />
                <path d="M100 60l1.5 3 3 .7-2.2 2.2.4 3-2.7-1.5-2.7 1.5.4-3-2.2-2.2 3-.7 1.5-3z" className="fill-blue-400/20" />
              </svg>
              <div>
                <p className="text-base font-bold text-black dark:text-white">{users.length === 0 ? t("emptyTitle") : t("emptyFiltered")}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-2 max-w-md mx-auto leading-relaxed">{t("emptyDescription")}</p>
              </div>
              <button onClick={() => { resetForm(); setShowModal(true); }} className="primary-icon px-5 py-2.5 active-scale mt-1">
                <span className="flex items-center gap-2">
                  <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  <p className="text-sm font-medium">{t("createFirst")}</p>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {paginated.map((u) => (
              <div key={u.id} className="grid grid-cols-1 md:grid-cols-[48px_1fr_1fr_80px_1.3fr_150px_90px_60px] gap-2 md:gap-3 items-center px-6 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors cursor-pointer" onClick={() => setDetailUser(u)}>
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="size-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {u.lastName?.[0]}{u.firstName?.[0]}
                  </div>
                )}
                <p className="text-sm font-semibold text-black dark:text-white truncate">{u.lastName}</p>
                <p className="text-sm font-semibold text-black dark:text-white truncate">{u.firstName}</p>
                <span className="text-xs text-text-secondary dark:text-neutral-400">{u.sex ? t(`sex.${u.sex}`) : ""}</span>
                <p className="text-xs text-text-secondary dark:text-neutral-400 truncate">{u.email}</p>
                <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${ROLE_STYLES[u.role] || "bg-neutral-100 text-neutral-600"}`}>
                  {t(`roles.${u.role}`)}
                </span>
                <span className={`inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[u.status] || STATUS_STYLES.ACTIVE}`}>
                  {t(`status.${u.status}`)}
                </span>
                <div className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                    <svg className="size-5 text-neutral-500 dark:text-neutral-400" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="13" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                  <ActionMenu open={openMenuId === u.id} onClose={() => setOpenMenuId(null)} minWidth={160}>
                      <button onClick={() => { setDetailUser(u); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        {tc("status")}
                      </button>
                      <button onClick={() => openEditModal(u)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                        <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        {tc("edit")}
                      </button>
                      {u.status === "ACTIVE" ? (
                        <button onClick={() => { toggleStatus(u.id, "DISABLED"); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <svg className="size-4 text-amber-600" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                          {t("status.DISABLED")}
                        </button>
                      ) : (
                        <button onClick={() => { toggleStatus(u.id, "ACTIVE"); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-black dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <svg className="size-4 text-emerald-600" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          {t("status.ACTIVE")}
                        </button>
                      )}
                      <button onClick={() => { setDeleteTarget(u); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {tc("delete")}
                      </button>
                  </ActionMenu>
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

      {/* ===== MODAL CRÉATION / ÉDITION ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-black dark:text-white">{isEditing ? t("editTitle") : t("createTitle")}</h2>
                <p className="text-[11px] text-text-secondary dark:text-neutral-500 mt-0.5">
                  {t("form.stepOf", { step })} — {step === 1 ? t("form.step1") : t("form.step2")}
                </p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="px-6 pt-3 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-primary" />
              <div className={`flex-1 h-1 rounded-full transition-colors duration-300 ${step === 2 ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700"}`} />
            </div>

            <form onSubmit={isEditing ? handleUpdate : handleCreate}>
              {step === 1 && (
                <div className="px-6 py-5 flex flex-col gap-4 max-h-[55vh] overflow-y-auto">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" className="size-16 rounded-full object-cover border-2 border-border dark:border-neutral-700" />
                      ) : (
                        <div className="size-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border-2 border-dashed border-neutral-300 dark:border-neutral-600">
                          <svg className="size-6 text-neutral-400" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <svg className="size-4 text-white" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M6 4V3a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" /></svg>
                      </div>
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
                    <p className="text-[11px] text-neutral-400">{t("form.photoHint")}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.lastName")}</label>
                      <input value={form.lastName} onChange={(e) => { const lastName = e.target.value; setForm((prev) => ({ ...prev, lastName })); setStepError(""); updateEmailFromName(form.firstName, lastName); }} placeholder={t("form.lastNamePlaceholder")} className="input w-full h-10" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.firstName")}</label>
                      <input value={form.firstName} onChange={(e) => { const firstName = e.target.value; setForm((prev) => ({ ...prev, firstName })); setStepError(""); updateEmailFromName(firstName, form.lastName); }} placeholder={t("form.firstNamePlaceholder")} className="input w-full h-10" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.sex")}</label>
                      <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} className="input w-full h-10">
                        <option value="">{t("form.selectSex")}</option>
                        <option value="M">{t("sex.M")}</option>
                        <option value="F">{t("sex.F")}</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.pseudo")}</label>
                      <input value={form.pseudo} onChange={(e) => setForm({ ...form, pseudo: e.target.value })} placeholder={t("form.pseudoPlaceholder")} className="input w-full h-10" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      {/* L'adresse etait composee a partir du nom puis verrouillee
                          en lecture seule : l'administrateur ne pouvait pas attribuer
                          celle reellement utilisee par l'entreprise. Elle reste
                          pre-remplie, mais a titre de proposition modifiable. */}
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                        {t("form.email")}
                        {!isEditing && <span className="ml-1 text-[10px] text-text-secondary dark:text-neutral-500 font-normal normal-case tracking-normal">{t("form.emailSuggested")}</span>}
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailTouched(true); setStepError(""); }}
                          placeholder={t("form.emailPlaceholder")}
                          className="input w-full h-10 pr-9"
                        />
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => { setForm((prev) => ({ ...prev, email: generateUniqueEmail(prev.firstName, prev.lastName) })); setEmailTouched(false); setStepError(""); }}
                            title={t("form.emailRegenerate")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-400 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          >
                            <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0111.5-2.3M14 8a6 6 0 01-11.5 2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M13.5 2v3.7h-3.7M2.5 14v-3.7h3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.phone")}</label>
                      <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.address")}</label>
                    <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("form.addressPlaceholder")} className="input w-full h-10" />
                  </div>

                  {stepError && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
                      <svg className="size-3.5 text-red-500 shrink-0" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" /><path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{stepError}</p>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="px-6 py-5 flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-border dark:border-neutral-700">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{form.lastName?.[0]}{form.firstName?.[0]}</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black dark:text-white truncate">{form.lastName} {form.firstName}</p>
                      <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">{form.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">{t("form.roleLabel")}</label>
                    <select value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} className="input w-full h-10">
                      {Object.keys(ROLE_LABELS).map((key) => (
                        <option key={key} value={key}>{t(`roles.${key}`)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                      {isEditing ? t("form.passwordEdit") : t("form.password")}
                    </label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required={!isEditing} minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isEditing ? t("form.passwordPlaceholderEdit") : t("form.passwordPlaceholder")} className="input w-full h-10 pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
                        {showPassword ? (
                          <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M2.5 2.5l11 11M6.5 6.8a2.1 2.1 0 002.7 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M4.2 4.5C2.8 5.6 1.8 7.2 1.5 8c.6 1.5 2.8 5 6.5 5 1.2 0 2.3-.4 3.2-.9M9.5 3.2c-.5-.1-1-.2-1.5-.2C4.3 3 2.1 6.5 1.5 8c.3.7.8 1.5 1.4 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                        ) : (
                          <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M1.5 8c.6-1.5 2.8-5 6.5-5s5.9 3.5 6.5 5c-.6 1.5-2.8 5-6.5 5S2.1 9.5 1.5 8z" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" /></svg>
                        )}
                      </button>
                    </div>
                    {!isEditing && <p className="text-[11px] text-neutral-400">{t("form.passwordHint")}</p>}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <div>
                  {step === 2 && (
                    <button type="button" onClick={() => setStep(1)} className="secondary-icon px-3 py-2 active-scale">
                      <span className="flex items-center gap-1.5">
                        <svg className="size-4" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <p className="text-sm font-medium">{t("form.back")}</p>
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="tertiary-icon px-4 py-2 active-scale">
                    <p className="text-sm font-medium">{tc("cancel")}</p>
                  </button>
                  {step === 1 ? (
                    <button type="button" onClick={goToStep2} className="primary-icon px-5 py-2 active-scale">
                      <p className="text-sm font-medium">{t("form.next")}</p>
                    </button>
                  ) : (
                    <button type="submit" disabled={creating} className="primary-icon px-5 py-2 active-scale disabled:opacity-60">
                      <span className="flex items-center gap-2">
                        {creating && <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                        <p className="text-sm font-medium">{creating ? tc("saving") : tc("save")}</p>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAIL ===== */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setDetailUser(null); }}>
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">{t("detailTitle")}</h2>
              <button onClick={() => setDetailUser(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col items-center gap-4">
              {detailUser.avatarUrl ? (
                <img src={detailUser.avatarUrl} alt="" className="size-20 rounded-full object-cover border-2 border-border dark:border-neutral-700" />
              ) : (
                <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">{detailUser.lastName?.[0]}{detailUser.firstName?.[0]}</div>
              )}
              <div className="text-center">
                <p className="text-lg font-bold text-black dark:text-white">{detailUser.lastName} {detailUser.firstName}</p>
                <p className="text-sm text-text-secondary dark:text-neutral-400">{detailUser.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[detailUser.role] || "bg-neutral-100 text-neutral-600"}`}>{t(`roles.${detailUser.role}`)}</span>
                <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[detailUser.status] || STATUS_STYLES.ACTIVE}`}>{t(`status.${detailUser.status}`)}</span>
              </div>
            </div>
            <div className="px-6 pb-5 grid grid-cols-2 gap-3">
              {[
                { label: t("form.sex"), value: detailUser.sex ? t(`sex.${detailUser.sex}`) : t("notProvided") },
                { label: t("form.phone"), value: detailUser.phone || t("notProvided") },
                { label: t("form.pseudo"), value: detailUser.pseudo || t("notProvided") },
                { label: t("lastLogin"), value: formatDate(detailUser.lastLoginAt) },
                { label: t("createdAt"), value: formatDate(detailUser.createdAt) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{item.label}</span>
                  <span className="text-sm text-black dark:text-neutral-300">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button onClick={() => { openEditModal(detailUser); setDetailUser(null); }} className="secondary-icon px-4 py-2 active-scale">
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                  <p className="text-sm font-medium">{tc("edit")}</p>
                </span>
              </button>
              <button onClick={() => setDetailUser(null)} className="tertiary-icon px-4 py-2 active-scale">
                <p className="text-sm font-medium">{tc("close")}</p>
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
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.lastName} {deleteTarget.firstName}</span> — {t("messages.deleteWarning")}
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

    </div>
  );
}
