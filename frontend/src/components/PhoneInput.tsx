"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { COUNTRIES } from "@/lib/countries";
import type { Country } from "@/lib/countries";

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
}

export default function PhoneInput({ value, onChange }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Country>(COUNTRIES[0]);
  const [localNumber, setLocalNumber] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const match = COUNTRIES.find((c) => value.startsWith(c.dial));
      if (match) {
        setSelected(match);
        setLocalNumber(value.slice(match.dial.length).replace(/\s/g, ""));
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
        setFocusedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setFocusedIndex(-1);
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-country]");
      items[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.includes(search.toLowerCase())
      )
    : COUNTRIES;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        handleSelectCountry(filtered[focusedIndex]);
      } else if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
        setFocusedIndex(-1);
      }
    },
    [open, filtered, focusedIndex]
  );

  function handleNumberChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, selected.digits);
    setLocalNumber(digits);
    onChange(digits ? `${selected.dial}${digits}` : "");
  }

  function handleSelectCountry(country: Country) {
    setSelected(country);
    setOpen(false);
    setSearch("");
    setFocusedIndex(-1);
    const digits = localNumber.slice(0, country.digits);
    setLocalNumber(digits);
    onChange(digits ? `${country.dial}${digits}` : "");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  const isComplete = localNumber.length === selected.digits;
  const hasInput = localNumber.length > 0;

  return (
    <div className="relative" ref={containerRef} onKeyDown={handleKeyDown}>
      <div className="flex items-center h-9 bg-white dark:bg-neutral-900 border border-black/10 dark:border-neutral-700 overflow-hidden focus-within:border-orange-500 transition-all duration-100" style={{ borderRadius: 7 }}>
        {/* Sélecteur pays */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 h-full px-2.5 border-r border-black/10 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
        >
          <Image
            src={`/flags/svg/${selected.code}.svg`}
            alt={selected.name}
            width={18}
            height={13}
            className="rounded-[2px] object-cover"
          />
          <span className="text-xs font-medium text-secondary dark:text-neutral-300">
            {selected.dial}
          </span>
          <svg className={`size-3 text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Numéro */}
        <input
          ref={inputRef}
          type="tel"
          value={localNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={`${selected.digits} chiffres`}
          className="flex-1 h-full bg-transparent text-sm text-black dark:text-white outline-none px-2.5 min-w-0"
        />

        {/* Compteur */}
        {hasInput && (
          <span className={`pr-2.5 text-[10px] font-semibold shrink-0 ${isComplete ? "text-emerald-500" : "text-amber-500"}`}>
            {localNumber.length}/{selected.digits}
          </span>
        )}
      </div>

      {/* Dropdown au-dessus */}
      {open && (
        <div className="absolute left-0 right-0 bottom-[calc(100%+4px)] z-50 bg-white dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden flex flex-col">
          {/* Recherche en haut */}
          <div className="p-2 border-b border-border dark:border-neutral-700">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setFocusedIndex(-1); }}
                placeholder="Rechercher un pays..."
                className="input w-full h-8 text-xs pl-8"
              />
            </div>
          </div>

          {/* Liste */}
          <div ref={listRef} className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-neutral-400 text-center">Aucun pays trouvé</p>
            ) : (
              filtered.map((c, i) => {
                const isActive = selected.code === c.code && selected.dial === c.dial;
                const isFocused = i === focusedIndex;
                return (
                  <button
                    key={`${c.code}-${c.dial}`}
                    type="button"
                    data-country
                    onClick={() => handleSelectCountry(c)}
                    onMouseEnter={() => setFocusedIndex(i)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
                      isFocused
                        ? "bg-neutral-100 dark:bg-neutral-700"
                        : isActive
                          ? "bg-primary/5 dark:bg-primary/10"
                          : ""
                    }`}
                  >
                    <Image
                      src={`/flags/svg/${c.code}.svg`}
                      alt={c.name}
                      width={20}
                      height={15}
                      className="rounded-[2px] object-cover shrink-0"
                    />
                    <span className="text-sm text-secondary dark:text-neutral-200 flex-1 truncate">
                      {c.name}
                    </span>
                    <span className="text-xs text-text-secondary dark:text-neutral-400 tabular-nums shrink-0">
                      {c.dial}
                    </span>
                    {isActive && (
                      <svg className="size-4 text-primary shrink-0" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 8l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}
