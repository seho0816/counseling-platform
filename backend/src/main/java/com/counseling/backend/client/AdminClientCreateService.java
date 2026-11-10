package com.counseling.backend.client;

import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Service
public class AdminClientCreateService {
    private static final Set<String> AGE_GROUPS = Set.of(
        "10대", "20대", "30대", "40대", "50대", "60대 이상"
    );

    private final ClientRepository clients;
    private final ActiveActorService activeActors;

    public AdminClientCreateService(ClientRepository clients, ActiveActorService activeActors) {
        this.clients = clients;
        this.activeActors = activeActors;
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public ClientResponse create(CreateClientRequest request, Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        if (request == null || request.name() == null || request.name().isBlank()
                || request.name().trim().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name must be 1..100 characters");
        }
        String contact = request.contact() == null ? null : request.contact().trim();
        if (contact != null && contact.length() > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contact must be at most 50 characters");
        }
        String ageGroup = request.ageGroup() == null ? null : request.ageGroup().trim();
        if (ageGroup != null && ageGroup.isBlank()) ageGroup = null;
        if (ageGroup != null && !AGE_GROUPS.contains(ageGroup)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ageGroup");
        }
        Client client = new Client(request.name().trim(),
            contact == null || contact.isBlank() ? null : contact, ageGroup);
        return ClientResponse.from(clients.saveAndFlush(client));
    }
}
