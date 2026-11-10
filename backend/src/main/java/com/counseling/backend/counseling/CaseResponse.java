package com.counseling.backend.counseling;

import java.time.OffsetDateTime;

/** Does not expose client contact data or individual counseling session content. */
public record CaseResponse(
    Long id,
    Long clientId,
    String clientAlias,
    String ageGroup,
    Long counselorId,
    String title,
    String concern,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static CaseResponse from(CounselingCase counselingCase) {
        return new CaseResponse(
            counselingCase.getId(),
            counselingCase.getClient().getId(),
            counselingCase.getClient().getName(),
            counselingCase.getClient().getAgeGroup(),
            counselingCase.getCounselor() == null ? null : counselingCase.getCounselor().getId(),
            counselingCase.getTitle(),
            counselingCase.getConcern(),
            counselingCase.getStatus().name(),
            counselingCase.getCreatedAt(),
            counselingCase.getUpdatedAt()
        );
    }
}
