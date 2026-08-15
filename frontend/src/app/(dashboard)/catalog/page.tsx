"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { CatalogItem } from "@/lib/types";
import toast from "react-hot-toast";
import { Plus, Package, Wifi, Layers } from "lucide-react";

type TabType = "products" | "services" | "packs";

const TYPE_ICONS = {
  PRODUCT: Package,
  SERVICE: Wifi,
  PACK: Layers,
};

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("products");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    basePrice: "",
    characteristics: "",
  });

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const { data } = await api.get("/catalog");
      setItems(data);
    } catch {
      // API pas disponible
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter((i) => {
    if (tab === "products") return i.type === "PRODUCT";
    if (tab === "services") return i.type === "SERVICE";
    return i.type === "PACK";
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const endpoint =
        tab === "products"
          ? "/catalog/products"
          : tab === "services"
          ? "/catalog/services"
          : "/catalog/packs";

      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        basePrice: parseFloat(form.basePrice) || 0,
        characteristics: form.characteristics || "{}",
        packOnly: false,
      };

      if (tab === "services") {
        payload.serviceType = "DATA";
        payload.billingCycle = "MONTHLY";
      }
      if (tab === "packs") {
        payload.bundlePrice = parseFloat(form.basePrice) || 0;
        payload.bundleDiscount = 0;
        payload.items = [];
      }

      await api.post(endpoint, payload);
      toast.success("Element cree avec succes");
      setShowForm(false);
      setForm({ name: "", description: "", basePrice: "", characteristics: "" });
      loadItems();
    } catch {
      toast.error("Erreur lors de la creation");
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: "products", label: "Produits" },
    { key: "services", label: "Services" },
    { key: "packs", label: "Packs" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Catalogue
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerez vos produits, services et packs
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Nouveau {tab === "products" ? "produit" : tab === "services" ? "service" : "pack"}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nom
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prix de base (XOF)
              </label>
              <input
                type="number"
                value={form.basePrice}
                onChange={(e) =>
                  setForm({ ...form, basePrice: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Creer
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Aucun element dans cette categorie
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((item) => {
              const Icon = TYPE_ICONS[item.type] || Package;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                      <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.description || "Pas de description"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.basePrice?.toLocaleString("fr-FR")} {item.currency}
                    </p>
                    <p className="text-xs text-gray-500">{item.status}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
