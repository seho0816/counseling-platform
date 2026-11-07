package com.counseling.backend.intake;

import com.counseling.backend.client.Client;
import com.counseling.backend.client.ClientRepository;
import com.counseling.backend.counseling.CaseResponse;
import com.counseling.backend.counseling.CounselingCase;
import com.counseling.backend.counseling.CounselingCaseRepository;
import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminIntakeService {
    private final IntakeFormRepository intakes;
    private final ClientRepository clients;
    private final CounselingCaseRepository cases;
    private final ActiveActorService activeActors;

    public AdminIntakeService(IntakeFormRepository intakes, ClientRepository clients,
                              CounselingCaseRepository cases, ActiveActorService activeActors) {
        this.intakes = intakes;
        this.clients = clients;
        this.cases = cases;
        this.activeActors = activeActors;
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public IntakePageResponse list(int page, int size, IntakeStatus status,
                                   Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        if (page < 0 || size < 1 || size > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "page must be >= 0 and size between 1 and 50");
        }
        Pageable pageable = PageRequest.of(page, size,
            Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<IntakeForm> result = status == null ? intakes.findAll(pageable)
            : intakes.findByStatus(status, pageable);
        return new IntakePageResponse(result.getContent().stream().map(IntakeResponse::from).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public IntakeResponse detail(Long id, Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        return IntakeResponse.from(intakes.findById(validId(id))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Intake not found")));
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CaseResponse convert(Long id, Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        IntakeForm intake = intakes.findForUpdateById(validId(id))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Intake not found"));
        if (intake.getStatus() != IntakeStatus.SUBMITTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Intake already processed");
        }
        if (intake.getPrivacyConsentAt() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Privacy consent was not recorded");
        }
        // Conversion creates an unassigned case: the admin assigns a counselor later.
        // Both INSERTs and the status update are committed atomically.
        Client client = clients.saveAndFlush(new Client(
            intake.getApplicantName(), intake.getApplicantContact(), null));
        CounselingCase counselingCase = new CounselingCase(client, null,
            "상담 신청 - " + intake.getConcernCategory(), intake.getConcernDescription());
        counselingCase.linkIntakeForm(intake.getId());
        CaseResponse response = CaseResponse.from(cases.saveAndFlush(counselingCase));
        intake.markProcessed();
        intakes.saveAndFlush(intake);
        return response;
    }

    private static Long validId(Long id) {
        if (id == null || id < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid intake id required");
        }
        return id;
    }
}
