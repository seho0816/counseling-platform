package com.counseling.backend.counseling;

// concern is optional while existing cases are migrated.
public record CreateCaseRequest(Long clientId, Long counselorId, String title, String concern) {
    public CreateCaseRequest(Long clientId, Long counselorId, String title) {
        this(clientId, counselorId, title, null);
    }
}
