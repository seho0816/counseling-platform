package com.counseling.backend.admin;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/counselors")
public class AdminCounselorController {
    private final AdminCounselorService service;

    public AdminCounselorController(AdminCounselorService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CounselorResponse create(@RequestBody CreateCounselorRequest request, Authentication authentication) {
        return service.create(request, authentication);
    }

    @GetMapping
    public List<CounselorResponse> list(Authentication authentication) {
        return service.list(authentication);
    }
}
