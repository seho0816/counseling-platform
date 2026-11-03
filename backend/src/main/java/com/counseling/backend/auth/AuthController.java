package com.counseling.backend.auth;

import com.counseling.backend.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

// The login/logout POST endpoints are handled by Spring Security, not this controller.
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;

    public AuthController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        // getToken() forces the deferred CSRF token to be saved in the session.
        return new CsrfResponse(csrfToken.getHeaderName(), csrfToken.getToken());
    }

    @GetMapping("/me")
    public MeResponse me(Authentication authentication) {
        var user = users.findByEmail(authentication.getName())
            .filter(u -> u.isActive())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return new MeResponse(user.getId(), user.getEmail(), user.getName(), user.getRole().name());
    }

    public record CsrfResponse(String headerName, String token) {}
    public record MeResponse(Long id, String email, String name, String role) {}
}
