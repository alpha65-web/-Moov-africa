package com.moov.pim.dam.service;

import com.moov.pim.dam.api.dto.AbTestResponse;
import com.moov.pim.dam.api.dto.CreateAbTestRequest;
import com.moov.pim.dam.domain.AbTest;
import com.moov.pim.dam.domain.AbTestStatus;
import com.moov.pim.dam.repository.AbTestRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class AbTestService {

    private final AbTestRepository abTestRepository;

    public AbTestService(AbTestRepository abTestRepository) {
        this.abTestRepository = abTestRepository;
    }

    @Transactional
    public AbTestResponse create(CreateAbTestRequest request) {
        AbTest test = new AbTest();
        test.setOfferId(request.offerId());
        test.setVariantA(request.variantA());
        test.setVariantB(request.variantB());
        test.setMetric(request.metric());
        test.setCreatedById(currentUserId());
        test = abTestRepository.save(test);
        return AbTestResponse.from(test);
    }

    @Transactional(readOnly = true)
    public List<AbTestResponse> listByOffer(UUID offerId) {
        return abTestRepository.findByOfferId(offerId).stream()
                .map(AbTestResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public AbTestResponse getById(UUID id) {
        return AbTestResponse.from(findTest(id));
    }

    @Transactional
    public AbTestResponse start(UUID id) {
        AbTest test = findTest(id);
        if (test.getStatus() != AbTestStatus.DRAFT) {
            throw new IllegalStateException("Seul un test en DRAFT peut être démarré");
        }
        test.setStatus(AbTestStatus.RUNNING);
        return AbTestResponse.from(abTestRepository.save(test));
    }

    @Transactional
    public AbTestResponse complete(UUID id, String winner) {
        AbTest test = findTest(id);
        if (test.getStatus() != AbTestStatus.RUNNING) {
            throw new IllegalStateException("Seul un test en RUNNING peut être complété");
        }
        if (!winner.equals(test.getVariantA()) && !winner.equals(test.getVariantB())) {
            throw new IllegalArgumentException("Le gagnant doit être l'un des deux variants");
        }
        test.setStatus(AbTestStatus.COMPLETED);
        test.setWinner(winner);
        return AbTestResponse.from(abTestRepository.save(test));
    }

    @Transactional
    public AbTestResponse cancel(UUID id) {
        AbTest test = findTest(id);
        if (test.getStatus() == AbTestStatus.COMPLETED) {
            throw new IllegalStateException("Un test complété ne peut pas être annulé");
        }
        test.setStatus(AbTestStatus.CANCELLED);
        return AbTestResponse.from(abTestRepository.save(test));
    }

    private AbTest findTest(UUID id) {
        return abTestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Test A/B introuvable"));
    }

    private UUID currentUserId() {
        CustomUserDetails principal = (CustomUserDetails) SecurityContextHolder
                .getContext().getAuthentication().getPrincipal();
        return principal.getUserId();
    }
}
