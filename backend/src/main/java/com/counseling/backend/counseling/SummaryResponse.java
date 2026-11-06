package com.counseling.backend.counseling;

import java.time.OffsetDateTime;
import tools.jackson.databind.json.JsonMapper;

public record SummaryResponse(
    Long id,
    Long sessionId,
    SummaryFields aiDraft,
    SummaryFields finalSummary,
    SummaryStatus status,
    String modelName,
    Long confirmedBy,
    OffsetDateTime confirmedAt
) {
    public static SummaryResponse from(CounselingSummary summary, JsonMapper mapper) {
        return new SummaryResponse(
            summary.getId(),
            summary.getSession().getId(),
            mapper.readValue(summary.getAiDraft(), SummaryFields.class),
            summary.getFinalSummary() == null ? null
                : mapper.readValue(summary.getFinalSummary(), SummaryFields.class),
            summary.getStatus(),
            summary.getModelName(),
            summary.getConfirmedBy() == null ? null : summary.getConfirmedBy().getId(),
            summary.getConfirmedAt()
        );
    }
}
