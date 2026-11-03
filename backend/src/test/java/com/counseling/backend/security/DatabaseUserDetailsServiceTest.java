package com.counseling.backend.security;

import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DatabaseUserDetailsServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final DatabaseUserDetailsService service = new DatabaseUserDetailsService(users);

    @Test
    void mapsAdminFromDatabaseToGrantedAuthority() {
        User user = new User("admin@example.test", "stored-bcrypt-hash", "테스트 관리자", UserRole.ADMIN);
        when(users.findByEmail("admin@example.test")).thenReturn(Optional.of(user));

        var details = service.loadUserByUsername("admin@example.test");
        assertThat(details.getUsername()).isEqualTo("admin@example.test");
        assertThat(details.getPassword()).isEqualTo("stored-bcrypt-hash");
        assertThat(details.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
        assertThat(details.isEnabled()).isTrue();
    }

    @Test
    void failsForUnknownUser() {
        when(users.findByEmail("missing@example.test")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.loadUserByUsername("missing@example.test"))
            .isInstanceOf(UsernameNotFoundException.class);
    }
}
