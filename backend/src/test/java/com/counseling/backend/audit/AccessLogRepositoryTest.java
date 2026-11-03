package com.counseling.backend.audit;

import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class AccessLogRepositoryTest {

    @Autowired UserRepository userRepository;
    @Autowired AccessLogRepository accessLogRepository;
    @Autowired EntityManager entityManager;

    @Test
    void savesAndReadsDeniedAccessLog() {
        User counselor = userRepository.saveAndFlush(new User(
            "audit-test-" + UUID.randomUUID() + "@example.invalid",
            "unused-test-hash", "가상상담사", UserRole.COUNSELOR
        ));
        AccessLog saved = accessLogRepository.saveAndFlush(new AccessLog(
            counselor, "CASE", 123456L, "READ", AccessResult.DENIED
        ));
        entityManager.clear();

        AccessLog found = accessLogRepository.findById(saved.getId()).orElseThrow();
        assertThat(found.getActor().getId()).isEqualTo(counselor.getId());
        assertThat(found.getResult()).isEqualTo(AccessResult.DENIED);
        assertThat(found.getResourceId()).isEqualTo(123456L);
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(accessLogRepository.findByActor_IdOrderByCreatedAtDesc(counselor.getId()))
            .extracting(AccessLog::getId).contains(saved.getId());
    }
}
