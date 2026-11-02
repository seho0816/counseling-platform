package com.counseling.backend.intake;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IntakeFormRepository extends JpaRepository<IntakeForm, Long> {
    List<IntakeForm> findByStatusOrderByCreatedAtDesc(IntakeStatus status);
}
