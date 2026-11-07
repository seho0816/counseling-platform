package com.counseling.backend.intake;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicIntakeController {
    private final IntakeSubmissionService service;

    public PublicIntakeController(IntakeSubmissionService service) {
        this.service = service;
    }

    @PostMapping("/api/intakes")
    @ResponseStatus(HttpStatus.CREATED)
    public IntakeAcceptedResponse submit(@Valid @RequestBody SubmitIntakeRequest request) {
        return service.submit(request);
    }
}
