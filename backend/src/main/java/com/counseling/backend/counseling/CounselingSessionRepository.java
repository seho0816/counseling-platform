
package com.counseling.backend.counseling;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CounselingSessionRepository
        extends JpaRepository<CounselingSession, Long> {

    List<CounselingSession>
        findByCounselingCase_IdOrderBySessionNumberAsc(Long caseId);

    boolean existsByCounselingCase_IdAndSessionNumber(
        Long caseId,
        Integer sessionNumber
    );
}
