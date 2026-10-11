-- Demandes de reinitialisation de mot de passe.
--
-- Jusqu'ici, un utilisateur qui oubliait son mot de passe n'avait aucun moyen de
-- le signaler : l'ecran de connexion ne proposait rien, et l'administrateur ne
-- voyait aucune demande. Il fallait le joindre par telephone ou se deplacer.
--
-- Le circuit du lien envoye par courriel n'est pas retenu : le backend n'embarque
-- aucun expediteur de courrier, et une dependance SMTP tomberait le jour d'une
-- demonstration. La demande est donc un objet de la plateforme : elle est
-- enregistree ici, l'administrateur la voit dans une file sur l'ecran
-- Utilisateurs, et il la traite avec la reinitialisation qui existe deja
-- (PUT /users/{id} avec un mot de passe, qui force le changement a la
-- reconnexion et invalide les sessions en cours).

CREATE TABLE password_reset_requests (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_at  TIMESTAMP NOT NULL DEFAULT now(),
    handled_at    TIMESTAMP,
    handled_by    UUID REFERENCES users (id) ON DELETE SET NULL,
    requester_ip  VARCHAR(45),
    CONSTRAINT password_reset_requests_status_check
        CHECK (status IN ('PENDING', 'HANDLED', 'CANCELLED'))
);

COMMENT ON TABLE password_reset_requests IS
    'Demandes de reinitialisation de mot de passe adressees a l''administrateur.';
COMMENT ON COLUMN password_reset_requests.requester_ip IS
    'Adresse a l''origine de la demande, pour que l''administrateur puisse ecarter une demande suspecte.';

-- Une personne ne peut avoir qu'une seule demande en attente : recliquer sur
-- « mot de passe oublie » ne doit pas empiler des lignes identiques dans la file.
CREATE UNIQUE INDEX idx_password_reset_requests_one_pending
    ON password_reset_requests (user_id)
    WHERE status = 'PENDING';

CREATE INDEX idx_password_reset_requests_status
    ON password_reset_requests (status, requested_at DESC);
