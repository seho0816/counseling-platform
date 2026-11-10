package com.counseling.backend.client;

import java.time.OffsetDateTime;

// Admin-only: contains contact. Do not reuse as a public case DTO.
public record ClientResponse(Long id, String name, String contact, String ageGroup, OffsetDateTime createdAt) {
    public static ClientResponse from(Client client) {
        return new ClientResponse(client.getId(), client.getName(), client.getContact(),
            client.getAgeGroup(), client.getCreatedAt());
    }
}
