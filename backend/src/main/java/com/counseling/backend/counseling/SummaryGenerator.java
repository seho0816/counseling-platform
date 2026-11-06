package com.counseling.backend.counseling;

/** AI teammate implements this interface and registers a Spring bean. */
public interface SummaryGenerator {
    GeneratedSummary generate(String counselingNote);
}
