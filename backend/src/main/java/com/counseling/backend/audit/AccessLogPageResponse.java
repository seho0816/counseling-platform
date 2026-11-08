package com.counseling.backend.audit;

import java.util.List;

public record AccessLogPageResponse(
        List<AccessLogResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
