package com.moov.pim.lifecycle.service;

import com.moov.pim.lifecycle.domain.Offer;
import com.moov.pim.lifecycle.domain.OfferStatus;
import com.moov.pim.lifecycle.repository.OfferRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class OfferSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(OfferSchedulerService.class);

    private final OfferRepository offerRepository;

    public OfferSchedulerService(OfferRepository offerRepository) {
        this.offerRepository = offerRepository;
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void publishPlannedOffers() {
        LocalDateTime now = LocalDateTime.now();
        List<Offer> planned = offerRepository.findPlannedReadyToPublish(now);

        for (Offer offer : planned) {
            offer.setStatus(OfferStatus.PUBLISHED);
            offer.setPublishDate(now);
            offerRepository.save(offer);
            log.info("Publication automatique de l'offre {} ({})", offer.getName(), offer.getId());
        }
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void expireOffers() {
        LocalDateTime now = LocalDateTime.now();
        List<Offer> expired = offerRepository.findExpiredOffers(now);

        for (Offer offer : expired) {
            offer.setStatus(OfferStatus.OBSOLETE);
            offerRepository.save(offer);
            log.info("Expiration automatique de l'offre {} ({})", offer.getName(), offer.getId());
        }
    }

    @Scheduled(fixedRate = 3600000)
    @Transactional(readOnly = true)
    public void alertExpiringOffers() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime threshold = now.plusDays(7);
        List<Offer> expiring = offerRepository.findExpiringOffers(now, threshold);

        for (Offer offer : expiring) {
            log.warn("Offre {} ({}) expire le {}", offer.getName(), offer.getId(), offer.getValidUntil());
        }
    }
}
