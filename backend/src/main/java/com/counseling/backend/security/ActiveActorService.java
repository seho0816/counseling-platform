package com.counseling.backend.security;

import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import java.util.Arrays;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ActiveActorService {
    private final UserRepository users;

    public ActiveActorService(UserRepository users) {
        this.users = users;
    }

    public User require(Authentication authentication, UserRole requiredRole) {
        return requireAny(authentication, requiredRole);
    }

    /** Rechecks active status and DB role on every request, including role changes. */
    public User requireAny(Authentication authentication, UserRole... permittedRoles) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        User actor = users.findByEmail(authentication.getName())
            .filter(User::isActive)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Active account required"));
        String authority = "ROLE_" + actor.getRole().name();
        boolean matchesSession = authentication.getAuthorities().stream()
            .anyMatch(a -> authority.equals(a.getAuthority()));
        if (!matchesSession) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session role is outdated; sign in again");
        }
        if (permittedRoles == null || Arrays.stream(permittedRoles)
                .noneMatch(role -> role == actor.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient permissions");
        }
        return actor;
    }
}
