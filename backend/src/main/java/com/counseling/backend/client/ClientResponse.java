package com.counseling.backend.client;

import java.time.OffsetDateTime;

// This DTO includes contact info and must be returned only by admin-authorized endpoints.
public record ClientResponse(Long id, String name, String contact, OffsetDateTime createdAt) {
    public static ClientResponse from(Client client) {
        return new ClientResponse(client.getId(), client.getName(), client.getContact(), client.getCreatedAt());
    }
}
