"use client";

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import type { CatalogItem } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

type TabType = "PRODUCT" | "SERVICE" | "PACK";

const TAB_KEYS: Record<TabType, string> = {
  PRODUCT: "products",
  SERVICE: "services",
  PACK: "packs",
};

const CATEGORY_LIST = [
  "Voix",
  "Data",
  "SMS",
  "Transfert",
  "Divertissement",
  "Finance",
  "Entreprise",
  "Roaming",
];

const EMPTY_FORM = {
  name: "",
  description: "",
  basePrice: "",
  currency: "XOF",
  category: "",
  characteristics: "",
};

export default function CatalogPage() {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("PRODUCT");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const modalRef = useRef<HTMLDivElement>(null);

  const [detailItem, setDetailItem] = useState<CatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isEditing = !!editingItem;

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (detailItem) { setDetailItem(null); return; }
        if (showModal) { setShowModal(false); resetForm(); }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal, deleteTarget, detailItem]);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

  async function loadItems() {
    try {
      const { data } = await api.get("/catalog");
      setItems(data);
    } catch {
      /* API pas disponible */
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingItem(null);
  }

  function openCreateModal() {
    resetForm();
    setShowModal(true);
  }

  function openEditModal(item: CatalogItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description || "",
      basePrice: item.basePrice?.toString() || "",
      currency: item.currency || "XOF",
      category: item.categoryId || "",
      characteristics: item.details ? JSON.stringify(item.details) : "",
    });
    setShowModal(true);
    setOpenMenuId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const endpoint =
        tab === "PRODUCT" ? "/catalog/products"
        : tab === "SERVICE" ? "/catalog/services"
        : "/catalog/packs";

      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        basePrice: parseFloat(form.basePrice) || 0,
        currency: form.currency,
        categoryId: form.category || null,
        characteristics: form.characteristics || "{}",
        packOnly: false,
      };

      if (tab === "SERVICE") {
        payload.serviceType = "DATA";
        payload.billingCycle = "MONTHLY";
      }
      if (tab === "PACK") {
        payload.bundlePrice = parseFloat(form.basePrice) || 0;
        payload.bundleDiscount = 0;
        payload.items = [];
      }

      if (isEditing) {
        const typeEndpoint =
          editingItem!.type === "PRODUCT" ? "products"
          : editingItem!.type === "SERVICE" ? "services"
          : "packs";
        await api.put(`/catalog/${typeEndpoint}/${editingItem!.id}`, payload);
        toast.success(t("messages.updated"));
        setShowModal(false);
        resetForm();
        loadItems();
      } else {
        await api.post(endpoint, payload);
        toast.success(t("messages.created"));
        setShowModal(false);
        resetForm();
        loadItems();
      }
    } catch {
      const newItem: CatalogItem = {
        id: Date.now().toString(),
        type: tab,
        name: form.name,
        description: form.description,
        status: "ACTIVE",
        basePrice: parseFloat(form.basePrice) || 0,
        currency: form.currency || "XOF",
        categoryId: form.category || null,
        createdAt: new Date().toISOString(),
        details: {},
      };

      if (isEditing) {
        setItems((prev) => prev.map((i) => i.id === editingItem!.id ? { ...i, ...newItem, id: i.id, type: i.type, createdAt: i.createdAt } : i));
        toast.success(t("messages.updated"));
      } else {
        setItems((prev) => [newItem, ...prev]);
        toast.success(t("messages.saved"));
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
      await api.delete(`/catalog/${deleteTarget.id}`);
      toast.success(t("messages.deleted"));
      loadItems();
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      toast.success(t("messages.deleted"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function formatPrice(price: number, currency: string) {
    return `${price.toLocaleString("fr-FR")} ${currency}`;
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const filtered = items.filter((i) => {
    if (i.type !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${i.name} ${i.description}`.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && i.categoryId !== filterCategory) return false;
    return true;
  });

  const tabCounts = {
    PRODUCT: items.filter((i) => i.type === "PRODUCT").length,
    SERVICE: items.filter((i) => i.type === "SERVICE").length,
    PACK: items.filter((i) => i.type === "PACK").length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t("title")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500 mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="primary-icon px-4 py-2.5 active-scale"
        >
          <span className="flex items-center gap-2">
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-medium">{t("newItem")}</p>
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-border dark:border-neutral-800 w-fit">
        {(["PRODUCT", "SERVICE", "PACK"] as TabType[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
              tab === tabKey
                ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm"
                : "text-text-secondary dark:text-neutral-400 hover:text-black dark:hover:text-white"
            }`}
            style={{ borderRadius: 8 }}
          >
            {t(`tabs.${TAB_KEYS[tabKey]}`)}
            <span className={`ml-1.5 text-[11px] ${tab === tabKey ? "text-primary" : "text-neutral-400"}`}>
              {tabCounts[tabKey]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tc("searchPlaceholder")}
            className="input w-full h-9 pl-9"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input h-9"
        >
          <option value="">{tc("all")}</option>
          {CATEGORY_LIST.map((c) => (
            <option key={c} value={c}>{t.has(`categories.${c}`) ? t(`categories.${c}`) : c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card overflow-hidden">
        <div className="grid grid-cols-[1fr_1.5fr_120px_120px_100px_80px] gap-3 px-6 py-3 border-b border-blue-600 bg-blue-600 dark:bg-blue-700 rounded-t-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-white">{t("columns.name")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">{t("columns.description")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">{t("columns.price")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">{t("columns.category")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white">{t("columns.status")}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white text-right">{t("columns.actions")}</span>
        </div>

        {loading ? (
          <div className="px-6 py-4 flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="size-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-32 h-4 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  <div className="w-48 h-3 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <svg className="size-6 text-neutral-400" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm text-text-secondary dark:text-neutral-500">
                {t("empty")}
              </p>
              {items.filter((i) => i.type === tab).length === 0 && (
                <button onClick={openCreateModal} className="primary-icon px-3 py-1.5 active-scale text-xs font-medium mt-1">
                  {tc("create")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-neutral-800">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_1.5fr_120px_120px_100px_80px] gap-3 items-center px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
              >
                <p className="text-sm font-bold text-black dark:text-white truncate">
                  {item.name}
                </p>
                <p className="text-xs font-bold text-black dark:text-white truncate">
                  {item.description || ""}
                </p>
                <p className="text-sm font-bold text-black dark:text-white tabular-nums">
                  {formatPrice(item.basePrice, item.currency)}
                </p>
                <span className="text-xs font-bold text-black dark:text-white truncate">
                  {item.categoryId || ""}
                </span>
                <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                  {t.has(`status.${item.status}`) ? t(`status.${item.status}`) : item.status}
                </span>

                <div className="flex justify-end relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <svg className="size-5 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                    </svg>
                  </button>

                  {openMenuId === item.id && (
                    <div
                      className="absolute right-0 bottom-8 z-40 bg-white dark:bg-neutral-800 border-2 border-black dark:border-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] p-1.5 flex gap-1"
                      style={{ borderRadius: 6 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setDetailItem(item); setOpenMenuId(null); }}
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex items-center justify-center size-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <svg className="size-4 text-black dark:text-white" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(item); setOpenMenuId(null); }}
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

      {/* Modal create/edit */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}
        >
          <div ref={modalRef} className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-black dark:text-white">
                  {isEditing ? t("editTitle") : t("createTitle", { type: t(`tabs.${TAB_KEYS[tab]}`) })}
                </h2>
              </div>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <svg className="size-4 text-neutral-500" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="px-5 py-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">{t("form.name")}</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input w-full h-9"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">{t("form.description")}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="input w-full resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">{t("form.price")}</label>
                    <input
                      type="number"
                      min="0"
                      value={form.basePrice}
                      onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                      placeholder="0"
                      className="input w-full h-9"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">{t("form.currency")}</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="input w-full h-9"
                    >
                      <option value="XOF">XOF (FCFA)</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-text-secondary dark:text-neutral-400">{t("form.category")}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input w-full h-9"
                  >
                    <option value="">{tc("all")}</option>
                    {CATEGORY_LIST.map((c) => (
                      <option key={c} value={c}>{t.has(`categories.${c}`) ? t(`categories.${c}`) : c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="tertiary-icon px-3 py-2 active-scale"
                >
                  <p className="text-sm font-medium">{tc("cancel")}</p>
                </button>
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
                      {creating ? tc("saving") : tc("save")}
                    </p>
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detail */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailItem(null); }}
        >
          <div className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border dark:border-neutral-800">
              <h2 className="text-base font-bold text-black dark:text-white">{t("columns.description")}</h2>
              <button
                onClick={() => setDetailItem(null)}
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
                    <path d="M5 6h6M5 8.5h4M5 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-black dark:text-white">{detailItem.name}</p>
                  <p className="text-xs text-text-secondary dark:text-neutral-500">
                    {t(`tabs.${TAB_KEYS[detailItem.type]}`)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">{t("columns.price")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatPrice(detailItem.basePrice, detailItem.currency)}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">{t("columns.status")}</p>
                  <span className="inline-flex items-center w-fit px-2 py-0.5 text-[11px] font-medium bg-black text-white dark:bg-white dark:text-black" style={{ borderRadius: 4 }}>
                    {t.has(`status.${detailItem.status}`) ? t(`status.${detailItem.status}`) : detailItem.status}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">{t("columns.category")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{detailItem.categoryId || ""}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">{tc("date")}</p>
                  <p className="text-sm font-bold text-black dark:text-white">{formatDate(detailItem.createdAt)}</p>
                </div>
              </div>

              {detailItem.description && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] text-text-secondary dark:text-neutral-500">{t("columns.description")}</p>
                  <p className="text-sm text-black dark:text-white">{detailItem.description}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button
                onClick={() => { openEditModal(detailItem); setDetailItem(null); }}
                className="secondary-icon px-3 py-2 active-scale"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium">{tc("edit")}</p>
                </span>
              </button>
              <button
                onClick={() => setDetailItem(null)}
                className="tertiary-icon px-3 py-2 active-scale"
              >
                <p className="text-sm font-medium">{tc("close")}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal delete */}
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
                <p className="text-sm font-bold text-black dark:text-white">{t("messages.deleteConfirm")} ?</p>
                <p className="text-xs text-text-secondary dark:text-neutral-500 mt-1">
                  <span className="font-semibold text-black dark:text-white">{deleteTarget.name}</span> · {t("messages.deleteWarning")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
              <button
                onClick={() => setDeleteTarget(null)}
                className="tertiary-icon px-4 py-2 active-scale"
              >
                <p className="text-sm font-medium">{tc("cancel")}</p>
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium active-scale disabled:opacity-60 transition-colors cursor-pointer"
                style={{ borderRadius: 7 }}
              >
                {deleting ? tc("deleting") : tc("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
