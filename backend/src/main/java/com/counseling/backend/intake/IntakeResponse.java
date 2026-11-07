package com.counseling.backend.intake;
import java.time.OffsetDateTime;

/** Admin only: contains sensitive counseling application content. */
public record IntakeResponse(
    Long id,
    String applicantName,
    String applicantContact,
    String concernCategory,
    String concernDescription,
    Boolean hasPriorCounseling,
    IntakeStatus status,
    OffsetDateTime privacyConsentAt,
    OffsetDateTime createdAt
) {
    public static IntakeResponse from(IntakeForm form) {
        return new IntakeResponse(form.getId(), form.getApplicantName(),
            form.getApplicantContact(), form.getConcernCategory(),
            form.getConcernDescription(), form.getHasPriorCounseling(),
            form.getStatus(), form.getPrivacyConsentAt(), form.getCreatedAt());
    }
}
