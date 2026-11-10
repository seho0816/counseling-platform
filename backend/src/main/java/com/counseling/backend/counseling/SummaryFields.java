package com.counseling.backend.counseling;

/** Structured counseling-note summary. Missing information must remain null. */
public record SummaryFields(String complaint, String intervention, String nextPlan) {
    private static final int MAX_FIELD_LENGTH = 5_000;

    public SummaryFields validated() {
        String complaintValue = normalize(complaint);
        String interventionValue = normalize(intervention);
        String planValue = normalize(nextPlan);
        if (complaintValue == null && interventionValue == null && planValue == null) {
            throw new IllegalArgumentException("At least one summary field is required");
        }
        return new SummaryFields(complaintValue, interventionValue, planValue);
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.strip();
        if (trimmed.length() > MAX_FIELD_LENGTH) {
            throw new IllegalArgumentException("Summary field is too long (max 5000 characters)");
        }
        return trimmed;
    }
}
