package com.counseling.backend.counseling;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cases/{caseId}/sessions")
public class CounselingSessionController {
    private final CounselingSessionService service;

    public CounselingSessionController(CounselingSessionService service) {
        this.service = service;
    }

    @GetMapping
    public List<SessionResponse> list(@PathVariable Long caseId, Authentication authentication) {
        return service.list(caseId, authentication);
    }

    @GetMapping("/{sessionId}")
    public SessionResponse get(@PathVariable Long caseId, @PathVariable Long sessionId,
                               Authentication authentication) {
        return service.get(caseId, sessionId, authentication);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionResponse create(@PathVariable Long caseId,
                                  @RequestBody CreateSessionRequest request,
                                  Authentication authentication) {
        return service.create(caseId, request, authentication);
    }

    @PatchMapping("/{sessionId}")
    public SessionResponse update(@PathVariable Long caseId, @PathVariable Long sessionId,
                                  @RequestBody UpdateSessionRequest request,
                                  Authentication authentication) {
        return service.update(caseId, sessionId, request, authentication);
    }
}
