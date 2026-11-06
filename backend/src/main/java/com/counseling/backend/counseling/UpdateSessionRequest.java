package com.counseling.backend.counseling;

import java.time.LocalDate;

/** Both fields are required; this endpoint replaces the editable note fields. */
public record UpdateSessionRequest(
    LocalDate sessionDate,
    String content
) {}
