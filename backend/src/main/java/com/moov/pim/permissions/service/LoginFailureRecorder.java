package com.moov.pim.permissions.service;

import com.moov.pim.shared.event.LoginFailedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Enregistre une tentative de connexion echouee, dans une transaction distincte.
 *
 * {@code AuthService.login} est {@code @Transactional} et laisse remonter
 * l'exception en cas d'echec : la transaction est donc annulee, et avec elle tout
 * ce qui y avait ete ecrit. Les evenements {@code LoginFailedEvent} etaient publies
 * a l'interieur de cette transaction et leur ecouteur ne se declenche qu'apres
 * validation — il ne s'executait donc jamais. Verifie en base : trois mots de passe
 * errones de suite ne laissaient aucune trace, alors que l'ecran Historique propose
 * un filtre sur les echecs de connexion.
 *
 * Publier depuis une transaction {@code REQUIRES_NEW} qui, elle, aboutit, remet
 * l'ecouteur en marche sans modifier le comportement de l'authentification.
 *
 * <p>Ce composant ne compte pas les echecs et ne verrouille aucun compte : le
 * verrouillage apres cinq tentatives reste inactif, par decision, parce qu'un
 * administrateur ne peut pas rouvrir son propre compte et que la plateforme n'en
 * compte qu'un. L'activer suppose d'abord un second administrateur.
 */
@Component
public class LoginFailureRecorder {

    private final ApplicationEventPublisher eventPublisher;

    public LoginFailureRecorder(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID userId, String email, String reason, String ipAddress, String userAgent) {
        eventPublisher.publishEvent(new LoginFailedEvent(userId, email, reason, ipAddress, userAgent));
    }
}
