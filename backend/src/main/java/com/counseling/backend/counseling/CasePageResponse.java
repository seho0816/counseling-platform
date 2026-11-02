package com.counseling.backend.counseling;

import java.util.List;

/** Stable JSON envelope without exposing Spring Data Page internals. */
public record CasePageResponse(
    List<CaseResponse> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
