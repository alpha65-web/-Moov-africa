"use client";

import { useCallback, useEffect, useState } from "react";
import api from "./api";
import { useAuth } from "./auth";

/**
 * Signal interne entre l'ecran Notifications et les pastilles de la barre
 * laterale et de la barre superieure.
 *
 * Les pastilles interrogent /notifications/unread/count toutes les trente
 * secondes. Sans ce signal, marquer une notification comme lue laissait le
 * compteur en retard jusqu'au cycle suivant : l'utilisateur voyait une pastille
 * annoncant des notifications qu'il venait de traiter.
 */
export const NOTIFICATIONS_UPDATED_EVENT = "pim:notifications-updated";

export function notifyNotificationsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

/**
 * Nombre de notifications non lues du compte connecte, et etat de la liaison
 * avec le serveur.
 *
 * `online` n'est pas une supposition : il vaut true quand le dernier appel au
 * serveur a repondu, false quand il a echoue, null tant qu'aucun appel n'a
 * abouti. C'est ce qui permet a la barre superieure d'afficher un etat
 * « serveur en ligne » qui dit la verite.
 */
export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/notifications/unread/count");
      setCount(typeof data === "number" ? data : data.count ?? 0);
      setOnline(true);
    } catch {
      // Compteur indisponible : on n'affiche rien plutot qu'un chiffre faux,
      // et l'indicateur de liaison passe au rouge.
      setCount(0);
      setOnline(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    // Relecture reguliere : une notification peut naitre d'une action d'un autre
    // acteur, sans que cet onglet ait navigue.
    const timer = setInterval(refresh, 30000);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    };
  }, [refresh]);

  return { count, online, refresh };
}
