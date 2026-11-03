package com.counseling.backend.client;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional // Spring rolls back test changes by default.
class ClientRepositoryTest {

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void createsAndReadsClient() {
        Client saved = clientRepository.saveAndFlush(
            new Client("가상내담자A", "010-0000-0000")
        );

        // Clear the persistence context to force an actual database read.
        entityManager.clear();

        Client found = clientRepository.findById(saved.getId())
            .orElseThrow();

        assertThat(found.getName()).isEqualTo("가상내담자A");
        assertThat(found.getContact()).isEqualTo("010-0000-0000");
        assertThat(found.getCreatedAt()).isNotNull();
    }
}
