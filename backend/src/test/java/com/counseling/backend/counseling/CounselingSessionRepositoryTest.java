package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import com.counseling.backend.client.ClientRepository;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class CounselingSessionRepositoryTest {

    @Autowired ClientRepository clientRepository;
    @Autowired UserRepository userRepository;
    @Autowired CounselingCaseRepository caseRepository;
    @Autowired CounselingSessionRepository sessionRepository;
    @Autowired EntityManager entityManager;

    @Test
    void savesAndReadsSessionsInOrder() {
        Client client = clientRepository.saveAndFlush(new Client("가상내담자", null));
        User counselor = userRepository.saveAndFlush(new User(
            "session-test-" + UUID.randomUUID() + "@example.invalid",
            "unused-test-hash", "가상상담사", UserRole.COUNSELOR
        ));
        CounselingCase counselingCase = caseRepository.saveAndFlush(
            new CounselingCase(client, counselor, "테스트 상담 사례")
        );

        CounselingSession first = sessionRepository.saveAndFlush(new CounselingSession(
            counselingCase, 1, LocalDate.of(2026, 11, 1), "가상의 1회기 상담 기록", counselor
        ));
        CounselingSession second = sessionRepository.saveAndFlush(new CounselingSession(
            counselingCase, 2, LocalDate.of(2026, 11, 2), "가상의 2회기 상담 기록", counselor
        ));
        entityManager.clear();

        var found = sessionRepository.findByCounselingCase_IdOrderBySessionNumberAsc(counselingCase.getId());
        assertThat(found).extracting(CounselingSession::getId)
            .containsExactly(first.getId(), second.getId());
        assertThat(found.get(0).getContent()).isEqualTo("가상의 1회기 상담 기록");
        assertThat(found.get(1).getAuthor().getId()).isEqualTo(counselor.getId());
        assertThat(sessionRepository.existsByCounselingCase_IdAndSessionNumber(counselingCase.getId(), 2))
            .isTrue();
        assertThat(sessionRepository.existsByCounselingCase_IdAndSessionNumber(counselingCase.getId(), 3))
            .isFalse();
    }
}
