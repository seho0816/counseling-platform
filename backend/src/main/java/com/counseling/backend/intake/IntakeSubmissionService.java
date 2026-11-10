package com.counseling.backend.intake;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IntakeSubmissionService {
    private final IntakeFormRepository intakes;

    public IntakeSubmissionService(IntakeFormRepository intakes) {
        this.intakes = intakes;
    }

    @Transactional
    public IntakeAcceptedResponse submit(SubmitIntakeRequest request) {
        // @Valid on the controller enforces required fields and consent.
        // Defense in depth if this service is invoked without HTTP validation.
        if (request == null || !Boolean.TRUE.equals(request.privacyConsent())
                || invalid(request.applicantName(), 100)
                || invalid(request.concernCategory(), 50)
                || invalid(request.concernDescription(), 2000)
                || (request.applicantContact() != null && request.applicantContact().trim().length() > 50)) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid application or privacy consent");
        }
        IntakeForm form = new IntakeForm(
            request.applicantName().trim(),
            emptyToNull(request.applicantContact()),
            request.concernCategory().trim(),
            request.concernDescription().trim(),
            request.hasPriorCounseling());
        form.recordPrivacyConsent();
        return IntakeAcceptedResponse.from(intakes.saveAndFlush(form));
    }

    private static boolean invalid(String value, int max) {
        return value == null || value.isBlank() || value.trim().length() > max;
    }

    private static String emptyToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
