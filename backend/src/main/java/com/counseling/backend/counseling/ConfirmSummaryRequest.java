package com.counseling.backend.counseling;

/** Counselor-reviewed structured summary submitted for final confirmation. */
public record ConfirmSummaryRequest(SummaryFields finalSummary) {
}
