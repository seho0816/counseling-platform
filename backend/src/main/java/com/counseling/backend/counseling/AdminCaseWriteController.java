package com.counseling.backend.counseling;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminCaseWriteController {
    private final AdminCaseWriteService service;

    public AdminCaseWriteController(AdminCaseWriteService service) {
        this.service = service;
    }

    // Admin-only as enforced by both method-level security and ActiveActorService.
    @PostMapping("/api/admin/cases")
    @ResponseStatus(HttpStatus.CREATED)
    public CaseResponse create(@RequestBody CreateCaseRequest request, Authentication authentication) {
        return service.create(request, authentication);
    }

    @PatchMapping("/api/admin/cases/{id}/assignment")
    public CaseResponse assign(@PathVariable Long id, @RequestBody AssignCaseRequest request,
                               Authentication authentication) {
        return service.assign(id, request, authentication);
    }
}
