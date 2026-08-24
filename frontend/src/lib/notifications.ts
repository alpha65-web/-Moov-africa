/**
 * Signal interne entre l'ecran Notifications et la pastille de la barre laterale.
 *
 * La pastille interroge /notifications/unread/count toutes les trente secondes.
 * Sans ce signal, marquer une notification comme lue laissait le compteur en retard
 * jusqu'au cycle suivant : l'utilisateur voyait une pastille annoncant des
 * notifications qu'il venait de traiter.
 */
export const NOTIFICATIONS_UPDATED_EVENT = "pim:notifications-updated";

export function notifyNotificationsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}
