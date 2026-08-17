"use client";

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import type { User } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import toast from "react-hot-toast";
import PhoneInput from "@/components/PhoneInput";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  LOCKED: "Verrouillé",
  DISABLED: "Désactivé",
  DEACTIVATED: "Désactivé",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  LOCKED: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
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

const GENDER_LABELS: Record<string, string> = { M: "Masculin", F: "Féminin" };

function formatDate(date: string | null) {
  if (!date) return "Jamais";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Draft {
  id: string;
  form: typeof EMPTY_FORM;
  avatarPreview: string | null;
  step: number;
  savedAt: string;
}

const EMPTY_FORM = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  pseudo: "",
  gender: "",
  address: "",
  roleName: "CHEF_PRODUIT",
};

const DRAFTS_KEY = "pim_user_drafts";

function loadDraftsFromStorage(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]");
  } catch { return []; }
}

function saveDraftsToStorage(drafts: Draft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Création / Édition
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Brouillons
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // Détail utilisateur
  const [detailUser, setDetailUser] = useState<User | null>(null);

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Menu actions
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    setDrafts(loadDraftsFromStorage());
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailUser) { setDetailUser(null); return; }
        if (showDrafts) { setShowDrafts(false); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailUser, showDrafts]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  async function loadUsers() {
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La photo ne doit pas dépasser 2 Mo");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setAvatarFile(null);
    setAvatarPreview(null);
    setStep(1);
    setStepError("");
    setEditingUser(null);
    setShowPassword(false);
  }

  // ===== BROUILLONS =====
  function handleSaveDraft() {
    const hasData = form.firstName || form.lastName || form.email || form.phone || form.pseudo;
    if (!hasData) {
      toast.error("Aucune donnée à sauvegarder");
      return;
    }
    const draft: Draft = {
      id: Date.now().toString(),
      form: { ...form },
      avatarPreview,
      step,
      savedAt: new Date().toISOString(),
    };
    const updated = [draft, ...drafts];
    setDrafts(updated);
    saveDraftsToStorage(updated);
    toast.success("Brouillon sauvegardé");
    setShowModal(false);
    resetForm();
  }

  function handleRestoreDraft(draft: Draft) {
    setForm({ ...draft.form });
    setAvatarPreview(draft.avatarPreview);
    setStep(draft.step);
    setShowDrafts(false);
    setShowModal(true);
  }

  function handleDeleteDraft(id: string) {
    const updated = drafts.filter((d) => d.id !== id);
    setDrafts(updated);
    saveDraftsToStorage(updated);
    toast.success("Brouillon supprimé");
  }

  // ===== GÉNÉRATION EMAIL UNIQUE =====
  function generateUniqueEmail(firstName: string, lastName: string): string {
    if (!firstName.trim() || !lastName.trim()) return "";
    const normalize = (s: string) =>
      s.trim().toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z]/g, "");
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
    const existingEmails = new Set(
      users
        .filter((u) => !editingUser || u.id !== editingUser.id)
        .map((u) => u.email.toLowerCase())
    );
    let candidate = `${prefix}${randChars(6)}${domain}`;
    while (existingEmails.has(candidate)) {
      candidate = `${prefix}${randChars(6)}${domain}`;
    }
    return candidate;
  }

  function updateEmailFromName(firstName: string, lastName: string) {
    if (!isEditing) {
      const email = generateUniqueEmail(firstName, lastName);
      setForm((prev) => ({ ...prev, email }));
    }
  }

  // ===== VALIDATION =====
  function validateStep1(): boolean {
    if (!form.lastName.trim()) { setStepError("Le nom est requis"); return false; }
    if (!form.firstName.trim()) { setStepError("Le prénom est requis"); return false; }
    if (!form.email.trim()) { setStepError("L'email est requis"); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { setStepError("Format d'email invalide"); return false; }
    setStepError("");
    return true;
  }

  function goToStep2() {
    if (validateStep1()) setStep(2);
  }

  // ===== CREATE =====
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const { data } = await api.post("/auth/register", form);
      if (avatarFile && data?.id) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        await api.post(`/users/${data.id}/avatar`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        }).catch(() => {});
      }
      toast.success("Utilisateur créé avec succès");
      setShowModal(false);
      resetForm();
      loadUsers();
    } catch {
      const newUser: User = {
        id: Date.now().toString(),
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender || null,
        phone: form.phone || null,
        pseudo: form.pseudo || null,
        avatarUrl: avatarPreview,
        role: form.roleName,
        status: "ACTIVE",
        forcePasswordChange: false,
        totpEnabled: false,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
      };
      setUsers((prev) => [newUser, ...prev]);
      toast.success("Utilisateur enregistré");
      setShowModal(false);
      resetForm();
    } finally {
      setCreating(false);
    }
  }

  // ===== UPDATE =====
  function openEditModal(user: User) {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || "",
      pseudo: user.pseudo || "",
      gender: user.gender || "",
      address: "",
      roleName: user.role,
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
      const payload: Record<string, string> = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        pseudo: form.pseudo,
        gender: form.gender,
        roleName: form.roleName,
      };
      if (form.password) payload.password = form.password;
      await api.put(`/users/${editingUser.id}`, payload);
      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        await api.post(`/users/${editingUser.id}/avatar`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        }).catch(() => {});
      }
      toast.success("Utilisateur modifié avec succès");
      setShowModal(false);
      resetForm();
      loadUsers();
    } catch {
      toast.error("Erreur lors de la modification");
    } finally {
      setCreating(false);
    }
  }

  // ===== DELETE =====
  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success("Utilisateur supprimé");
      setDeleteTarget(null);
      loadUsers();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  }

  // ===== STATUS =====
  async function toggleStatus(userId: string, newStatus: string) {
    try {
      await api.patch(`/users/${userId}/status?status=${newStatus}`);
      toast.success("Statut mis à jour");
      loadUsers();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const activeCount = users.filter((u) => u.status === "ACTIVE").length;
  const isEditing = !!editingUser;

  return (
    <div className="max-w-7xl">
      {/* ===== EN-TÊTE ===== */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-secondary dark:text-white">
            Gestion des utilisateurs
          </h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-neutral-400">
            {users.length} compte{users.length > 1 ? "s" : ""}, {activeCount} actif{activeCount > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDrafts(true)}
            className="secondary-icon px-4 py-2 active-scale relative"
          >
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M5 9h6M5 11.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium whitespace-nowrap">Brouillons</p>
            </span>
            {drafts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 size-5 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">
                {drafts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="primary-icon px-4 py-2 active-scale"
          >
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium whitespace-nowrap">Nouvel utilisateur</p>
            </span>
          </button>
        </div>
      </div>

      {/* ===== FILTRES ===== */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="input w-full h-9 pl-9"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="input h-9 pr-8 text-sm"
        >
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input h-9 pr-8 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="LOCKED">Verrouillé</option>
          <option value="DISABLED">Désactivé</option>
        </select>
      </div>

      {/* ===== TABLEAU ===== */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_1fr_80px_1.3fr_150px_100px_100px] gap-3 px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Profil</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Nom</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Prénom</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Sexe</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Email</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Rôle</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">Statut</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="size-9 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-32 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  <div className="w-48 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-text-secondary dark:text-neutral-500">
              {users.length === 0 ? "Aucun utilisateur trouvé" : "Aucun résultat pour ces filtres"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-[48px_1fr_1fr_80px_1.3fr_150px_100px_100px] gap-3 items-center px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
              >
                {/* Profil */}
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="size-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {u.lastName?.[0]}{u.firstName?.[0]}
                  </div>
                )}

                {/* Nom */}
                <p className="text-sm font-bold text-black dark:text-white truncate">
                  {u.lastName}
                </p>

                {/* Prénom */}
                <p className="text-sm font-bold text-black dark:text-white truncate">
                  {u.firstName}
                </p>

                {/* Sexe */}
                <span className="text-xs font-bold text-black dark:text-white">
                  {GENDER_LABELS[u.gender || ""] || ""}
                </span>

                {/* Email */}
                <p className="text-xs font-bold text-black dark:text-white truncate">
                  {u.email}
                </p>

                {/* Rôle */}
                <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>

                {/* Statut */}
                <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {STATUS_LABELS[u.status] || u.status}
                </span>

                {/* Actions */}
                <div className="flex justify-end relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === u.id ? null : u.id); }}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-black dark:text-white" viewBox="0 0 16 16" fill="none" strokeWidth="0">
                      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                    </svg>
                  </button>

                  {openMenuId === u.id && (
                    <div
                      className="absolute right-0 bottom-8 z-40 bg-white dark:bg-neutral-800 border-2 border-black dark:border-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] p-1.5 flex gap-1" style={{ borderRadius: 6, width: "auto" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setDetailUser(u); setOpenMenuId(null); }}
                        title="Voir le profil"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEditModal(u)}
                        title="Modifier"
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {u.status === "ACTIVE" ? (
                        <button
                          onClick={() => { toggleStatus(u.id, "DISABLED"); setOpenMenuId(null); }}
                          title="Désactiver"
                          className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => { toggleStatus(u.id, "ACTIVE"); setOpenMenuId(null); }}
                          title={u.status === "LOCKED" ? "Débloquer" : "Activer"}
                          className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteTarget(u); setOpenMenuId(null); }}
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

      {/* ===== MODAL CRÉATION / ÉDITION ===== */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-700 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-secondary dark:text-white">
                  {isEditing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
                </h2>
                <p className="text-[11px] text-text-secondary dark:text-neutral-500 mt-0.5">
                  Étape {step} sur 2 {step === 1 ? "Informations personnelles" : "Accès et sécurité"}
                </p>
              </div>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Stepper */}
            <div className="px-5 pt-3 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-primary" />
              <div className={`flex-1 h-1 rounded-full transition-colors duration-300 ${step === 2 ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700"}`} />
            </div>

            <form onSubmit={isEditing ? handleUpdate : handleCreate}>
              {/* ===== ÉTAPE 1 ===== */}
              {step === 1 && (
                <div className="px-5 py-4 flex flex-col gap-3">
                  {/* Photo de profil */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Photo de profil"
                          className="size-16 rounded-full object-cover border-2 border-border dark:border-neutral-700"
                        />
                      ) : (
                        <div className="size-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border-2 border-dashed border-neutral-300 dark:border-neutral-600">
                          <svg className="size-6 text-neutral-400" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <svg className="size-4 text-white" viewBox="0 0 20 20" fill="none">
                          <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M6 4V3a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </div>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <p className="text-[11px] text-neutral-400">
                      Importer une photo (JPG, PNG)
                    </p>
                  </div>

                  {/* Nom + Prénom */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Nom</label>
                      <input
                        value={form.lastName}
                        onChange={(e) => {
                          const lastName = e.target.value;
                          setForm((prev) => ({ ...prev, lastName }));
                          setStepError("");
                          updateEmailFromName(form.firstName, lastName);
                        }}
                        placeholder="Nom de famille"
                        className="input w-full h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Prénom</label>
                      <input
                        value={form.firstName}
                        onChange={(e) => {
                          const firstName = e.target.value;
                          setForm((prev) => ({ ...prev, firstName }));
                          setStepError("");
                          updateEmailFromName(firstName, form.lastName);
                        }}
                        placeholder="Prénom"
                        className="input w-full h-9"
                      />
                    </div>
                  </div>

                  {/* Sexe + Pseudo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Sexe</label>
                      <select
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="input w-full h-9"
                      >
                        <option value="">Sélectionner</option>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Pseudo</label>
                      <input
                        value={form.pseudo}
                        onChange={(e) => setForm({ ...form, pseudo: e.target.value })}
                        placeholder="Nom d'utilisateur"
                        className="input w-full h-9"
                      />
                    </div>
                  </div>

                  {/* Email + Téléphone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">
                        Adresse email
                        {!isEditing && (
                          <span className="ml-1 text-[10px] text-primary font-normal">(auto)</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={form.email}
                          readOnly={!isEditing}
                          onChange={isEditing ? (e) => { setForm({ ...form, email: e.target.value }); setStepError(""); } : undefined}
                          placeholder="prenom.nom@moov-africa.bf"
                          className={`input w-full h-9 ${!isEditing ? "bg-neutral-50 dark:bg-neutral-800/50 text-text-secondary dark:text-neutral-400 cursor-default" : ""}`}
                        />
                        {!isEditing && form.email && (
                          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-emerald-500" viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 8l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Téléphone</label>
                      <PhoneInput
                        value={form.phone}
                        onChange={(v) => setForm({ ...form, phone: v })}
                      />
                    </div>
                  </div>

                  {/* Adresse */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Adresse résidentielle</label>
                    <input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Quartier, ville"
                      className="input w-full h-9"
                    />
                  </div>

                  {stepError && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-danger/5 border border-danger/20">
                      <svg className="size-3.5 text-danger shrink-0" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <p className="text-[11px] text-danger font-medium">{stepError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ===== ÉTAPE 2 ===== */}
              {step === 2 && (
                <div className="px-5 py-4 flex flex-col gap-3">
                  {/* Récapitulatif */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-border dark:border-neutral-700">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {form.lastName?.[0]}{form.firstName?.[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-secondary dark:text-white truncate">
                        {form.lastName} {form.firstName}
                      </p>
                      <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">
                        {form.email}
                      </p>
                    </div>
                  </div>

                  {/* Rôle */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">Rôle attribué</label>
                    <select
                      value={form.roleName}
                      onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                      className="input w-full h-9"
                    >
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mot de passe */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">
                      {isEditing ? "Nouveau mot de passe (optionnel)" : "Mot de passe temporaire"}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required={!isEditing}
                        minLength={12}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder={isEditing ? "Laisser vide pour ne pas changer" : "Min. 12 caractères"}
                        className="input w-full h-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-secondary dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? (
                          <svg className="size-4" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 2.5l11 11M6.5 6.8a2.1 2.1 0 002.7 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            <path d="M4.2 4.5C2.8 5.6 1.8 7.2 1.5 8c.6 1.5 2.8 5 6.5 5 1.2 0 2.3-.4 3.2-.9M9.5 3.2c-.5-.1-1-.2-1.5-.2C4.3 3 2.1 6.5 1.5 8c.3.7.8 1.5 1.4 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg className="size-4" viewBox="0 0 16 16" fill="none">
                            <path d="M1.5 8c.6-1.5 2.8-5 6.5-5s5.9 3.5 6.5 5c-.6 1.5-2.8 5-6.5 5S2.1 9.5 1.5 8z" stroke="currentColor" strokeWidth="1.3" />
                            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {!isEditing && (
                      <p className="text-[11px] text-neutral-400">
                        L&apos;utilisateur devra changer son mot de passe à la première connexion.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <div>
                  {step === 2 && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex items-center gap-1.5 secondary-icon px-3 py-2 active-scale"
                    >
                      <svg className="size-4" viewBox="0 0 16 16" fill="none">
                        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="text-sm font-medium">Retour</p>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="secondary-icon px-3 py-2 active-scale"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
                          <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                          <path d="M5 9h6M5 11.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        <p className="text-sm font-medium">Brouillon</p>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="tertiary-icon px-3 py-2 active-scale"
                  >
                    <p className="text-sm font-medium">Annuler</p>
                  </button>
                  {step === 1 ? (
                    <button
                      type="button"
                      onClick={goToStep2}
                      className="primary-icon px-5 py-2 active-scale"
                    >
                      <p className="text-sm font-medium">Suivant</p>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={creating}
                      className="primary-icon px-5 py-2 active-scale disabled:opacity-60"
                    >
                      <span className="flex items-center gap-2">
                        {creating && (
                          <svg className="size-4 animate-spin" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.12 2.12M10.48 10.48l2.12 2.12M3.4 12.6l2.12-2.12M10.48 5.52l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                        <p className="text-sm font-medium">
                          {creating ? (isEditing ? "Modification..." : "Enregistrement...") : "Enregistrer"}
                        </p>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL DÉTAIL UTILISATEUR ===== */}
      {detailUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailUser(null); }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-secondary dark:text-white">Profil utilisateur</h2>
              <button
                onClick={() => setDetailUser(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col items-center gap-4">
              {detailUser.avatarUrl ? (
                <img src={detailUser.avatarUrl} alt="" className="size-20 rounded-full object-cover border-2 border-border dark:border-neutral-700" />
              ) : (
                <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {detailUser.lastName?.[0]}{detailUser.firstName?.[0]}
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-bold text-secondary dark:text-white">
                  {detailUser.lastName} {detailUser.firstName}
                </p>
                <p className="text-sm text-text-secondary dark:text-neutral-400">{detailUser.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-medium ${ROLE_STYLES[detailUser.role] || "bg-neutral-100 text-neutral-600"}`}>
                  {ROLE_LABELS[detailUser.role] || detailUser.role}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[detailUser.status] || STATUS_STYLES.ACTIVE}`}>
                  {STATUS_LABELS[detailUser.status] || detailUser.status}
                </span>
              </div>
            </div>
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              {[
                { label: "Sexe", value: GENDER_LABELS[detailUser.gender || ""] || "Non renseigné" },
                { label: "Téléphone", value: detailUser.phone || "Non renseigné" },
                { label: "Pseudo", value: detailUser.pseudo || "Non renseigné" },
                { label: "Dernière connexion", value: formatDate(detailUser.lastLoginAt) },
                { label: "Créé le", value: formatDate(detailUser.createdAt) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-500">{item.label}</span>
                  <span className="text-sm text-secondary dark:text-neutral-300">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button
                onClick={() => { openEditModal(detailUser); setDetailUser(null); }}
                className="primary-icon flex-1 py-2 active-scale"
              >
                <p className="text-sm font-medium">Modifier</p>
              </button>
              <button
                onClick={() => setDetailUser(null)}
                className="tertiary-icon flex-1 py-2 active-scale"
              >
                <p className="text-sm font-medium">Fermer</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CONFIRMATION SUPPRESSION ===== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-700 shadow-2xl overflow-hidden">
            <div className="px-5 py-5 flex flex-col items-center gap-3 text-center">
              <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="size-6 text-red-600 dark:text-red-400" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-secondary dark:text-white">Supprimer cet utilisateur ?</h3>
              <p className="text-sm text-text-secondary dark:text-neutral-400">
                Le compte de <span className="font-semibold text-secondary dark:text-white">{deleteTarget.lastName} {deleteTarget.firstName}</span> sera définitivement supprimé. Cette action est irréversible.
              </p>
            </div>
            <div className="flex items-center gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button
                onClick={() => setDeleteTarget(null)}
                className="tertiary-icon flex-1 py-2 active-scale"
              >
                <p className="text-sm font-medium">Annuler</p>
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer active-scale"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL BROUILLONS ===== */}
      {showDrafts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDrafts(false); }}
        >
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-secondary dark:text-white">Brouillons</h2>
                <p className="text-[11px] text-text-secondary dark:text-neutral-500 mt-0.5">
                  {drafts.length} inscription{drafts.length > 1 ? "s" : ""} inachevée{drafts.length > 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setShowDrafts(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {drafts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <svg className="size-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
                  <path d="M5 3h10l4 4v14a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <p className="text-sm text-text-secondary dark:text-neutral-500">Aucun brouillon</p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Les inscriptions non terminées apparaîtront ici
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-border dark:divide-neutral-800">
                {drafts.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                    {d.avatarPreview ? (
                      <img src={d.avatarPreview} alt="" className="size-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {d.form.lastName?.[0]}{d.form.firstName?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary dark:text-white truncate">
                        {d.form.lastName || d.form.firstName ? `${d.form.lastName} ${d.form.firstName}`.trim() : "Sans nom"}
                      </p>
                      <p className="text-[11px] text-text-secondary dark:text-neutral-500 truncate">
                        {d.form.email || "Email non renseigné"} . Étape {d.step}/2
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRestoreDraft(d)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        Reprendre
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(d.id)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
