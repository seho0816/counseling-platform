package com.counseling.backend.audit;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/logs")
public class AdminAccessLogController {
    private final AdminAccessLogService service;

    public AdminAccessLogController(AdminAccessLogService service) {
        this.service = service;
    }

    @GetMapping
    public AccessLogPageResponse list(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      Authentication authentication) {
        return service.list(page, size, authentication);
    }
}
