package com.counseling.backend.intake;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;

public interface IntakeFormRepository extends JpaRepository<IntakeForm, Long> {
    List<IntakeForm> findByStatusOrderByCreatedAtDesc(IntakeStatus status);
    Page<IntakeForm> findByStatus(IntakeStatus status, Pageable pageable);

    // Lock before processing, so simultaneous admins cannot create two cases.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from IntakeForm i where i.id = :id")
    Optional<IntakeForm> findForUpdateById(@Param("id") Long id);
}
