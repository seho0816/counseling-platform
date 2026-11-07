package com.counseling.backend.intake;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubmitIntakeRequest(
    @NotBlank @Size(max = 100) String applicantName,
    @Size(max = 50) String applicantContact,
    @NotBlank @Size(max = 50) String concernCategory,
    @NotBlank @Size(max = 2000) String concernDescription,
    Boolean hasPriorCounseling,
    @NotNull @AssertTrue Boolean privacyConsent
) {}
