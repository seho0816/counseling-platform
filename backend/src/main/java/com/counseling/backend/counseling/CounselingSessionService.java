package com.counseling.backend.counseling;

import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Service
public class CounselingSessionService {
    private static final int MAX_CONTENT_LENGTH = 20_000;

    private final CounselingCaseRepository cases;
    private final CounselingSessionRepository sessions;
    private final CounselingSummaryRepository summaries;
    private final ActiveActorService actors;

    public CounselingSessionService(
            CounselingCaseRepository cases,
            CounselingSessionRepository sessions,
            CounselingSummaryRepository summaries,
            ActiveActorService actors) {
        this.cases = cases;
        this.sessions = sessions;
        this.summaries = summaries;
        this.actors = actors;
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNSELOR')")
    public List<SessionResponse> list(Long caseId, Authentication authentication) {
        authorizedCase(caseId, authentication);
        return sessions.findByCounselingCase_IdOrderBySessionNumberAsc(caseId)
            .stream().map(SessionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNSELOR')")
    public SessionResponse get(Long caseId, Long sessionId, Authentication authentication) {
        authorizedCase(caseId, authentication);
        return SessionResponse.from(requireSession(caseId, sessionId));
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNSELOR')")
    public SessionResponse create(Long caseId, CreateSessionRequest request, Authentication authentication) {
        User actor = actors.requireAny(authentication, UserRole.ADMIN, UserRole.COUNSELOR);
        validateCreate(request);
        CounselingCase counselingCase = findAuthorizedCase(caseId, actor);
        if (sessions.existsByCounselingCase_IdAndSessionNumber(caseId, request.sessionNumber())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Session number already exists for this case");
        }
        CounselingSession created = new CounselingSession(
            counselingCase, request.sessionNumber(), request.sessionDate(), request.content().trim(), actor
        );
        try {
            // DB unique(case_id, session_number) remains the final concurrency guard.
            return SessionResponse.from(sessions.saveAndFlush(created));
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Session number conflict", ex);
        }
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNSELOR')")
    public SessionResponse update(Long caseId, Long sessionId,
                                  UpdateSessionRequest request, Authentication authentication) {
        authorizedCase(caseId, authentication);
        validateUpdate(request);
        CounselingSession session = requireSession(caseId, sessionId);
        // Once an AI draft exists, updating its source record can invalidate that draft.
        // Add an explicit regeneration / versioning workflow before allowing such edits.
        if (summaries.existsBySession_Id(sessionId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot edit a session with an AI summary");
        }
        session.updateRecord(request.sessionDate(), request.content().trim());
        return SessionResponse.from(sessions.saveAndFlush(session));
    }

    private CounselingCase authorizedCase(Long caseId, Authentication authentication) {
        User actor = actors.requireAny(authentication, UserRole.ADMIN, UserRole.COUNSELOR);
        return findAuthorizedCase(caseId, actor);
    }

    private CounselingCase findAuthorizedCase(Long caseId, User actor) {
        if (caseId == null || caseId < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid case id");
        }
        // Do not leak other counselors' case existence: 404 for non-owned cases.
        return (actor.getRole() == UserRole.ADMIN
            ? cases.findById(caseId)
            : cases.findByIdAndCounselor_Id(caseId, actor.getId()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
    }

    private CounselingSession requireSession(Long caseId, Long sessionId) {
        if (sessionId == null || sessionId < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid session id");
        }
        return sessions.findByIdAndCounselingCase_Id(sessionId, caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
    }

    private static void validateCreate(CreateSessionRequest request) {
        if (request == null || request.sessionNumber() == null
                || request.sessionNumber() < 1 || request.sessionNumber() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionNumber must be between 1 and 500");
        }
        validateNote(request.sessionDate(), request.content());
    }

    private static void validateUpdate(UpdateSessionRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON body is required");
        }
        validateNote(request.sessionDate(), request.content());
    }

    private static void validateNote(LocalDate sessionDate, String content) {
        if (sessionDate == null || content == null || content.isBlank()
                || content.strip().length() > MAX_CONTENT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "sessionDate and content (1..20000 characters) are required");
        }
    }
}
