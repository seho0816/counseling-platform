
package com.counseling.backend.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccessLogRepository
        extends JpaRepository<AccessLog, Long> {

    @Override
    @EntityGraph(attributePaths = "actor")
    Page<AccessLog> findAll(Pageable pageable);

    List<AccessLog> findByActor_IdOrderByCreatedAtDesc(
            Long actorId
    );

    List<AccessLog> findByResourceTypeAndResourceIdOrderByCreatedAtDesc(
            String resourceType,
            Long resourceId
    );
}
