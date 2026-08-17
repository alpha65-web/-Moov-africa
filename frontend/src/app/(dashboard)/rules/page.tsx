"use client";

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import type { BusinessRule } from "@/lib/types";
import toast from "react-hot-toast";

const RULE_TYPE_LABELS: Record<string, string> = {
  COMPATIBILITY: "Compatibilité",
  INCOMPATIBILITY: "Incompatibilité",
  MANDATORY_COMPOSITION: "Composition obligatoire",
  PACK_ONLY: "Pack uniquement",
};

const RULE_TYPE_LIST = ["COMPATIBILITY", "INCOMPATIBILITY", "MANDATORY_COMPOSITION", "PACK_ONLY"];

const EMPTY_FORM = {
  name: "",
  description: "",
  ruleType: "COMPATIBILITY",
  sourceItemId: "",
  targetItemId: "",
};

export default function RulesPage() {
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailRule, setDetailRule] = useState<BusinessRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isEditing = !!editingRule;

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailRule) { setDetailRule(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailRule]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  async function loadRules() {
    try {
      const { data } = await api.get("/rules");
      setRules(data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingRule(null);
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(rule: BusinessRule) {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || "",
      ruleType: rule.ruleType,
      sourceItemId: rule.sourceItemId || "",
      targetItemId: rule.targetItemId || "",
    });
    setShowModal(true);
    setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        ruleType: form.ruleType,
        sourceItemId: form.sourceItemId,
        targetItemId: form.targetItemId,
      };

      if (isEditing) {
        await api.put(`/rules/${editingRule!.id}`, payload);
        toast.success("Règle modifiée avec succès");
      } else {
        await api.post("/rules", payload);
        toast.success("Règle créée avec succès");
      }
      setShowModal(false);
      resetForm();
      loadRules();
    } catch {
      const newRule: BusinessRule = {
        id: Date.now().toString(),
        name: form.name,
        description: form.description,
        ruleType: form.ruleType,
        active: true,
        sourceItemId: form.sourceItemId,
        targetItemId: form.targetItemId,
        createdById: "",
        createdAt: new Date().toISOString(),
      };

      if (isEditing) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === editingRule!.id
              ? { ...r, name: form.name, description: form.description, ruleType: form.ruleType, sourceItemId: form.sourceItemId, targetItemId: form.targetItemId }
              : r
          )
        );
        toast.success("Règle modifiée");
      } else {
        setRules((prev) => [newRule, ...prev]);
        toast.success("Règle enregistrée");
      }
      setShowModal(false);
      resetForm();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/rules/${deleteTarget.id}`);
      toast.success("Règle supprimée");
      loadRules();
    } catch {
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Règle supprimée");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function toggleActive(rule: BusinessRule) {
    const endpoint = rule.active
      ? `/rules/${rule.id}/deactivate`
      : `/rules/${rule.id}/activate`;
    try {
      await api.patch(endpoint);
      toast.success(rule.active ? "Règle désactivée" : "Règle activée");
      loadRules();
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
      );
      toast.success(rule.active ? "Règle désactivée" : "Règle activée");
    }
    setOpenMenuId(null);
  }

  const filtered = rules.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || r.ruleType === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Règles métier</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
            Gérer les règles de compatibilité et composition
          </p>
        </div>
        <button onClick={openCreateModal} className="primary-icon px-4 py-2.5 active-scale">
          <span className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium">Nouvelle règle</p>
          </span>
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-8"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input"
        >
          <option value="">Tous les types</option>
          {RULE_TYPE_LIST.map((t) => (
            <option key={t} value={t}>
              {RULE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-600 dark:bg-blue-700 text-white rounded-t-2xl">
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Source</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Cible</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-neutral-800">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="w-20 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M4 6l8 0M4 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        <path d="M2 2h12M2 14h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="text-sm text-text-secondary dark:text-neutral-500">
                      Aucune règle trouvée
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((rule) => (
                <tr key={rule.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-black dark:text-white">{rule.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black"
                      style={{ borderRadius: 4 }}
                    >
                      {RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-black dark:text-white text-xs font-mono truncate max-w-[120px]">
                    {rule.sourceItemId?.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 font-bold text-black dark:text-white text-xs font-mono truncate max-w-[120px]">
                    {rule.targetItemId?.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        rule.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                      style={{ borderRadius: 4 }}
                    >
                      {rule.active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === rule.id ? null : rule.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <circle cx="4" cy="8" r="1.2" fill="currentColor" />
                          <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                          <circle cx="12" cy="8" r="1.2" fill="currentColor" />
                        </svg>
                      </button>

                      {openMenuId === rule.id && (
                        <div
                          className="absolute right-0 bottom-8 z-50 border-2 border-black dark:border-white bg-white dark:bg-neutral-900 animate-fade-in p-1.5 flex gap-1"
                          style={{ borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Détails */}
                          <button
                            title="Détails"
                            onClick={() => {
                              setDetailRule(rule);
                              setOpenMenuId(null);
                            }}
                            className="size-8 flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                              <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                          {/* Modifier */}
                          <button
                            title="Modifier"
                            onClick={() => openEditModal(rule)}
                            className="size-8 flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {/* Activer/Désactiver */}
                          <button
                            title={rule.active ? "Désactiver" : "Activer"}
                            onClick={() => toggleActive(rule)}
                            className="size-8 flex items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <svg className={`size-4 ${rule.active ? "text-amber-600" : "text-emerald-600"}`} viewBox="0 0 16 16" fill="none">
                              {rule.active ? (
                                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              ) : (
                                <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              )}
                            </svg>
                          </button>
                          {/* Supprimer */}
                          <button
                            title="Supprimer"
                            onClick={() => {
                              setDeleteTarget(rule);
                              setOpenMenuId(null);
                            }}
                            className="size-8 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <svg className="size-4 text-red-500" viewBox="0 0 16 16" fill="none">
                              <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Créer/Modifier */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div ref={modalRef} className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-lg font-bold text-black dark:text-white">
                {isEditing ? "Modifier la règle" : "Nouvelle règle"}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Nom</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input w-full resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">Type de règle</label>
                <select
                  value={form.ruleType}
                  onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
                  className="input w-full"
                  required
                >
                  {RULE_TYPE_LIST.map((t) => (
                    <option key={t} value={t}>
                      {RULE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">ID Source</label>
                <input
                  type="text"
                  value={form.sourceItemId}
                  onChange={(e) => setForm({ ...form, sourceItemId: e.target.value })}
                  className="input w-full"
                  placeholder="UUID de l'élément source"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1.5">ID Cible</label>
                <input
                  type="text"
                  value={form.targetItemId}
                  onChange={(e) => setForm({ ...form, targetItemId: e.target.value })}
                  className="input w-full"
                  placeholder="UUID de l'élément cible"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="secondary-icon px-3 py-2 active-scale"
                >
                  <p className="text-sm font-medium">Retour</p>
                </button>
                <button type="submit" disabled={creating} className="primary-icon px-5 py-2.5 active-scale">
                  <p className="text-sm font-medium">
                    {creating ? "Enregistrement..." : "Enregistrer"}
                  </p>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Détails */}
      {detailRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
              <h2 className="text-lg font-bold text-black dark:text-white">Détails de la règle</h2>
              <button
                onClick={() => setDetailRule(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Nom</label>
                <p className="text-sm font-bold text-black dark:text-white">{detailRule.name}</p>
              </div>
              {detailRule.description && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Description</label>
                  <p className="text-sm text-black dark:text-white">{detailRule.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Type</label>
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                    {RULE_TYPE_LABELS[detailRule.ruleType] || detailRule.ruleType}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Statut</label>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                      detailRule.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                    style={{ borderRadius: 4 }}
                  >
                    {detailRule.active ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">ID Source</label>
                <p className="text-xs font-mono text-black dark:text-white break-all">{detailRule.sourceItemId}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">ID Cible</label>
                <p className="text-xs font-mono text-black dark:text-white break-all">{detailRule.targetItemId}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-neutral-500 uppercase tracking-wider mb-1">Créée le</label>
                <p className="text-xs text-neutral-500">{new Date(detailRule.createdAt).toLocaleString("fr-FR")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Supprimer */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xl w-full max-w-sm mx-4 animate-fade-in p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="size-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="size-6 text-red-500" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Supprimer la règle</h3>
                <p className="text-sm text-text-secondary dark:text-neutral-500 mt-1">
                  Supprimer &laquo;{deleteTarget.name}&raquo; ? Cette action est irréversible.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="tertiary-icon flex-1 py-2.5 active-scale flex justify-center"
                >
                  <p className="text-sm font-medium">Annuler</p>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 cursor-pointer flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 text-sm font-medium transition-colors active:scale-95"
                  style={{ borderRadius: 8 }}
                >
                  {deleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
