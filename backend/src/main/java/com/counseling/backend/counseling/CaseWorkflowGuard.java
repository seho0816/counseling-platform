package com.counseling.backend.counseling;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Only active cases accept new/changed counseling records and AI summaries. */
final class CaseWorkflowGuard {
    private CaseWorkflowGuard() {}

    static void requireInProgress(CounselingCase counselingCase) {
        if (counselingCase.getStatus() != CaseStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Only IN_PROGRESS cases can change sessions or AI summaries");
        }
    }
}
