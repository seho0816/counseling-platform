package com.counseling.backend.admin;

import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

@Service
public class AdminCounselorService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final ActiveActorService activeActors;

    public AdminCounselorService(UserRepository users, PasswordEncoder passwordEncoder,
                                 ActiveActorService activeActors) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.activeActors = activeActors;
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CounselorResponse create(CreateCounselorRequest request, Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        if (request == null || request.email() == null || request.name() == null || request.password() == null) {
            throw badRequest("email, name and password are required");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String name = request.name().trim();
        String password = request.password();
        if (email.length() > 255 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw badRequest("Invalid email");
        }
        if (name.isBlank() || name.length() > 100) {
            throw badRequest("name must be 1..100 characters");
        }
        // BCrypt uses only the first 72 bytes; reject longer passwords instead of silently truncating.
        int bytes = password.getBytes(StandardCharsets.UTF_8).length;
        if (password.length() < 12 || bytes > 72) {
            throw badRequest("Password must be at least 12 characters and at most 72 UTF-8 bytes");
        }
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }
        User newCounselor = new User(email, passwordEncoder.encode(password), name, UserRole.COUNSELOR);
        return CounselorResponse.from(users.saveAndFlush(newCounselor));
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<CounselorResponse> list(Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        return users.findAll().stream()
            .filter(u -> u.getRole() == UserRole.COUNSELOR)
            .map(CounselorResponse::from).toList();
    }

    private static ResponseStatusException badRequest(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
}
