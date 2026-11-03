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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional // Test inserts and updates are rolled back after each test.
class CounselingCaseRepositoryTest {

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CounselingCaseRepository caseRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void savesAndReadsAssignedCounselingCase() {
        Client client = clientRepository.saveAndFlush(
            new Client("가상내담자B", "010-0000-1111")
        );
        User counselor = userRepository.saveAndFlush(
            new User(
                "case-test-" + UUID.randomUUID() + "@example.invalid",
                "unused-test-hash", // Test-only fixture: not a real login credential.
                "가상상담사B",
                UserRole.COUNSELOR
            )
        );

        CounselingCase saved = caseRepository.saveAndFlush(
            new CounselingCase(client, counselor, "가상 학업 고민 사례")
        );

        entityManager.clear(); // Force a fresh database read.

        CounselingCase found = caseRepository.findById(saved.getId()).orElseThrow();
        assertThat(found.getTitle()).isEqualTo("가상 학업 고민 사례");
        assertThat(found.getStatus()).isEqualTo(CaseStatus.RECEIVED);
        assertThat(found.getClient().getId()).isEqualTo(client.getId());
        assertThat(found.getCounselor().getId()).isEqualTo(counselor.getId());
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(caseRepository.findByClient_IdOrderByIdDesc(client.getId()))
            .extracting(CounselingCase::getId).contains(saved.getId());
        assertThat(caseRepository.findByCounselor_IdAndStatus(counselor.getId(), CaseStatus.RECEIVED))
            .extracting(CounselingCase::getId).contains(saved.getId());
    }

    @Test
    void allowsCaseBeforeCounselorAssignment() {
        Client client = clientRepository.saveAndFlush(
            new Client("가상내담자C", null)
        );
        CounselingCase saved = caseRepository.saveAndFlush(
            new CounselingCase(client, null, "가상 초기 접수 사례")
        );

        entityManager.clear();

        CounselingCase found = caseRepository.findById(saved.getId()).orElseThrow();
        assertThat(found.getCounselor()).isNull();
        assertThat(found.getStatus()).isEqualTo(CaseStatus.RECEIVED);
    }
}
