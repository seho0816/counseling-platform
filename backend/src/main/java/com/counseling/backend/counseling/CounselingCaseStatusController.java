package com.counseling.backend.counseling;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CounselingCaseStatusController {
    private final CounselingCaseStatusService service;

    public CounselingCaseStatusController(CounselingCaseStatusService service) {
        this.service = service;
    }

    @PatchMapping("/api/cases/{caseId}/status")
    public CaseResponse changeStatus(@PathVariable Long caseId,
                                     @RequestBody UpdateCaseStatusRequest request,
                                     Authentication authentication) {
        return service.changeStatus(caseId, request, authentication);
    }
}
