package com.counseling.backend.intake;
import java.time.OffsetDateTime;

/** Public response intentionally does not include submitted personal information. */
public record IntakeAcceptedResponse(Long id, IntakeStatus status, OffsetDateTime createdAt) {
    public static IntakeAcceptedResponse from(IntakeForm form) {
        return new IntakeAcceptedResponse(form.getId(), form.getStatus(), form.getCreatedAt());
    }
}
