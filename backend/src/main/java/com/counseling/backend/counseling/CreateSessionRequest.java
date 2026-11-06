package com.counseling.backend.counseling;

import java.time.LocalDate;

public record CreateSessionRequest(
    Integer sessionNumber,
    LocalDate sessionDate,
    String content
) {}
