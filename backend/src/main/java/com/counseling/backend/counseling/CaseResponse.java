package com.counseling.backend.counseling;

import java.time.OffsetDateTime;

/** Deliberately excludes client contact data and session contents. */
public record CaseResponse(
    Long id,
    Long clientId,
    Long counselorId,
    String title,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static CaseResponse from(CounselingCase counselingCase) {
        return new CaseResponse(
            counselingCase.getId(),
            counselingCase.getClient().getId(),
            counselingCase.getCounselor() == null ? null : counselingCase.getCounselor().getId(),
            counselingCase.getTitle(),
            counselingCase.getStatus().name(),
            counselingCase.getCreatedAt(),
            counselingCase.getUpdatedAt()
        );
    }
}
