package com.counseling.backend.counseling;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions/{sessionId}/summary")
public class CounselingSummaryController {
    private final CounselingSummaryService service;

    public CounselingSummaryController(CounselingSummaryService service) {
        this.service = service;
    }

    @GetMapping
    public SummaryResponse get(@PathVariable Long sessionId, Authentication authentication) {
        return service.get(sessionId, authentication);
    }

    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public SummaryResponse generate(@PathVariable Long sessionId, Authentication authentication) {
        return service.generate(sessionId, authentication);
    }

    @PutMapping("/confirm")
    public SummaryResponse confirm(@PathVariable Long sessionId,
                                   @RequestBody ConfirmSummaryRequest request,
                                   Authentication authentication) {
        return service.confirm(sessionId, request, authentication);
    }
}
