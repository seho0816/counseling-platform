package com.counseling.backend.counseling;

/** Example JSON: {"status":"IN_PROGRESS"}. */
public record UpdateCaseStatusRequest(CaseStatus status) {}
