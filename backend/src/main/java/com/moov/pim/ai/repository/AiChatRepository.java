package com.moov.pim.ai.repository;

import com.moov.pim.ai.domain.AiChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiChatRepository extends JpaRepository<AiChatMessage, UUID> {
    List<AiChatMessage> findByUserIdOrderByCreatedAtAsc(UUID userId);
    List<AiChatMessage> findTop50ByUserIdOrderByCreatedAtDesc(UUID userId);
    void deleteByUserId(UUID userId);
}
