package com.counseling.backend.security;

import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// One-time local setup only. Never activate this profile for deployed services.
@Component
@Profile("bootstrap-admin")
public class BootstrapAdminRunner implements CommandLineRunner {

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String email;
    private final String rawPassword;

    public BootstrapAdminRunner(UserRepository users,
                                PasswordEncoder passwords,
                                @Value("${BOOTSTRAP_ADMIN_EMAIL:}") String email,
                                @Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String rawPassword) {
        this.users = users;
        this.passwords = passwords;
        this.email = email;
        this.rawPassword = rawPassword;
    }

    @Override
    public void run(String... args) {
        if (email.isBlank() || rawPassword.length() < 12) {
            throw new IllegalStateException(
                "Bootstrap requires BOOTSTRAP_ADMIN_EMAIL and a password of at least 12 characters");
        }
        if (users.existsByEmail(email)) {
            System.out.println("Bootstrap admin already exists; nothing created.");
            return;
        }
        users.saveAndFlush(new User(email, passwords.encode(rawPassword), "초기 관리자", UserRole.ADMIN));
        System.out.println("Bootstrap admin created. Stop this run and remove bootstrap secrets.");
    }
}
