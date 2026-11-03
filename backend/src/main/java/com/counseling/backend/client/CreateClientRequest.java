package com.counseling.backend.client;

// ageGroup is optional while existing clients are migrated.
public record CreateClientRequest(String name, String contact, String ageGroup) {
    public CreateClientRequest(String name, String contact) {
        this(name, contact, null);
    }
}
