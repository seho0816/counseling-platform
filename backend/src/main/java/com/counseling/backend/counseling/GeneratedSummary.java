package com.counseling.backend.counseling;

/** Return type required from the AI module. Never report invented model names. */
public record GeneratedSummary(SummaryFields draft, String modelName) {
}
