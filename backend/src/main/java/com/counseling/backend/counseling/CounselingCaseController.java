package com.counseling.backend.counseling;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cases")
public class CounselingCaseController {

    private final CounselingCaseQueryService service;

    public CounselingCaseController(CounselingCaseQueryService service) {
        this.service = service;
    }

    @GetMapping("/{id}")
    public CaseResponse getById(@PathVariable Long id, Authentication authentication) {
        return service.getById(id, authentication);
    }

    @GetMapping
    public CasePageResponse list(Authentication authentication,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "20") int size) {
        return service.list(authentication, page, size);
    }
}
