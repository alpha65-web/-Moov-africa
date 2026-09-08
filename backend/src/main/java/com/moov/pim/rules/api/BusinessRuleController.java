package com.moov.pim.rules.api;

import com.moov.pim.rules.api.dto.BusinessRuleRequest;
import com.moov.pim.rules.api.dto.BusinessRuleResponse;
import com.moov.pim.rules.api.dto.CompositionEvaluationRequest;
import com.moov.pim.rules.api.dto.RuleConsistencyIssue;
import com.moov.pim.rules.api.dto.RuleViolation;
import com.moov.pim.rules.service.RuleConsistencyService;
import com.moov.pim.rules.service.RuleEvaluationService;
import com.moov.pim.rules.domain.RuleType;
import com.moov.pim.rules.service.BusinessRuleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/rules")
public class BusinessRuleController {

    private final BusinessRuleService ruleService;
    private final RuleEvaluationService evaluationService;
    private final RuleConsistencyService consistencyService;

    public BusinessRuleController(BusinessRuleService ruleService,
                                  RuleEvaluationService evaluationService,
                                  RuleConsistencyService consistencyService) {
        this.ruleService = ruleService;
        this.evaluationService = evaluationService;
        this.consistencyService = consistencyService;
    }

    /**
     * Coherence globale des regles : contradictions, doublons, briques archivees,
     * auto-references et boucles de composition obligatoire (cahier des charges 7.3).
     */
    @GetMapping("/consistency")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<List<RuleConsistencyIssue>> consistency() {
        return ResponseEntity.ok(consistencyService.check());
    }

    /**
     * Evalue une composition sans rien enregistrer.
     *
     * Le cahier des charges (7.3) demande que le systeme bloque ou avertisse
     * *avant* la soumission. Le controle existait a l'enregistrement, mais les
     * violations non bloquantes n'etaient renvoyees nulle part : le chef de
     * produit n'apprenait un avertissement qu'en lisant la base. Cet appel
     * renvoie toutes les violations, bloquantes et non bloquantes, pour la
     * composition en cours de saisie.
     *
     * Ouvert a ceux qui assemblent des offres et a ceux qui administrent les
     * regles : c'est aussi ainsi que l'administrateur consulte les regles
     * appliquees a une offre donnee.
     */
    @PostMapping("/evaluate")
    @PreAuthorize("hasAnyAuthority('OFFER_CREATE', 'RULE_MANAGE', 'OFFER_VALIDATE', 'OFFER_PUBLISH')")
    public ResponseEntity<List<RuleViolation>> evaluate(@Valid @RequestBody CompositionEvaluationRequest request) {
        return ResponseEntity.ok(evaluationService.evaluate(request.catalogItemIds()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<BusinessRuleResponse> create(@Valid @RequestBody BusinessRuleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ruleService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<BusinessRuleResponse> update(@PathVariable UUID id,
                                                       @Valid @RequestBody BusinessRuleRequest request) {
        return ResponseEntity.ok(ruleService.update(id, request));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<List<BusinessRuleResponse>> listAll() {
        return ResponseEntity.ok(ruleService.listAll());
    }

    @GetMapping("/type/{type}")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<List<BusinessRuleResponse>> listByType(@PathVariable RuleType type) {
        return ResponseEntity.ok(ruleService.listByType(type));
    }

    @GetMapping("/item/{itemId}")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<List<BusinessRuleResponse>> listByItem(@PathVariable UUID itemId) {
        return ResponseEntity.ok(ruleService.listByItem(itemId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<BusinessRuleResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ruleService.getById(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<Void> activate(@PathVariable UUID id) {
        ruleService.activate(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        ruleService.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('RULE_MANAGE')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        ruleService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
