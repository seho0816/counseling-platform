package com.counseling.backend.intake;
import java.util.List;
public record IntakePageResponse(
    List<IntakeResponse> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
