package com.counseling.backend.counseling;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Session content is sensitive; send only after case-level authorization. */
public record SessionResponse(
    Long id,
    Long caseId,
    Integer sessionNumber,
    LocalDate sessionDate,
    String content,
    Long authorUserId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static SessionResponse from(CounselingSession session) {
        return new SessionResponse(
            session.getId(),
            session.getCounselingCase().getId(),
            session.getSessionNumber(),
            session.getSessionDate(),
            session.getContent(),
            session.getAuthor().getId(),
            session.getCreatedAt(),
            session.getUpdatedAt()
        );
    }
}
