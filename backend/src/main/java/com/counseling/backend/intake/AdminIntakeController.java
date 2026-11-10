package com.counseling.backend.intake;

import com.counseling.backend.counseling.CaseResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/intakes")
public class AdminIntakeController {
    private final AdminIntakeService service;

    public AdminIntakeController(AdminIntakeService service) {
        this.service = service;
    }

    @GetMapping
    public IntakePageResponse list(@RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size,
                                   @RequestParam(required = false) IntakeStatus status,
                                   Authentication authentication) {
        return service.list(page, size, status, authentication);
    }

    @GetMapping("/{id}")
    public IntakeResponse detail(@PathVariable Long id, Authentication authentication) {
        return service.detail(id, authentication);
    }

    @PostMapping("/{id}/convert")
    @ResponseStatus(HttpStatus.CREATED)
    public CaseResponse convert(@PathVariable Long id, Authentication authentication) {
        return service.convert(id, authentication);
    }
}
